import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import * as cheerio from 'cheerio';
import { attachPlaywrightSsrfGuard } from './ssrfProtection.js';

/**
 * Accessibility Auditor using axe-core & Playwright
 * Includes SSRF subresource protection and static DOM fallback.
 */

export async function auditAccessibility(targetUrl, html) {
  let browser = null;
  const findings = [];

  try {
    console.log(`[A11y Auditor] Launching Playwright Chromium for axe-core scan on ${targetUrl}...`);
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 SiteSentry-A11y/1.0',
      viewport: { width: 1280, height: 800 },
      ignoreHTTPSErrors: false,
    });

    const page = await context.newPage();
    // Intercept and block any SSRF / private IP subresource requests
    await attachPlaywrightSsrfGuard(page);

    // Navigate with networkidle or load timeout
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });

    // Run axe-core through AxeBuilder
    const axeResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
      .analyze();

    console.log(`[A11y Auditor] Axe-core finished. Found ${axeResults.violations.length} violations, ${axeResults.passes.length} passes.`);

    // Map axe-core violations to SiteSentry findings
    for (const v of axeResults.violations) {
      let severity = 'warning';
      if (v.impact === 'critical' || v.impact === 'serious') {
        severity = 'critical';
      } else if (v.impact === 'minor') {
        severity = 'info';
      }

      // Collect sample affected node
      const firstNode = v.nodes[0] || {};
      const selector = firstNode.target ? firstNode.target.join(' ') : '';
      const htmlSnippet = firstNode.html ? firstNode.html.slice(0, 150) : '';
      const failureSummary = firstNode.failureSummary || v.help;

      findings.push({
        id: `a11y-${v.id}`,
        category: 'accessibility',
        severity,
        title: v.help || v.id,
        description: v.description,
        evidence: `${failureSummary}${htmlSnippet ? ` (Element: ${htmlSnippet})` : ''}`,
        selector: selector || 'body',
        recommendation: `Follow WCAG guideline: ${v.helpUrl || 'Ensure element meets accessibility criteria.'}`
      });
    }

    // Add some of the key passes as passed findings to highlight what was done well
    const topPasses = axeResults.passes.slice(0, 6);
    for (const p of topPasses) {
      findings.push({
        id: `a11y-pass-${p.id}`,
        category: 'accessibility',
        severity: 'passed',
        title: p.help || p.id,
        description: p.description,
        evidence: `${p.nodes.length} element${p.nodes.length === 1 ? '' : 's'} passed inspection`,
        selector: 'body',
        recommendation: 'No action needed.'
      });
    }

    if (axeResults.violations.length === 0) {
      findings.push({
        id: 'a11y-all-passed',
        category: 'accessibility',
        severity: 'passed',
        title: 'Zero Axe-core Automated WCAG Violations Detected',
        description: 'No automated violations were flagged by axe-core for WCAG 2.1 Level AA automated checks. Note: automated testing evaluates approximately 30–40% of WCAG success criteria; full conformance requires human evaluation of keyboard flows, focus management, and assistive technology.',
        evidence: `All ${axeResults.passes.length} evaluated automated rules passed with 0 violations.`,
        selector: 'body',
        recommendation: 'Complement automated scans with manual keyboard navigation testing and screen reader audits.'
      });
    }

    return findings;

  } catch (browserError) {
    console.warn(`[A11y Auditor] Playwright/Axe-core run encountered issue: ${browserError.message}. Using high-precision static DOM accessibility scanner fallback.`);
    // Fallback static DOM a11y engine using Cheerio
    return runStaticA11yChecks(html);
  } finally {
    if (browser) {
      try { await browser.close(); } catch { /* ignore */ }
    }
  }
}

/**
 * Fallback DOM-based Accessibility Scanner
 * Evaluates core WCAG guidelines directly on the HTML tree.
 */
function runStaticA11yChecks(html) {
  const $ = cheerio.load(html);
  const findings = [];

  // 1. Form Inputs missing accessible labels
  const unlabeledInputs = [];
  $('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="image"]), select, textarea').each((_, el) => {
    const id = $(el).attr('id');
    const ariaLabel = $(el).attr('aria-label');
    const ariaLabelledBy = $(el).attr('aria-labelledby');
    const title = $(el).attr('title');
    const placeholder = $(el).attr('placeholder');
    const hasExplicitLabel = id ? $(`label[for="${id}"]`).length > 0 : false;
    const hasParentLabel = $(el).closest('label').length > 0;

    if (!hasExplicitLabel && !hasParentLabel && !ariaLabel && !ariaLabelledBy && !title) {
      unlabeledInputs.push({
        tag: el.tagName,
        type: $(el).attr('type') || 'text',
        name: $(el).attr('name') || '',
        placeholder: placeholder || '',
      });
    }
  });

  if (unlabeledInputs.length > 0) {
    findings.push({
      id: 'a11y-missing-form-labels',
      category: 'accessibility',
      severity: 'critical',
      title: `${unlabeledInputs.length} form field${unlabeledInputs.length > 1 ? 's' : ''} missing accessible labels`,
      description: 'Form controls must have explicit labels (<label for="..."> or aria-label) so screen readers can announce their purpose.',
      evidence: `Found ${unlabeledInputs.length} unlabeled control(s): ${unlabeledInputs.slice(0, 2).map(i => `<${i.tag} name="${i.name}" placeholder="${i.placeholder}">`).join(', ')}`,
      selector: 'form input, form select, form textarea',
      recommendation: 'Associate each form input with a <label for="element-id"> or specify an aria-label attribute.'
    });
  } else {
    findings.push({
      id: 'a11y-form-labels-passed',
      category: 'accessibility',
      severity: 'passed',
      title: 'Form fields have accessible labels',
      description: 'All inspected form controls have proper labeling or aria attributes.',
      evidence: 'No unlabeled interactive form inputs found.',
      selector: 'form',
      recommendation: 'No action needed.'
    });
  }

  // 2. Buttons without discernible text
  const emptyButtons = [];
  $('button, [role="button"]').each((_, el) => {
    const text = $(el).text().trim();
    const ariaLabel = $(el).attr('aria-label');
    const ariaLabelledBy = $(el).attr('aria-labelledby');
    const title = $(el).attr('title');
    const hasImgWithAlt = $(el).find('img[alt]:not([alt=""])').length > 0;
    const hasSvgWithTitle = $(el).find('svg title').length > 0;

    if (!text && !ariaLabel && !ariaLabelledBy && !title && !hasImgWithAlt && !hasSvgWithTitle) {
      emptyButtons.push($(el).html()?.slice(0, 60) || '<button></button>');
    }
  });

  if (emptyButtons.length > 0) {
    findings.push({
      id: 'a11y-empty-buttons',
      category: 'accessibility',
      severity: 'critical',
      title: `${emptyButtons.length} button${emptyButtons.length > 1 ? 's' : ''} without accessible name`,
      description: 'Buttons without readable text or aria-labels cannot be announced by screen readers.',
      evidence: `Buttons: ${emptyButtons.slice(0, 2).join(', ')}`,
      selector: 'button',
      recommendation: 'Add visible text, an aria-label attribute, or an embedded icon with an accessible <title>.'
    });
  } else {
    findings.push({
      id: 'a11y-buttons-passed',
      category: 'accessibility',
      severity: 'passed',
      title: 'Buttons have discernible names',
      description: 'All buttons provide accessible names for assistive technologies.',
      evidence: 'Buttons passed accessibility naming criteria.',
      selector: 'button',
      recommendation: 'No action needed.'
    });
  }

  // 3. Positive tabindex (Antipattern)
  const positiveTabindex = $('[tabindex]').filter((_, el) => {
    const val = parseInt($(el).attr('tabindex'), 10);
    return !isNaN(val) && val > 0;
  });

  if (positiveTabindex.length > 0) {
    findings.push({
      id: 'a11y-positive-tabindex',
      category: 'accessibility',
      severity: 'warning',
      title: 'Positive tabindex values detected',
      description: 'Using tabindex greater than 0 disrupts the natural keyboard tab navigation order and harms accessibility.',
      evidence: `Found ${positiveTabindex.length} elements with tabindex > 0.`,
      selector: '[tabindex]',
      recommendation: 'Avoid tabindex greater than 0. Use natural DOM hierarchy and tabindex="0" or tabindex="-1" when managing focus.'
    });
  }

  // 4. Ambiguous link text (e.g. "click here", "read more")
  const ambiguousPhrases = ['click here', 'here', 'more', 'read more', 'link', 'learn more'];
  const ambiguousLinks = [];

  $('a').each((_, el) => {
    const text = $(el).text().trim().toLowerCase();
    const ariaLabel = $(el).attr('aria-label');
    if (!ariaLabel && ambiguousPhrases.includes(text)) {
      ambiguousLinks.push(text);
    }
  });

  if (ambiguousLinks.length > 0) {
    findings.push({
      id: 'a11y-ambiguous-links',
      category: 'accessibility',
      severity: 'warning',
      title: 'Ambiguous link anchor text found',
      description: 'Generic anchor phrases like "click here" or "read more" do not convey context to users browsing via a screen reader\'s link list.',
      evidence: `Found ${ambiguousLinks.length} ambiguous links with text: ${Array.from(new Set(ambiguousLinks)).join(', ')}`,
      selector: 'a',
      recommendation: 'Use descriptive link text that explains where the link leads (e.g. "Read the full 2026 performance report" instead of "Read more").'
    });
  }

  return findings;
}
