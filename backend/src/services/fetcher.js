import { validateSafeUrl, safeFetchHtml } from './ssrfProtection.js';

/**
 * Website URL Normalization and Safe Fetcher
 * Applies strict SSRF validation, DNS verification, and streaming size limits.
 */

export async function normalizeAndValidateUrl(inputUrl) {
  return await validateSafeUrl(inputUrl);
}

export async function fetchWebsiteHtml(targetUrl, timeoutMs = 15000) {
  return await safeFetchHtml(targetUrl, {
    timeoutMs,
    maxSizeBytes: 10 * 1024 * 1024, // 10MB limit
    maxRedirects: 5,
  });
}
