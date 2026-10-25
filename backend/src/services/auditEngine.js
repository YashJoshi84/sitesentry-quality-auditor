import EventEmitter from 'events';
import { Audit } from '../models/Audit.js';
import { normalizeAndValidateUrl, fetchWebsiteHtml } from './fetcher.js';
import { auditSEO } from './seoAuditor.js';
import { auditBrokenLinks } from './brokenLinkAuditor.js';
import { auditAccessibility } from './a11yAuditor.js';
import { auditMobileReadiness } from './mobileAuditor.js';
import { calculateAuditScores } from './scoreCalculator.js';

export const auditProgressEmitter = new EventEmitter();

// Helper to broadcast progress updates to any connected SSE clients
function emitProgress(auditId, stage, percent, message) {
  auditProgressEmitter.emit(`progress:${auditId}`, {
    auditId,
    stage,
    percent,
    message,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Execute a complete website audit
 */
export async function runAuditPipeline(auditId) {
  const auditDoc = await Audit.findById(auditId);
  if (!auditDoc) {
    throw new Error(`Audit record ${auditId} not found`);
  }

  const startTime = Date.now();

  try {
    // Stage 1: Validating
    auditDoc.status = 'in_progress';
    auditDoc.currentStage = 'validating';
    auditDoc.progressPercent = 10;
    await auditDoc.save();
    emitProgress(auditId, 'validating', 10, 'Validating URL and network protocol...');

    const validatedUrl = normalizeAndValidateUrl(auditDoc.url);
    const domain = new URL(validatedUrl).hostname;
    auditDoc.url = validatedUrl;
    auditDoc.domain = domain;

    // Stage 2: Fetching HTML
    auditDoc.currentStage = 'fetching_html';
    auditDoc.progressPercent = 25;
    await auditDoc.save();
    emitProgress(auditId, 'fetching_html', 25, `Connecting to ${domain} and downloading DOM tree...`);

    const fetchResult = await fetchWebsiteHtml(validatedUrl);

    auditDoc.meta.httpStatus = fetchResult.status;
    auditDoc.meta.contentType = fetchResult.contentType;
    auditDoc.meta.loadTimeMs = fetchResult.loadTimeMs;
    auditDoc.meta.htmlSizeBytes = fetchResult.htmlSizeBytes;

    // Stage 3: SEO Audit
    auditDoc.currentStage = 'seo_audit';
    auditDoc.progressPercent = 45;
    await auditDoc.save();
    emitProgress(auditId, 'seo_audit', 45, 'Auditing SEO metadata, heading hierarchy, and image alt tags...');

    const seoResult = auditSEO(fetchResult.html, validatedUrl);
    auditDoc.meta.pageTitle = seoResult.meta.pageTitle;
    auditDoc.meta.canonical = seoResult.meta.canonical;
    auditDoc.meta.headingsCount = seoResult.meta.headingsCount;
    auditDoc.meta.imagesCount = seoResult.meta.imagesCount;

    // Stage 4: Accessibility Audit (axe-core / Playwright)
    auditDoc.currentStage = 'a11y_audit';
    auditDoc.progressPercent = 65;
    await auditDoc.save();
    emitProgress(auditId, 'a11y_audit', 65, 'Executing axe-core WCAG accessibility inspection...');

    const a11yFindings = await auditAccessibility(validatedUrl, fetchResult.html);

    // Stage 5: Broken Links Audit
    auditDoc.currentStage = 'link_audit';
    auditDoc.progressPercent = 80;
    await auditDoc.save();
    emitProgress(auditId, 'link_audit', 80, 'Testing outbound and internal hyperlinks for broken HTTP statuses...');

    const linkResult = await auditBrokenLinks(fetchResult.html, validatedUrl, 25);
    auditDoc.checkedLinks = linkResult.checkedLinks;
    auditDoc.meta.linksCount = linkResult.linksMeta;

    // Stage 6: Mobile Readiness Audit
    auditDoc.currentStage = 'mobile_audit';
    auditDoc.progressPercent = 90;
    await auditDoc.save();
    emitProgress(auditId, 'mobile_audit', 90, 'Evaluating mobile viewport, layout overflow, and fluid indicators...');

    const mobileFindings = await auditMobileReadiness(validatedUrl, fetchResult.html);

    // Stage 7: Consolidate Findings & Calculate Quality Scores
    auditDoc.currentStage = 'finalizing';
    auditDoc.progressPercent = 95;
    await auditDoc.save();
    emitProgress(auditId, 'finalizing', 95, 'Synthesizing audit findings and calculating quality scores...');

    const allFindings = [
      ...seoResult.findings,
      ...a11yFindings,
      ...linkResult.findings,
      ...mobileFindings,
    ];

    const scoreResults = calculateAuditScores(allFindings);

    const totalDuration = Date.now() - startTime;
    auditDoc.meta.auditDurationMs = totalDuration;
    auditDoc.findings = allFindings;
    auditDoc.scores = scoreResults.scores;
    auditDoc.summary = scoreResults.summary;
    auditDoc.status = 'completed';
    auditDoc.currentStage = 'completed';
    auditDoc.progressPercent = 100;
    await auditDoc.save();

    emitProgress(auditId, 'completed', 100, `Audit completed in ${(totalDuration / 1000).toFixed(1)}s.`);
    return auditDoc;

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
