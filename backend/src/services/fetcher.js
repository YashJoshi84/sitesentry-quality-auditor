/**
 * Website URL Normalization and HTML Fetcher
 */

export function normalizeAndValidateUrl(inputUrl) {
  if (!inputUrl || typeof inputUrl !== 'string') {
    throw new Error('Please provide a website URL to audit.');
  }

  let trimmed = inputUrl.trim();

  // If no protocol is provided, default to https://
  if (!/^https?:\/\//i.test(trimmed)) {
    trimmed = 'https://' + trimmed;
  }

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error(`The provided URL "${inputUrl}" is not a valid web address.`);
  }

  // Ensure protocol is http or https
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only HTTP and HTTPS URLs are supported.');
  }

  // Ensure hostname exists and has at least one dot or is localhost
  if (!parsed.hostname || (!parsed.hostname.includes('.') && parsed.hostname !== 'localhost')) {
    throw new Error('Please provide a valid domain name (e.g., example.com or https://example.com).');
  }

  return parsed.href;
}

export async function fetchWebsiteHtml(targetUrl, timeoutMs = 15000) {
  const startTime = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 SiteSentry/1.0',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Cache-Control': 'no-cache',
  };

  try {
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers,
      signal: controller.signal,
      redirect: 'follow',
    });

    clearTimeout(timeoutId);
    const loadTimeMs = Date.now() - startTime;

    const contentType = response.headers.get('content-type') || '';

    // Check if response is HTML
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
      throw new Error(`Target returned non-HTML content type (${contentType || 'unknown'}). SiteSentry can only audit HTML web pages.`);
    }

    const html = await response.text();
    const finalUrl = response.url || targetUrl;

    return {
      ok: true,
      html,
      status: response.status,
      statusText: response.statusText,
      finalUrl,
      contentType,
      loadTimeMs,
      htmlSizeBytes: Buffer.byteLength(html, 'utf8'),
      headers: Object.fromEntries(response.headers.entries()),
    };
  } catch (err) {
    clearTimeout(timeoutId);

    if (err.name === 'AbortError') {
      throw new Error(`Connection timed out after ${Math.round(timeoutMs / 1000)} seconds while attempting to reach ${targetUrl}. The website may be down or responding too slowly.`);
    }

    if (err.cause?.code === 'ENOTFOUND') {
      throw new Error(`Domain could not be resolved (${targetUrl}). Please check for typos in the hostname.`);
    }

    if (err.cause?.code === 'ECONNREFUSED') {
      throw new Error(`Connection refused by server at ${targetUrl}.`);
    }

    throw new Error(err.message || `Failed to fetch website at ${targetUrl}.`);
  }
}
