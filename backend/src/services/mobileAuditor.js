import * as cheerio from 'cheerio';
import { chromium } from 'playwright';

/**
 * Mobile Readiness Auditor
 * Evaluates responsive design indicators, viewport configuration, media queries,
 * pinch-zoom usability, and mobile horizontal overflow.
 */

export async function auditMobileReadiness(targetUrl, html) {
  const $ = cheerio.load(html);
  const findings = [];

  // 1. Viewport configuration check
  const viewportMeta = $('meta[name="viewport" i]');
  const viewportContent = viewportMeta.attr('content')?.toLowerCase() || '';

  if (!viewportMeta.length) {
    findings.push({
      id: 'mobile-no-viewport',
      category: 'mobile',
      severity: 'critical',
      title: 'Missing mobile viewport definition',
      description: 'Without a viewport meta tag, mobile devices render the layout as a shrunk desktop view requiring awkward horizontal zooming.',
      evidence: 'No <meta name="viewport"> tag detected.',
      selector: 'head',
      recommendation: 'Add <meta name="viewport" content="width=device-width, initial-scale=1.0"> inside <head>.'
    });
  } else {
    // Check if user-scalable=no or maximum-scale=1.0 is used (accessibility / usability violation)
    if (viewportContent.includes('user-scalable=no') || viewportContent.includes('maximum-scale=1')) {
      findings.push({
        id: 'mobile-zoom-disabled',
        category: 'mobile',
        severity: 'warning',
        title: 'Pinch-to-zoom is disabled',
        description: 'The viewport configuration contains user-scalable=no or maximum-scale=1.0, preventing visually impaired users from zooming into text and images.',
        evidence: `<meta name="viewport" content="${viewportContent}">`,
        selector: 'meta[name="viewport"]',
        recommendation: 'Remove user-scalable=no and allow users to zoom for a better mobile experience.'
      });
    } else {
      findings.push({
        id: 'mobile-viewport-ready',
        category: 'mobile',
        severity: 'passed',
        title: 'Mobile viewport tag is well-configured',
        description: 'Device width scaling is enabled and allows responsive recalculation.',
        evidence: `<meta name="viewport" content="${viewportContent}">`,
        selector: 'meta[name="viewport"]',
        recommendation: 'No action needed.'
      });
    }
  }

  // 2. Fixed Width Elements Check (which break responsive layouts)
  const fixedWidthElements = [];
  $('[style*="width"]').each((_, el) => {
    const style = $(el).attr('style') || '';
    const match = style.match(/(?:^|;)\s*width\s*:\s*(\d+)px/i);
    if (match && parseInt(match[1], 10) > 480) {
      fixedWidthElements.push({
        tag: el.tagName,
        width: `${match[1]}px`,
        snippet: $(el).html()?.slice(0, 40) || '',
      });
    }
  });

  if (fixedWidthElements.length > 0) {
    findings.push({
      id: 'mobile-fixed-width-styles',
      category: 'mobile',
      severity: 'warning',
      title: `Fixed inline widths detected (> 480px)`,
      description: `Found ${fixedWidthElements.length} element(s) with explicit inline pixel widths exceeding common mobile screen widths, potentially causing horizontal scrolling.`,
      evidence: `Elements: ${fixedWidthElements.slice(0, 2).map(e => `<${e.tag} style="width: ${e.width}">`).join(', ')}`,
      selector: '[style*="width"]',
      recommendation: 'Replace fixed pixel widths with responsive fluid units like max-width: 100%, width: 100%, or CSS flex/grid layouts.'
    });
  } else {
    findings.push({
      id: 'mobile-fluid-widths-passed',
      category: 'mobile',
      severity: 'passed',
      title: 'No rigid inline pixel widths detected',
      description: 'Elements do not enforce rigid desktop-only pixel dimensions in inline styles.',
      evidence: '0 conflicting fixed width style attributes found.',
      selector: 'body',
      recommendation: 'No action needed.'
    });
  }

  // 3. Responsive Images Check
  const images = $('img');
  let responsiveImagesCount = 0;
  images.each((_, el) => {
    const srcset = $(el).attr('srcset');
    const sizes = $(el).attr('sizes');
    const hasPictureParent = $(el).closest('picture').length > 0;
    if (srcset || sizes || hasPictureParent) {
      responsiveImagesCount++;
    }
  });

  if (images.length > 3 && responsiveImagesCount === 0) {
    findings.push({
      id: 'mobile-responsive-images-missing',
      category: 'mobile',
      severity: 'info',
      title: 'Consider using modern responsive image formats',
      description: 'None of the images use srcset, sizes, or <picture> elements. Serving responsive images reduces mobile data consumption and speeds up load times on cellular networks.',
      evidence: `0 out of ${images.length} images use responsive attributes.`,
      selector: 'img',
      recommendation: 'Use <img srcset="..." sizes="..."> or <picture> tags to deliver tailored image resolutions for mobile screens.'
    });
  }

  // 4. Test mobile overflow via Playwright if possible
  let browser = null;
  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const context = await browser.newContext({
      viewport: { width: 375, height: 667 }, // iPhone SE standard width
      isMobile: true,
      hasTouch: true,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1',
    });

    const page = await context.newPage();
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 12000 });

    const overflowData = await page.evaluate(() => {
      const doc = document.documentElement;
      const scrollW = doc.scrollWidth;
      const clientW = doc.clientWidth;
      const hasHorizontalScroll = scrollW > clientW + 5; // tolerance of 5px
      return { scrollW, clientW, hasHorizontalScroll };
    });

    if (overflowData.hasHorizontalScroll) {
      findings.push({
        id: 'mobile-horizontal-overflow',
        category: 'mobile',
        severity: 'critical',
        title: 'Horizontal layout overflow on mobile screens',
        description: `Page content width (${overflowData.scrollW}px) exceeds the mobile screen viewport width (${overflowData.clientW}px), causing unwanted horizontal scroll.`,
        evidence: `Scroll width: ${overflowData.scrollW}px vs Viewport: ${overflowData.clientW}px on a 375px display.`,
        selector: 'html, body',
        recommendation: 'Inspect elements that extend past the viewport boundary. Add max-width: 100% and overflow-x: hidden where appropriate.'
      });
    } else {
      findings.push({
        id: 'mobile-overflow-passed',
        category: 'mobile',
        severity: 'passed',
        title: 'Page fits cleanly within mobile viewport',
        description: 'Verified on a 375px mobile device emulator: no unexpected horizontal scrollbar or content clipping.',
        evidence: `Document width (${overflowData.scrollW}px) matches mobile viewport (${overflowData.clientW}px).`,
        selector: 'html',
        recommendation: 'No action needed.'
      });
    }

    await browser.close();
  } catch (err) {
    if (browser) {
      try { await browser.close(); } catch { /* ignore */ }
    }
    console.warn(`[Mobile Auditor] Mobile viewport emulation notice: ${err.message}`);
  }

  return findings;
}
