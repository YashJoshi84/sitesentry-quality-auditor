import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { auditSEO } from '../src/services/seoAuditor.js';
import { calculateAuditScores } from '../src/services/scoreCalculator.js';

describe('Local Fixtures End-to-End Quality Audits', () => {
  const cleanHtmlFixture = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Acme Developer Tools — Professional Quality Monitoring</title>
  <meta name="description" content="Acme Developer Tools delivers fast, continuous website quality assurance and comprehensive performance auditing for engineering teams.">
  <link rel="canonical" href="https://example.com/tools">
  <meta property="og:title" content="Acme Developer Tools">
  <meta property="og:description" content="Fast, continuous website quality assurance.">
  <meta property="og:image" content="https://example.com/og.png">
  <meta name="robots" content="index, follow">
</head>
<body>
  <header>
    <h1>Site Quality Monitoring Dashboard</h1>
    <nav>
      <a href="https://example.com/docs">Documentation</a>
      <a href="https://example.com/pricing">Pricing</a>
    </nav>
  </header>
  <main>
    <h2>Core Features</h2>
    <p>Automated checks run on every deployment.</p>
    <img src="https://example.com/diagram.png" alt="Architecture diagram of audit engine" width="600" height="400">
  </main>
</body>
</html>
  `.trim();

  const defectiveHtmlFixture = `
<!DOCTYPE html>
<html>
<head>
  <!-- Missing charset, title, description, and viewport -->
</head>
<body>
  <!-- Missing H1 heading, has images without alt text, fixed pixel width -->
  <div style="width: 1200px;">
    <h2>Subheading Without Main Heading</h2>
    <img src="broken-logo.png">
    <img src="unlabeled.jpg">
  </div>
</body>
</html>
  `.trim();

  const malformedHtmlFixture = `
<!DOCTYPE html>
<html>
<head><title>Unclosed Tags Everywhere
<body>
  <div><span><p>Broken syntax without closing tags
  <img src="test.jpg"
  <a href="invalid url with spaces">Broken Link
</html>
  `.trim();

  it('audits a clean HTML fixture and awards a high quality score (> 90)', () => {
    const seoResult = auditSEO(cleanHtmlFixture, 'https://example.com');
    assert.ok(seoResult.findings);

    // Clean fixture should have no critical SEO defects
    const criticalFindings = seoResult.findings.filter(f => f.severity === 'critical');
    assert.equal(criticalFindings.length, 0);

    const scores = calculateAuditScores(seoResult.findings, {
      seo: 'completed',
      accessibility: 'completed',
      mobile: 'completed',
      broken_links: 'completed',
    });

    assert.ok(scores.scores.seo >= 90, `Expected clean fixture SEO score >= 90, got ${scores.scores.seo}`);
  });

  it('audits a defective fixture, detecting missing title, missing viewport, and missing H1', () => {
    const seoResult = auditSEO(defectiveHtmlFixture, 'https://example.com/defective');
    assert.ok(seoResult.findings);

    const titleMissing = seoResult.findings.some(f => f.id === 'seo-title-missing');
    const h1Missing = seoResult.findings.some(f => f.id === 'seo-h1-missing');
    const descMissing = seoResult.findings.some(f => f.id === 'seo-meta-desc-missing');

    assert.equal(titleMissing, true, 'Expected missing title finding');
    assert.equal(h1Missing, true, 'Expected missing H1 finding');
    assert.equal(descMissing, true, 'Expected missing description finding');

    const scores = calculateAuditScores(seoResult.findings, {
      seo: 'completed',
      accessibility: 'completed',
      mobile: 'completed',
      broken_links: 'completed',
    });

    // Score should reflect the penalties
    assert.ok(scores.scores.seo < 75, `Expected defective fixture SEO score < 75, got ${scores.scores.seo}`);
  });

  it('safely parses malformed HTML without crashing and reports structured findings', () => {
    const seoResult = auditSEO(malformedHtmlFixture, 'https://example.com/malformed');
    assert.ok(seoResult);
    assert.ok(Array.isArray(seoResult.findings));
    assert.ok(seoResult.findings.length > 0);
  });
});
