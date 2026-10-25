import * as cheerio from 'cheerio';

/**
 * Broken Links Auditor
 * Extracts links, resolves relative paths, checks HTTP status with bounded concurrency,
 * and formats findings.
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
          statusText: 'Malformed URL',
          durationMs: 0,
          error: 'Invalid URL syntax in href',
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
        const isOk = response.status >= 200 && response.status < 400;

        return {
          url: item.url,
          status: response.status,
          ok: isOk,
          statusText: response.statusText || (isOk ? 'OK' : 'Error'),
          durationMs,
          error: isOk ? null : `HTTP status ${response.status}`,
          sourceSnippet: item.sourceText,
        };
      } catch (err) {
        clearTimeout(timeout);
        const durationMs = Date.now() - start;
        let errorMessage = err.message;
        if (err.name === 'AbortError') {
          errorMessage = 'Request timed out after 6 seconds';
        } else if (err.cause?.code) {
          errorMessage = `Network error (${err.cause.code})`;
        }

        return {
          url: item.url,
          status: null,
          ok: false,
          statusText: 'Unreachable',
          durationMs,
          error: errorMessage,
          sourceSnippet: item.sourceText,
        };
      }
    });

    const batchResults = await Promise.all(batchPromises);
    checkedResults.push(...batchResults);
  }

  // Findings generation
  const findings = [];
  const brokenLinks = checkedResults.filter(r => !r.ok);
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
  } else if (brokenLinks.length > 0) {
    brokenLinks.forEach((broken, idx) => {
      findings.push({
        id: `broken-link-${idx}`,
        category: 'broken_links',
        severity: broken.status === 404 || broken.status >= 500 ? 'critical' : 'warning',
        title: `Broken Link: ${broken.status ? `HTTP ${broken.status}` : 'Connection Failed'}`,
        description: `Link targeting "${broken.url}" failed with reason: ${broken.error || 'Server error'}. Anchor text: "${broken.sourceSnippet}".`,
        evidence: `Target: ${broken.url} — Status: ${broken.status || 'N/A'} (${broken.statusText})`,
        selector: `a[href="${broken.url}"]`,
        recommendation: `Update or remove the broken hyperlink. If the URL moved, configure a 301 redirect or update the href attribute.`
      });
    });

    findings.push({
      id: 'links-summary-broken',
      category: 'broken_links',
      severity: 'warning',
      title: `${brokenLinks.length} broken or unreachable link${brokenLinks.length > 1 ? 's' : ''} detected`,
      description: `${brokenLinks.length} of ${checkedResults.length} sampled links failed to resolve properly. Broken links degrade search ranking and frustrate users.`,
      evidence: `${successfulLinks.length} passed, ${brokenLinks.length} failed out of ${checkedResults.length} links checked.`,
      selector: 'a',
      recommendation: 'Review the detailed Checked Links table below to repair broken URLs.'
    });
  } else {
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
  }

  return {
    findings,
    checkedLinks: checkedResults,
    linksMeta: {
      totalFound: allUrls.length,
      checked: checkedResults.length,
      broken: brokenLinks.length,
    }
  };
}
