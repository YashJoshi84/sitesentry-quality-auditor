import * as cheerio from 'cheerio';
import { validateSafeUrl } from './ssrfProtection.js';

/**
 * Broken Links Auditor
 * Extracts links, resolves relative paths, checks HTTP status with bounded concurrency,
 * enforces SSRF safety on all targets, and categorizes broken vs restricted vs inconclusive results.
 */

export async function auditBrokenLinks(html, baseUrl, maxLinksToCheck = 25) {
  const $ = cheerio.load(html);
  const rawLinks = [];

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href')?.trim();
    const text = $(el).text().trim().replace(/\s+/g, ' ') || 'Link';
    if (href) {
      rawLinks.push({ href, text });
    }
  });

  const base = new URL(baseUrl);
  const candidateUrls = new Map();

  for (const { href, text } of rawLinks) {
    // Ignore internal anchor hashes, tel, mailto, javascript
    if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) {
      continue;
    }

    try {
      const resolved = new URL(href, base.href);
      if (resolved.protocol === 'http:' || resolved.protocol === 'https:') {
        if (!candidateUrls.has(resolved.href)) {
          candidateUrls.set(resolved.href, {
            url: resolved.href,
            sourceText: text.slice(0, 50),
            isInternal: resolved.hostname === base.hostname,
          });
        }
      }
    } catch {
      // Malformed URL in href
      candidateUrls.set(href, {
        url: href,
        sourceText: text.slice(0, 50),
        isMalformed: true,
      });
    }
  }

  const allUrls = Array.from(candidateUrls.values());
  const toCheck = allUrls.slice(0, maxLinksToCheck);

  // Check URLs concurrently with concurrency limit of 5
  const concurrencyLimit = 5;
  const checkedResults = [];

  for (let i = 0; i < toCheck.length; i += concurrencyLimit) {
    const batch = toCheck.slice(i, i + concurrencyLimit);
    const batchPromises = batch.map(async (item) => {
      if (item.isMalformed) {
        return {
          url: item.url,
          status: null,
          ok: false,
          category: 'malformed',
          statusText: 'Malformed URL',
          durationMs: 0,
          error: 'Invalid URL syntax in href',
          sourceSnippet: item.sourceText,
        };
      }

      // Security: Validate target URL against SSRF / internal IP destinations before making request
      try {
        await validateSafeUrl(item.url);
      } catch (ssrfErr) {
        return {
          url: item.url,
          status: null,
          ok: false,
          category: 'blocked_internal',
          statusText: 'Blocked (Internal Host)',
          durationMs: 0,
          error: `Security blocked: ${ssrfErr.message}`,
          sourceSnippet: item.sourceText,
        };
      }

      const start = Date.now();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);

      try {
        // Attempt HEAD request first for speed and bandwidth efficiency
        let response = await fetch(item.url, {
          method: 'HEAD',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 SiteSentry-LinkChecker/1.0',
            'Accept': '*/*',
          },
          signal: controller.signal,
          redirect: 'follow',
        });

        // Some servers return 405 Method Not Allowed or 403 on HEAD requests, retry with GET
        if (response.status === 405 || response.status === 403) {
          response = await fetch(item.url, {
            method: 'GET',
            headers: {
              'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 SiteSentry-LinkChecker/1.0',
              'Accept': '*/*',
              'Range': 'bytes=0-1024',
            },
            signal: controller.signal,
            redirect: 'follow',
          });
        }

        clearTimeout(timeout);
        const durationMs = Date.now() - start;
        const status = response.status;
        const isOk = status >= 200 && status < 400;

        // Categorize the response accurately
        let resultCategory = 'healthy';
        if (isOk) {
          resultCategory = 'healthy';
        } else if (status === 404 || status === 410) {
          resultCategory = 'confirmed_broken';
        } else if (status === 401 || status === 403 || status === 429) {
          resultCategory = 'restricted_or_bot_challenge';
        } else if (status >= 500) {
          resultCategory = 'server_error';
        } else {
          resultCategory = 'http_error';
        }

        return {
          url: item.url,
          status,
          ok: isOk,
          category: resultCategory,
          statusText: response.statusText || (isOk ? 'OK' : `HTTP ${status}`),
          durationMs,
          error: isOk ? null : `HTTP status ${status}`,
          sourceSnippet: item.sourceText,
        };
      } catch (err) {
        clearTimeout(timeout);
        const durationMs = Date.now() - start;
        let errorMessage = err.message;
        let category = 'network_error';

        if (err.name === 'AbortError') {
          errorMessage = 'Request timed out after 6 seconds';
          category = 'timeout';
        } else if (err.cause?.code) {
          errorMessage = `Network error (${err.cause.code})`;
        }

        return {
          url: item.url,
          status: null,
          ok: false,
          category,
          statusText: category === 'timeout' ? 'Timed Out' : 'Unreachable',
          durationMs,
          error: errorMessage,
          sourceSnippet: item.sourceText,
        };
      }
    });

    const batchResults = await Promise.all(batchPromises);
    checkedResults.push(...batchResults);
  }

  // Findings generation with accurate severity distinction
  const findings = [];
  const confirmedBrokenLinks = checkedResults.filter(r => r.category === 'confirmed_broken' || r.category === 'server_error');
  const restrictedLinks = checkedResults.filter(r => r.category === 'restricted_or_bot_challenge');
  const timeoutOrNetworkLinks = checkedResults.filter(r => r.category === 'timeout' || r.category === 'network_error');
  const successfulLinks = checkedResults.filter(r => r.ok);

  if (checkedResults.length === 0) {
    findings.push({
      id: 'links-none-found',
      category: 'broken_links',
      severity: 'info',
      title: 'No outbound links discovered on page',
      description: 'The inspected webpage does not contain any outgoing or internal hyperlinks.',
      evidence: '0 <a href="..."> elements detected',
      selector: 'body',
      recommendation: 'Add relevant internal or external navigation links to encourage site exploration.'
    });
  } else {
    // 1. Confirmed broken links (404, 410, 500) - Critical defect
    if (confirmedBrokenLinks.length > 0) {
      confirmedBrokenLinks.forEach((broken, idx) => {
        findings.push({
          id: `broken-link-confirmed-${idx}`,
          category: 'broken_links',
          severity: 'critical',
          title: `Broken Link: HTTP ${broken.status || 'Failed'} (${broken.statusText})`,
          description: `Confirmed broken hyperlink targeting "${broken.url}". Anchor text: "${broken.sourceSnippet}".`,
          evidence: `Target: ${broken.url} — HTTP Status: ${broken.status} (${broken.statusText})`,
          selector: `a[href="${broken.url}"]`,
          recommendation: 'Update or remove the broken hyperlink. If the resource moved, configure a 301 redirect or update the href attribute.'
        });
      });
    }

    // 2. Restricted / Bot Challenge (401, 403, 429) - Warning / Inconclusive, not confirmed broken
    if (restrictedLinks.length > 0) {
      restrictedLinks.forEach((restricted, idx) => {
        findings.push({
          id: `link-restricted-${idx}`,
          category: 'broken_links',
          severity: 'warning',
          title: `Access Restricted: HTTP ${restricted.status} (${restricted.statusText})`,
          description: `Target returned HTTP ${restricted.status} for "${restricted.url}". This commonly indicates bot protection (e.g. Cloudflare), paywalls, or automated crawler rate limits rather than a broken page.`,
          evidence: `Target: ${restricted.url} — Response: HTTP ${restricted.status}`,
          selector: `a[href="${restricted.url}"]`,
          recommendation: 'Verify this link manually in a regular web browser to confirm accessibility for human visitors.'
        });
      });
    }

    // 3. Timeouts / Network Inconclusive (Timeouts, DNS unreachable) - Warning
    if (timeoutOrNetworkLinks.length > 0) {
      timeoutOrNetworkLinks.forEach((item, idx) => {
        findings.push({
          id: `link-timeout-${idx}`,
          category: 'broken_links',
          severity: 'warning',
          title: `Link Verification Inconclusive: ${item.statusText}`,
          description: `Unable to verify "${item.url}" within the timeout window. Reason: ${item.error}.`,
          evidence: `Target: ${item.url} — ${item.error}`,
          selector: `a[href="${item.url}"]`,
          recommendation: 'Verify server uptime and network latency for the external target.'
        });
      });
    }

    // Overall summary findings
    const totalFailed = confirmedBrokenLinks.length + restrictedLinks.length + timeoutOrNetworkLinks.length;

    if (totalFailed === 0) {
      findings.push({
        id: 'links-all-passed',
        category: 'broken_links',
        severity: 'passed',
        title: 'All tested hyperlinks are healthy',
        description: `Successfully verified ${checkedResults.length} unique links across the page with no broken HTTP statuses or connection drops.`,
        evidence: `${checkedResults.length} / ${checkedResults.length} links responded with 2xx/3xx HTTP codes.`,
        selector: 'a',
        recommendation: 'No action needed.'
      });
    } else {
      findings.push({
        id: 'links-summary',
        category: 'broken_links',
        severity: confirmedBrokenLinks.length > 0 ? 'critical' : 'warning',
        title: `${confirmedBrokenLinks.length} confirmed broken, ${restrictedLinks.length} restricted, ${timeoutOrNetworkLinks.length} inconclusive`,
        description: `Of ${checkedResults.length} sampled links: ${successfulLinks.length} passed, ${confirmedBrokenLinks.length} confirmed broken (404/500), ${restrictedLinks.length} restricted/bot-blocked (401/403/429), and ${timeoutOrNetworkLinks.length} timed out.`,
        evidence: `${successfulLinks.length} healthy out of ${checkedResults.length} verified links.`,
        selector: 'a',
        recommendation: 'Prioritize repairing confirmed broken links (404/500). Review the Checked Links table for full status codes.'
      });
    }

    // Report if configured scan budget limited complete link verification
    if (allUrls.length > maxLinksToCheck) {
      findings.push({
        id: 'links-budget-cap-notice',
        category: 'broken_links',
        severity: 'info',
        title: `Link inspection capped at ${maxLinksToCheck} of ${allUrls.length} total links`,
        description: `The page contains ${allUrls.length} total hyperlinks. To maintain responsive audit speed and prevent target server rate limiting, verification was bounded to ${maxLinksToCheck} unique links.`,
        evidence: `Sampled ${checkedResults.length} of ${allUrls.length} discovered links.`,
        selector: 'body',
        recommendation: 'Periodic targeted link audits are advised to verify secondary footer and archive links.'
      });
    }
  }

  return {
    findings,
    checkedLinks: checkedResults,
    linksMeta: {
      totalFound: allUrls.length,
      checked: checkedResults.length,
      broken: confirmedBrokenLinks.length,
      restricted: restrictedLinks.length,
      timeouts: timeoutOrNetworkLinks.length,
    }
  };
}
