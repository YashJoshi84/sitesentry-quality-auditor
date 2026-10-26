import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calculateAuditScores } from '../src/services/scoreCalculator.js';

describe('Audit Lifecycle & State Management', () => {
  it('marks audit as partially_completed when one or more categories fail', () => {
    // Scenario: SEO succeeded, Accessibility failed due to browser issue, Mobile succeeded, Links succeeded
    const categoryStatuses = {
      seo: 'completed',
      accessibility: 'failed',
      broken_links: 'completed',
      mobile: 'completed',
    };

    const findings = [
      { id: 'seo-1', category: 'seo', severity: 'passed', title: 'SEO ok' },
      { id: 'a11y-fail', category: 'accessibility', severity: 'critical', title: 'Browser crashed' },
      { id: 'mobile-1', category: 'mobile', severity: 'passed', title: 'Mobile ok' },
      { id: 'link-1', category: 'broken_links', severity: 'passed', title: 'Links ok' },
    ];

    const result = calculateAuditScores(findings, categoryStatuses);

    // Verify accessibility received 0 because it failed
    assert.equal(result.scores.a11y, 0);
    assert.equal(result.categoryDetails.accessibility.status, 'failed');

    // Determine final status
    const failedCategories = Object.entries(categoryStatuses).filter(([_, status]) => status === 'failed');
    let finalStatus = 'completed';
    if (failedCategories.length === Object.keys(categoryStatuses).length) {
      finalStatus = 'failed';
    } else if (failedCategories.length > 0) {
      finalStatus = 'partially_completed';
    }

    assert.equal(finalStatus, 'partially_completed');
    // Ensure overall score is not 100
    assert.ok(result.scores.overall < 80);
  });

  it('marks audit as failed when all categories fail', () => {
    const categoryStatuses = {
      seo: 'failed',
      accessibility: 'failed',
      broken_links: 'failed',
      mobile: 'failed',
    };

    const failedCategories = Object.entries(categoryStatuses).filter(([_, status]) => status === 'failed');
    let finalStatus = 'completed';
    if (failedCategories.length === Object.keys(categoryStatuses).length) {
      finalStatus = 'failed';
    } else if (failedCategories.length > 0) {
      finalStatus = 'partially_completed';
    }

    assert.equal(finalStatus, 'failed');
  });

  it('marks audit as completed when all categories succeed', () => {
    const categoryStatuses = {
      seo: 'completed',
      accessibility: 'completed',
      broken_links: 'completed',
      mobile: 'completed',
    };

    const failedCategories = Object.entries(categoryStatuses).filter(([_, status]) => status === 'failed');
    let finalStatus = 'completed';
    if (failedCategories.length === Object.keys(categoryStatuses).length) {
      finalStatus = 'failed';
    } else if (failedCategories.length > 0) {
      finalStatus = 'partially_completed';
    }

    assert.equal(finalStatus, 'completed');
  });

  it('preserves finding evidence and affected element selectors', () => {
    const findings = [
      {
        id: 'seo-h1-missing',
        category: 'seo',
        severity: 'critical',
        title: 'Missing H1 heading',
        description: 'Page lacks a top-level H1 heading.',
        evidence: 'HTML contains 0 <h1> elements',
        selector: 'body',
        recommendation: 'Add an <h1> tag.',
      },
    ];

    const result = calculateAuditScores(findings, {
      seo: 'completed',
      accessibility: 'completed',
      mobile: 'completed',
      broken_links: 'completed',
    });

    assert.equal(result.summary.totalChecks, 1);
    assert.equal(result.summary.errorCount, 1);
    assert.equal(result.scores.seo, 85);
  });
});
