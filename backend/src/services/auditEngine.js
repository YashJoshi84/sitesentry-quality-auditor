import EventEmitter from 'events';
import { Audit } from '../models/Audit.js';
import { normalizeAndValidateUrl, fetchWebsiteHtml } from './fetcher.js';
import { auditSEO } from './seoAuditor.js';
import { auditBrokenLinks } from './brokenLinkAuditor.js';
import { auditAccessibility } from './a11yAuditor.js';
import { auditMobileReadiness } from './mobileAuditor.js';
import { calculateAuditScores } from './scoreCalculator.js';

export const auditProgressEmitter = new EventEmitter();

const activeCancellations = new Set();

export function cancelActiveAudit(auditId) {
  activeCancellations.add(String(auditId));
}

// Helper to broadcast progress updates to connected SSE clients
function emitProgress(auditId, stage, percent, message) {
  auditProgressEmitter.emit(`progress:${auditId}`, {
    auditId,
    stage,
    percent,
    message,
    timestamp: new Date().toISOString(),
  });
}

function checkCancelled(auditId, auditDoc) {
  if (activeCancellations.has(String(auditId))) {
    activeCancellations.delete(String(auditId));
    auditDoc.status = 'cancelled';
    auditDoc.currentStage = 'cancelled';
    auditDoc.errorMessage = 'Audit was cancelled by user request.';
    return true;
  }
  return false;
}

/**
 * Execute a complete website audit with 90s deadline and cancellation checks
 */
export async function runAuditPipeline(auditId) {
  const auditDoc = await Audit.findById(auditId);
  if (!auditDoc) {
    throw new Error(`Audit record ${auditId} not found`);
  }

  // Prevent invalid re-executions if audit is already completed
  if (auditDoc.status === 'completed' || auditDoc.status === 'partially_completed') {
    return auditDoc;
  }

  const startTime = Date.now();
  const EXECUTION_TIMEOUT_MS = 90000; // 90 seconds hard deadline

  const pipelinePromise = (async () => {
    // Stage 1: Validating (SSRF, DNS resolution, and scheme checks)
    auditDoc.status = 'in_progress';
    auditDoc.currentStage = 'validating';
    auditDoc.progressPercent = 10;
    await auditDoc.save();
    emitProgress(auditId, 'validating', 10, 'Validating URL, DNS resolution, and SSRF restrictions...');

    if (checkCancelled(auditId, auditDoc)) {
      await auditDoc.save();
      emitProgress(auditId, 'cancelled', 100, 'Audit execution cancelled.');
      return auditDoc;
    }

    const validatedUrl = await normalizeAndValidateUrl(auditDoc.url);
    const domain = new URL(validatedUrl).hostname;
    auditDoc.url = validatedUrl;
    auditDoc.domain = domain;

    // Stage 2: Fetching HTML (Protected against SSRF redirects & compression bombs)
    auditDoc.currentStage = 'fetching_html';
    auditDoc.progressPercent = 25;
    await auditDoc.save();
    emitProgress(auditId, 'fetching_html', 25, `Connecting safely to ${domain} and downloading DOM tree...`);

    if (checkCancelled(auditId, auditDoc)) {
      await auditDoc.save();
      emitProgress(auditId, 'cancelled', 100, 'Audit execution cancelled.');
      return auditDoc;
    }

    const fetchResult = await fetchWebsiteHtml(validatedUrl);

    auditDoc.meta.httpStatus = fetchResult.status;
    auditDoc.meta.contentType = fetchResult.contentType;
    auditDoc.meta.loadTimeMs = fetchResult.loadTimeMs;
    auditDoc.meta.htmlSizeBytes = fetchResult.htmlSizeBytes;

    const categoryStatuses = {
      seo: 'completed',
      accessibility: 'completed',
      broken_links: 'completed',
      mobile: 'completed',
    };

    // Stage 3: SEO Audit
    if (checkCancelled(auditId, auditDoc)) {
      await auditDoc.save();
      emitProgress(auditId, 'cancelled', 100, 'Audit execution cancelled.');
      return auditDoc;
    }

    auditDoc.currentStage = 'seo_audit';
    auditDoc.progressPercent = 45;
    await auditDoc.save();
    emitProgress(auditId, 'seo_audit', 45, 'Auditing SEO metadata, heading hierarchy, and image alt tags...');

    let seoFindings = [];
    try {
      const seoResult = auditSEO(fetchResult.html, validatedUrl);
      seoFindings = seoResult.findings || [];
      auditDoc.meta.pageTitle = seoResult.meta?.pageTitle || '';
      auditDoc.meta.canonical = seoResult.meta?.canonical || '';
      auditDoc.meta.headingsCount = seoResult.meta?.headingsCount || {};
      auditDoc.meta.imagesCount = seoResult.meta?.imagesCount || {};
    } catch (seoErr) {
      console.error(`[Audit Engine] SEO stage encountered error for ${auditId}:`, seoErr);
      categoryStatuses.seo = 'failed';
      seoFindings.push({
        id: 'seo-stage-error',
        category: 'seo',
        severity: 'critical',
        title: 'SEO Audit Stage Error',
        description: `SEO analysis failed: ${seoErr.message}`,
        evidence: 'Parser exception during DOM inspection',
        selector: 'html',
        recommendation: 'Check that target HTML is well-formed.',
      });
    }

    // Stage 4: Accessibility Audit (axe-core / Playwright with SSRF route interception)
    if (checkCancelled(auditId, auditDoc)) {
      await auditDoc.save();
      emitProgress(auditId, 'cancelled', 100, 'Audit execution cancelled.');
      return auditDoc;
    }

    auditDoc.currentStage = 'a11y_audit';
    auditDoc.progressPercent = 65;
    await auditDoc.save();
    emitProgress(auditId, 'a11y_audit', 65, 'Executing axe-core automated WCAG accessibility inspection...');

    let a11yFindings = [];
    try {
      a11yFindings = await auditAccessibility(validatedUrl, fetchResult.html);
    } catch (a11yErr) {
      console.error(`[Audit Engine] Accessibility stage error for ${auditId}:`, a11yErr);
      categoryStatuses.accessibility = 'failed';
      a11yFindings.push({
        id: 'a11y-stage-error',
        category: 'accessibility',
        severity: 'critical',
        title: 'Accessibility Audit Error',
        description: `Accessibility inspection failed: ${a11yErr.message}`,
        evidence: 'Headless browser execution error',
        selector: 'body',
        recommendation: 'Verify that the target page allows automated accessibility scanner execution.',
      });
    }

    // Stage 5: Broken Links Audit (Protected against internal SSRF link targets)
    if (checkCancelled(auditId, auditDoc)) {
      await auditDoc.save();
      emitProgress(auditId, 'cancelled', 100, 'Audit execution cancelled.');
      return auditDoc;
    }

    auditDoc.currentStage = 'link_audit';
    auditDoc.progressPercent = 80;
    await auditDoc.save();
    emitProgress(auditId, 'link_audit', 80, 'Testing outbound and internal hyperlinks for broken HTTP statuses...');

    let linkFindings = [];
    try {
      const linkResult = await auditBrokenLinks(fetchResult.html, validatedUrl, 25);
      linkFindings = linkResult.findings || [];
      auditDoc.checkedLinks = linkResult.checkedLinks || [];
      auditDoc.meta.linksCount = linkResult.linksMeta || {};
    } catch (linkErr) {
      console.error(`[Audit Engine] Link audit stage error for ${auditId}:`, linkErr);
      categoryStatuses.broken_links = 'failed';
      linkFindings.push({
        id: 'links-stage-error',
        category: 'broken_links',
        severity: 'critical',
        title: 'Hyperlinks Check Error',
        description: `Link checking failed: ${linkErr.message}`,
        evidence: 'Network resolution error during link sampling',
        selector: 'a',
        recommendation: 'Check network connectivity to external targets.',
      });
    }

    // Stage 6: Mobile Readiness Audit (SSRF-protected Playwright viewport evaluation)
    if (checkCancelled(auditId, auditDoc)) {
      await auditDoc.save();
      emitProgress(auditId, 'cancelled', 100, 'Audit execution cancelled.');
      return auditDoc;
    }

    auditDoc.currentStage = 'mobile_audit';
    auditDoc.progressPercent = 90;
    await auditDoc.save();
    emitProgress(auditId, 'mobile_audit', 90, 'Evaluating mobile viewport, layout overflow, and fluid indicators...');

    let mobileFindings = [];
    try {
      mobileFindings = await auditMobileReadiness(validatedUrl, fetchResult.html);
    } catch (mobileErr) {
      console.error(`[Audit Engine] Mobile audit stage error for ${auditId}:`, mobileErr);
      categoryStatuses.mobile = 'failed';
      mobileFindings.push({
        id: 'mobile-stage-error',
        category: 'mobile',
        severity: 'critical',
        title: 'Mobile Readiness Check Error',
        description: `Mobile viewport inspection failed: ${mobileErr.message}`,
        evidence: 'Viewport emulation exception',
        selector: 'html',
        recommendation: 'Check viewport configuration in the target HTML head.',
      });
    }

    // Stage 7: Consolidate Findings & Calculate Quality Scores
    auditDoc.currentStage = 'finalizing';
    auditDoc.progressPercent = 95;
    await auditDoc.save();
    emitProgress(auditId, 'finalizing', 95, 'Synthesizing audit findings and calculating quality scores...');

    const allFindings = [
      ...seoFindings,
      ...a11yFindings,
      ...linkFindings,
      ...mobileFindings,
    ];

    // Compute deterministic scores using honest category status and weights
    const scoreResults = calculateAuditScores(allFindings, categoryStatuses);

    const totalDuration = Date.now() - startTime;
    auditDoc.meta.auditDurationMs = totalDuration;
    auditDoc.findings = allFindings;
    auditDoc.scores = scoreResults.scores;
    auditDoc.summary = scoreResults.summary;
    auditDoc.categoryDetails = scoreResults.categoryDetails;

    // Check if any categories failed to determine honest audit status
    const failedCategories = Object.entries(categoryStatuses).filter(([_, status]) => status === 'failed');
    let finalStatus = 'completed';
    if (failedCategories.length === Object.keys(categoryStatuses).length) {
      finalStatus = 'failed';
    } else if (failedCategories.length > 0) {
      finalStatus = 'partially_completed';
    }

    auditDoc.status = finalStatus;
    auditDoc.currentStage = finalStatus;
    auditDoc.progressPercent = 100;
    await auditDoc.save();

    emitProgress(auditId, finalStatus, 100, `Audit finished with status "${finalStatus}" in ${(totalDuration / 1000).toFixed(1)}s.`);
    return auditDoc;
  })();

  // Race against execution timeout deadline
  const timeoutPromise = new Promise((_, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Audit execution timed out after ${EXECUTION_TIMEOUT_MS / 1000} seconds.`));
    }, EXECUTION_TIMEOUT_MS);
    timer.unref?.();
  });

  try {
    return await Promise.race([pipelinePromise, timeoutPromise]);
  } catch (err) {
    console.error(`[Audit Pipeline Error] Audit ${auditId} failed:`, err);
    auditDoc.status = 'failed';
    auditDoc.currentStage = 'failed';
    auditDoc.errorMessage = err.message || 'An unknown error occurred during website inspection.';
    await auditDoc.save();

    emitProgress(auditId, 'failed', 100, `Audit failed: ${auditDoc.errorMessage}`);
    throw err;
  }
}
