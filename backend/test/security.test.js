import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateSafeUrl, isPrivateIp } from '../src/services/ssrfProtection.js';
import { createRateLimiter } from '../src/middleware/rateLimiter.js';

describe('SSRF Protection & URL Validation', () => {
  describe('Private and Reserved IP Detection', () => {
    it('detects IPv4 loopback (127.0.0.1, 127.12.34.56)', () => {
      assert.equal(isPrivateIp('127.0.0.1'), true);
      assert.equal(isPrivateIp('127.0.0.254'), true);
      assert.equal(isPrivateIp('127.255.255.255'), true);
    });

    it('detects private Class A (10.0.0.0/8)', () => {
      assert.equal(isPrivateIp('10.0.0.1'), true);
      assert.equal(isPrivateIp('10.254.1.99'), true);
    });

    it('detects private Class B (172.16.0.0/12)', () => {
      assert.equal(isPrivateIp('172.16.0.1'), true);
      assert.equal(isPrivateIp('172.24.10.5'), true);
      assert.equal(isPrivateIp('172.31.255.255'), true);
      // 172.32.0.1 is public
      assert.equal(isPrivateIp('172.32.0.1'), false);
    });

    it('detects private Class C (192.168.0.0/16)', () => {
      assert.equal(isPrivateIp('192.168.1.1'), true);
      assert.equal(isPrivateIp('192.168.100.200'), true);
    });

    it('detects Link-Local / AWS/GCP Metadata (169.254.0.0/16)', () => {
      assert.equal(isPrivateIp('169.254.169.254'), true);
      assert.equal(isPrivateIp('169.254.1.1'), true);
    });

    it('detects IPv6 loopback and unique local/link-local', () => {
      assert.equal(isPrivateIp('::1'), true);
      assert.equal(isPrivateIp('fe80::1'), true);
      assert.equal(isPrivateIp('fc00::1'), true);
      assert.equal(isPrivateIp('fd12:3456::1'), true);
    });

    it('allows public IPv4 addresses', () => {
      assert.equal(isPrivateIp('8.8.8.8'), false);
      assert.equal(isPrivateIp('1.1.1.1'), false);
      assert.equal(isPrivateIp('93.184.216.34'), false);
    });
  });

  describe('validateSafeUrl', () => {
    it('rejects loopback addresses and hostnames', async () => {
      await assert.rejects(
        () => validateSafeUrl('http://127.0.0.1:8080'),
        /loopback|private|blocked|forbidden/i
      );
      await assert.rejects(
        () => validateSafeUrl('http://localhost:5001'),
        /loopback|private|blocked|forbidden/i
      );
    });

    it('rejects AWS/GCP cloud metadata endpoints', async () => {
      await assert.rejects(
        () => validateSafeUrl('http://169.254.169.254/latest/meta-data'),
        /cloud metadata|private|blocked|forbidden/i
      );
      await assert.rejects(
        () => validateSafeUrl('http://metadata.google.internal/computeMetadata/v1/'),
        /cloud metadata|private|internal|blocked|forbidden/i
      );
    });

    it('rejects private IPv4 networks', async () => {
      await assert.rejects(
        () => validateSafeUrl('http://10.0.0.5/admin'),
        /private|blocked|forbidden/i
      );
      await assert.rejects(
        () => validateSafeUrl('http://192.168.1.1/router'),
        /private|blocked|forbidden/i
      );
      await assert.rejects(
        () => validateSafeUrl('http://172.20.0.10:3000'),
        /private|blocked|forbidden/i
      );
    });

    it('rejects non-HTTP protocols', async () => {
      await assert.rejects(
        () => validateSafeUrl('file:///etc/passwd'),
        /http and https|protocol/i
      );
      await assert.rejects(
        () => validateSafeUrl('ftp://ftp.example.com/test'),
        /http and https|protocol/i
      );
      await assert.rejects(
        () => validateSafeUrl('javascript:alert(1)'),
        /http and https|protocol/i
      );
    });

    it('validates and returns sanitized URL string for safe public targets', async () => {
      const result = await validateSafeUrl('https://example.com');
      assert.equal(typeof result, 'string');
      assert.ok(result.startsWith('https://example.com'));
    });
  });
});

describe('Rate Limiter Middleware', () => {
  it('allows requests within threshold and blocks requests over limit', () => {
    const limiter = createRateLimiter({
      windowMs: 1000,
      max: 3,
      message: 'Rate limit test hit',
      keyPrefix: 'unit-test',
    });

    const mockReq = {
      ip: '198.51.100.42',
      headers: {},
      socket: {},
    };

    const headers = {};
    const mockRes = {
      setHeader(name, val) {
        headers[name] = val;
      },
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.body = data;
        return this;
      },
    };

    let nextCalled = 0;
    const next = () => { nextCalled++; };

    // Request 1: Allow
    limiter(mockReq, mockRes, next);
    assert.equal(nextCalled, 1);
    assert.equal(headers['RateLimit-Remaining'], 2);

    // Request 2: Allow
    limiter(mockReq, mockRes, next);
    assert.equal(nextCalled, 2);
    assert.equal(headers['RateLimit-Remaining'], 1);

    // Request 3: Allow
    limiter(mockReq, mockRes, next);
    assert.equal(nextCalled, 3);
    assert.equal(headers['RateLimit-Remaining'], 0);

    // Request 4: Block with 429
    limiter(mockReq, mockRes, next);
    assert.equal(nextCalled, 3); // next was NOT called
    assert.equal(mockRes.statusCode, 429);
    assert.equal(mockRes.body.success, false);
    assert.equal(mockRes.body.error, 'Rate limit test hit');
  });
});
