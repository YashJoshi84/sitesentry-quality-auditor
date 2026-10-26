import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calculateAuditScores, DEFAULT_CATEGORY_WEIGHTS } from '../src/services/scoreCalculator.js';

describe('Scoring Engine Integrity & Correctness', () => {
  it('bounds: scores stay strictly between 0 and 100 even with extreme penalties', () => {
    // Generate dozens of critical defects
    const extremeFindings = [];
    for (let i = 0; i < 50; i++) {
      extremeFindings.push({
        id: `crit-${i}`,
        category: 'seo',
        severity: 'critical',
        title: `Catastrophic SEO failure ${i}`,
      });
      extremeFindings.push({
        id: `crit-a11y-${i}`,
        category: 'accessibility',
        severity: 'critical',
        title: `Catastrophic A11y failure ${i}`,
      });
    }

    const result = calculateAuditScores(extremeFindings, {
      seo: 'completed',
      accessibility: 'completed',
      mobile: 'completed',
      broken_links: 'completed',
    });

    assert.ok(result.scores.overall >= 0 && result.scores.overall <= 100);
    assert.equal(result.scores.seo, 0);
    assert.equal(result.scores.a11y, 0);
  });

  it('determinism: identical inputs produce identical scores across executions', () => {
    const findings = [
      { id: 'seo-h1', category: 'seo', severity: 'warning', title: 'Missing secondary heading' },
      { id: 'a11y-img', category: 'accessibility', severity: 'critical', title: 'Missing alt text' },
      { id: 'link-404', category: 'broken_links', severity: 'critical', title: 'Target not found 404' },
      { id: 'mobile-vp', category: 'mobile', severity: 'passed', title: 'Viewport configured' },
    ];

    const run1 = calculateAuditScores(findings);
    const run2 = calculateAuditScores(findings);
    const run3 = calculateAuditScores(findings);

    assert.deepEqual(run1.scores, run2.scores);
    assert.deepEqual(run2.scores, run3.scores);
    assert.deepEqual(run1.summary, run3.summary);
  });

  it('weights: applies 30% a11y, 25% seo, 25% mobile, 20% links correctly', () => {
    // Setup a scenario where:
    // a11y has 1 critical defect (-15) => score 85
    // seo has 0 defects => score 100
    // mobile has 0 defects => score 100
    // broken_links has 0 defects => score 100
    // Expected weighted score: (85 * 0.30) + (100 * 0.25) + (100 * 0.25) + (100 * 0.20)
    // = 25.5 + 25 + 25 + 20 = 95.5 => rounds to 96
    const findings = [
      { id: 'a11y-defect', category: 'accessibility', severity: 'critical', title: 'Color contrast issue' },
      { id: 'seo-pass', category: 'seo', severity: 'passed', title: 'Title valid' },
      { id: 'mobile-pass', category: 'mobile', severity: 'passed', title: 'Mobile viewport present' },
      { id: 'links-pass', category: 'broken_links', severity: 'passed', title: 'No broken links' },
    ];

    const result = calculateAuditScores(findings);

    assert.equal(result.scores.a11y, 85);
    assert.equal(result.scores.seo, 100);
    assert.equal(result.scores.mobileReadiness, 100);
    assert.equal(result.scores.brokenLinks, 100);
    assert.equal(result.scores.overall, 96);
  });

  it('severity impact: critical defects deduct more points than warnings, info deducts 0', () => {
    const infoOnly = calculateAuditScores([
      { id: 'inf-1', category: 'seo', severity: 'info', title: 'Informational note' },
    ], { seo: 'completed', accessibility: 'completed', mobile: 'completed', broken_links: 'completed' });

    const warningOnly = calculateAuditScores([
      { id: 'warn-1', category: 'seo', severity: 'warning', title: 'Minor meta issue' },
    ], { seo: 'completed', accessibility: 'completed', mobile: 'completed', broken_links: 'completed' });

    const criticalOnly = calculateAuditScores([
      { id: 'crit-1', category: 'seo', severity: 'critical', title: 'Missing title tag' },
    ], { seo: 'completed', accessibility: 'completed', mobile: 'completed', broken_links: 'completed' });

    // Info should not penalize
    assert.equal(infoOnly.scores.seo, 100);
    // Warning deducts 5 points
    assert.equal(warningOnly.scores.seo, 95);
    // Critical deducts 15 points
    assert.equal(criticalOnly.scores.seo, 85);

    assert.ok(infoOnly.scores.seo > warningOnly.scores.seo);
    assert.ok(warningOnly.scores.seo > criticalOnly.scores.seo);
  });

  it('deduplication: duplicate findings do not cause cumulative penalties', () => {
    const singleFinding = [
      { id: 'dup-1', category: 'seo', severity: 'critical', title: 'Duplicate title problem' },
    ];

    const duplicateFindings = [
      { id: 'dup-1', category: 'seo', severity: 'critical', title: 'Duplicate title problem' },
      { id: 'dup-1', category: 'seo', severity: 'critical', title: 'Duplicate title problem' },
      { id: 'dup-1', category: 'seo', severity: 'critical', title: 'Duplicate title problem' },
    ];

    const statuses = {
      seo: 'completed',
      accessibility: 'completed',
      mobile: 'completed',
      broken_links: 'completed',
    };

    const singleResult = calculateAuditScores(singleFinding, statuses);
    const dupResult = calculateAuditScores(duplicateFindings, statuses);

    assert.equal(singleResult.scores.seo, dupResult.scores.seo);
    assert.equal(dupResult.summary.totalChecks, 3);
    assert.equal(dupResult.summary.uniqueFindingsCount, 1);
  });

  it('honesty: missing or failed categories do not silently receive a 100', () => {
    // Only SEO was executed and succeeded, other 3 categories were not run or failed
    const partialFindings = [
      { id: 'seo-1', category: 'seo', severity: 'passed', title: 'Title verified' },
    ];

    const result = calculateAuditScores(partialFindings);

    // Categories with 0 findings and uncompleted status are scored 0/incomplete
    assert.equal(result.scores.seo, 100);
    assert.equal(result.scores.a11y, 0);
    assert.equal(result.scores.mobileReadiness, 0);
    assert.equal(result.scores.brokenLinks, 0);

    assert.equal(result.categoryDetails.accessibility.status, 'incomplete');
    // Overall score reflects that missing categories did not inflate the score
    assert.ok(result.scores.overall < 30, `Overall score ${result.scores.overall} was expected to be low for incomplete audit`);
  });

  it('clean fixture scores strictly better than defective fixture', () => {
    const cleanFindings = [
      { id: 's-1', category: 'seo', severity: 'passed', title: 'SEO clean' },
      { id: 'a-1', category: 'accessibility', severity: 'passed', title: 'A11y clean' },
      { id: 'm-1', category: 'mobile', severity: 'passed', title: 'Mobile clean' },
      { id: 'b-1', category: 'broken_links', severity: 'passed', title: 'Links clean' },
    ];

    const defectiveFindings = [
      { id: 's-1', category: 'seo', severity: 'critical', title: 'Missing title' },
      { id: 'a-1', category: 'accessibility', severity: 'critical', title: 'WCAG violation' },
      { id: 'm-1', category: 'mobile', severity: 'warning', title: 'Small tap targets' },
      { id: 'b-1', category: 'broken_links', severity: 'critical', title: 'Dead links' },
    ];

    const cleanResult = calculateAuditScores(cleanFindings);
    const defectiveResult = calculateAuditScores(defectiveFindings);
    assert.equal(cleanResult.scores.overall, 100);
    assert.ok(defectiveResult.scores.overall < 90);
    assert.ok(cleanResult.scores.overall > defectiveResult.scores.overall);
  });
});
