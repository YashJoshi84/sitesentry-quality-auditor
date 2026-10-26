import dns from 'dns/promises';
import net from 'net';

/**
 * SSRF Protection Service
 * Validates URLs and prevents requests to private, loopback, link-local,
 * cloud metadata, multicast, and internal network addresses.
 */

// Denied hostname patterns (case-insensitive)
const DENIED_HOSTNAMES = [
  /^localhost$/i,
  /\.localhost$/i,
  /\.local$/i,
  /\.internal$/i,
  /\.corp$/i,
  /\.home$/i,
  /\.lan$/i,
  /^metadata\.google\.internal$/i,
  /^metadata$/i,
  /^instance-data$/i,
];

/**
 * Converts an IPv4 dotted string into a 32-bit unsigned integer
 */
function ipv4ToInt(ip) {
  const parts = ip.split('.').map(Number);
  return ((parts[0] << 24) >>> 0) + ((parts[1] << 16) >>> 0) + ((parts[2] << 8) >>> 0) + (parts[3] >>> 0);
}

/**
 * Checks if a 32-bit integer falls within a CIDR range
 */
function inIpv4Cidr(ipInt, cidrIp, prefixLen) {
  const mask = prefixLen === 0 ? 0 : (~0 << (32 - prefixLen)) >>> 0;
  const cidrInt = ipv4ToInt(cidrIp);
  return (ipInt & mask) === (cidrInt & mask);
}

/**
 * Evaluates whether an IPv4 address is in a private, loopback, or reserved range.
 */
export function isPrivateIpv4(ip) {
  if (!net.isIPv4(ip)) return false;
  const ipInt = ipv4ToInt(ip);

  const privateRanges = [
    ['0.0.0.0', 8],        // Current network (this host)
    ['10.0.0.0', 8],       // Private Class A
    ['100.64.0.0', 10],    // Carrier-grade NAT
    ['127.0.0.0', 8],      // Loopback
    ['169.254.0.0', 16],   // Link-local & Cloud metadata (169.254.169.254)
    ['172.16.0.0', 12],    // Private Class B (172.16.0.0 - 172.31.255.255)
    ['192.0.0.0', 24],     // IETF Protocol Assignments
    ['192.0.2.0', 24],     // TEST-NET-1 (documentation)
    ['192.88.99.0', 24],   // 6to4 relay anycast
    ['192.168.0.0', 16],   // Private Class C
    ['198.18.0.0', 15],    // Benchmark testing
    ['198.51.100.0', 24],  // TEST-NET-2
    ['203.0.113.0', 24],   // TEST-NET-3
    ['224.0.0.0', 4],      // Multicast
    ['240.0.0.0', 4],      // Reserved / Broadcast
  ];

  for (const [rangeIp, prefix] of privateRanges) {
    if (inIpv4Cidr(ipInt, rangeIp, prefix)) {
      return true;
    }
  }

  return false;
}

/**
 * Evaluates whether an IPv6 address is in a private, loopback, or reserved range.
 */
export function isPrivateIpv6(ip) {
  if (!net.isIPv6(ip)) return false;

  const normalized = ip.toLowerCase();

  // IPv6 Loopback
  if (normalized === '::1' || normalized === '0:0:0:0:0:0:0:1') {
    return true;
  }

  // IPv6 Unspecified
  if (normalized === '::' || normalized === '0:0:0:0:0:0:0:0') {
    return true;
  }

  // IPv4-mapped IPv6 address (::ffff:127.0.0.1, ::ffff:169.254.169.254, etc.)
  const ipv4MappedMatch = normalized.match(/^(?:0:0:0:0:0:ffff:|::ffff:)(\d+\.\d+\.\d+\.\d+)$/i);
  if (ipv4MappedMatch) {
    return isPrivateIpv4(ipv4MappedMatch[1]);
  }

  // IPv6 Unique Local Address (ULA) - fc00::/7 (fc00:: - fdff::)
  if (/^f[cd][0-9a-f]{2}:/i.test(normalized)) {
    return true;
  }

  // IPv6 Link-Local - fe80::/10 (fe80:: - febf::)
  if (/^fe[89ab][0-9a-f]:/i.test(normalized)) {
    return true;
  }

  // IPv6 Multicast - ff00::/8
  if (/^ff[0-9a-f]{2}:/i.test(normalized)) {
    return true;
  }

  // Discard prefix - 100::/64
  if (/^0?100::/i.test(normalized)) {
    return true;
  }

  return false;
}

/**
 * Checks if any IP address (v4 or v6) is private or reserved
 */
export function isPrivateIp(ip) {
  return isPrivateIpv4(ip) || isPrivateIpv6(ip);
}

/**
 * Validates a target URL syntax and ensures it is not an internal or restricted host.
 * Throws an Error if the URL is invalid or targets private infrastructure.
 */
export async function validateSafeUrl(inputUrl) {
  if (!inputUrl || typeof inputUrl !== 'string') {
    throw new Error('Please provide a valid website URL.');
  }

  let trimmed = inputUrl.trim();
  if (trimmed.length > 2048) {
    throw new Error('URL exceeds the maximum allowed length of 2048 characters.');
  }

  // Detect explicit protocols
  const schemeMatch = trimmed.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):/);
  if (schemeMatch) {
    const scheme = schemeMatch[1].toLowerCase();
    if (scheme !== 'http' && scheme !== 'https') {
      throw new Error('Only HTTP and HTTPS protocols are permitted for security.');
    }
  } else {
    // If protocol was omitted, default to https://
    trimmed = 'https://' + trimmed;
  }

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error(`The provided URL "${inputUrl}" is not a valid web address.`);
  }

  // Protocol check
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only HTTP and HTTPS protocols are permitted for security.');
  }

  const hostname = parsed.hostname.toLowerCase();

  if (!hostname) {
    throw new Error('URL hostname is required.');
  }

  // Block localhost and internal domain patterns
  for (const pattern of DENIED_HOSTNAMES) {
    if (pattern.test(hostname)) {
      throw new Error(`Access to internal or local hostname "${hostname}" is forbidden for security.`);
    }
  }

  // Check if hostname is an IP literal
  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) {
      throw new Error(`Access to private or internal IP address "${hostname}" is forbidden.`);
    }
  }

  // Resolve DNS to verify that underlying IPs are public
  try {
    const resolvedAddresses = await dns.lookup(hostname, { all: true });

    if (!resolvedAddresses || resolvedAddresses.length === 0) {
      throw new Error(`Unable to resolve domain "${hostname}". Check for typos.`);
    }

    for (const { address } of resolvedAddresses) {
      if (isPrivateIp(address)) {
        throw new Error(`Domain "${hostname}" resolved to restricted IP "${address}". Outbound connection blocked.`);
      }
    }
  } catch (err) {
    if (err.message && err.message.includes('restricted IP')) {
      throw err;
    }
    if (err.code === 'ENOTFOUND') {
      throw new Error(`Domain could not be resolved ("${hostname}"). Please verify the domain name.`);
    }
    // Re-throw if already an explicit safe URL error
    throw err;
  }

  return parsed.href;
}

/**
 * Safely fetches an outbound URL with:
 * - Redirect validation (re-validates every redirect destination to prevent SSRF bypasses)
 * - Strict response body size limit (streaming byte counter)
 * - Abort timeout
 */
export async function safeFetchHtml(targetUrl, options = {}) {
  const {
    timeoutMs = 15000,
    maxSizeBytes = 10 * 1024 * 1024, // 10 MB maximum
    maxRedirects = 5,
  } = options;

  let currentUrl = await validateSafeUrl(targetUrl);
  let redirectCount = 0;
  const startTime = Date.now();

  while (redirectCount <= maxRedirects) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const headers = {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 SiteSentry/1.0',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cache-Control': 'no-cache',
    };

    let response;
    try {
      response = await fetch(currentUrl, {
        method: 'GET',
        headers,
        signal: controller.signal,
        redirect: 'manual', // Manual redirect control to inspect every hop against SSRF
      });
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error(`Connection timed out after ${Math.round(timeoutMs / 1000)}s while reaching ${currentUrl}.`);
      }
      throw err;
    }

    clearTimeout(timeoutId);

    // Handle redirects manually
    if (response.status >= 300 && response.status < 400) {
      redirectCount++;
      if (redirectCount > maxRedirects) {
        throw new Error(`Exceeded maximum redirect limit (${maxRedirects}) while requesting ${targetUrl}.`);
      }

      const locationHeader = response.headers.get('location');
      if (!locationHeader) {
        throw new Error(`Redirect response (${response.status}) did not provide a Location header.`);
      }

      // Resolve relative redirect against current URL
      const nextUrl = new URL(locationHeader, currentUrl).href;

      // Validate the redirect destination against SSRF!
      currentUrl = await validateSafeUrl(nextUrl);
      continue;
    }

    // Response validation
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
      throw new Error(`Target returned non-HTML content type (${contentType || 'unknown'}). SiteSentry can only audit HTML web pages.`);
    }

    // Check Content-Length header if provided
    const contentLengthHeader = response.headers.get('content-length');
    if (contentLengthHeader && parseInt(contentLengthHeader, 10) > maxSizeBytes) {
      throw new Error(`Response size (${Math.round(parseInt(contentLengthHeader, 10) / 1024)} KB) exceeds the maximum limit of ${Math.round(maxSizeBytes / (1024 * 1024))} MB.`);
    }

    // Stream the body with a byte limit to guard against zip/compression bombs
    const reader = response.body.getReader();
    const chunks = [];
    let receivedBytes = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        receivedBytes += value.length;
        if (receivedBytes > maxSizeBytes) {
          reader.cancel();
          throw new Error(`Downloaded response exceeded safe limit of ${Math.round(maxSizeBytes / (1024 * 1024))} MB.`);
        }
        chunks.push(value);
      }
    } catch (streamErr) {
      throw streamErr;
    }

    const totalBuffer = Buffer.concat(chunks);
    const html = totalBuffer.toString('utf8');
    const loadTimeMs = Date.now() - startTime;

    return {
      ok: true,
      html,
      status: response.status,
      statusText: response.statusText,
      finalUrl: currentUrl,
      contentType,
      loadTimeMs,
      htmlSizeBytes: receivedBytes,
      headers: Object.fromEntries(response.headers.entries()),
    };
  }

  throw new Error(`Too many redirects encountered while reaching ${targetUrl}.`);
}

/**
 * Attaches request routing to Playwright pages to block internal/private SSRF requests
 * during headless browser automated accessibility and mobile emulation scans.
 */
export async function attachPlaywrightSsrfGuard(page) {
  await page.route('**/*', async (route) => {
    const request = route.request();
    const urlStr = request.url();

    try {
      const parsed = new URL(urlStr);

      // Permit safe data: and about: schemes
      if (parsed.protocol === 'data:' || parsed.protocol === 'about:') {
        return route.continue();
      }

      // Restrict protocol to HTTP / HTTPS
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return route.abort('blockedbyclient');
      }

      const hostname = parsed.hostname.toLowerCase();

      // Check denied hostname patterns
      for (const pattern of DENIED_HOSTNAMES) {
        if (pattern.test(hostname)) {
          return route.abort('blockedbyclient');
        }
      }

      // Check IP literals
      if (net.isIP(hostname)) {
        if (isPrivateIp(hostname)) {
          return route.abort('blockedbyclient');
        }
      }

      return route.continue();
    } catch {
      return route.abort('blockedbyclient');
    }
  });
}

