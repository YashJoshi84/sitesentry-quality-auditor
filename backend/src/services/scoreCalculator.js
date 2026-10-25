/**
 * Quality Score Calculator
 * Computes individual category scores (0-100) and weighted overall score.
 */

export function calculateAuditScores(allFindings) {
  const categoryScores = {
    seo: 100,
    accessibility: 100,
    broken_links: 100,
    mobile: 100,
  };

  const counts = {
    passed: 0,
    warning: 0,
    critical: 0,
    info: 0,
  };

  const categoryDeductions = {
    seo: 0,
    accessibility: 0,
    broken_links: 0,
    mobile: 0,
  };

  for (const finding of allFindings) {
    const cat = finding.category;
    const sev = finding.severity;

    if (sev === 'passed') {
      counts.passed++;
    } else if (sev === 'critical') {
      counts.critical++;
      categoryDeductions[cat] = (categoryDeductions[cat] || 0) + 22;
    } else if (sev === 'warning') {
      counts.warning++;
      categoryDeductions[cat] = (categoryDeductions[cat] || 0) + 8;
    } else if (sev === 'info') {
      counts.info++;
      categoryDeductions[cat] = (categoryDeductions[cat] || 0) + 1;
    }
  }

  // Calculate scores clamped between 0 and 100
  const seoScore = Math.max(0, Math.min(100, 100 - categoryDeductions.seo));
  const a11yScore = Math.max(0, Math.min(100, 100 - categoryDeductions.accessibility));
  const brokenLinksScore = Math.max(0, Math.min(100, 100 - categoryDeductions.broken_links));
  const mobileScore = Math.max(0, Math.min(100, 100 - categoryDeductions.mobile));

  // Weighted overall calculation:
  // SEO 30%, A11y 30%, Broken Links 20%, Mobile 20%
  const overallScore = Math.round(
    seoScore * 0.30 +
    a11yScore * 0.30 +
    brokenLinksScore * 0.20 +
    mobileScore * 0.20
  );

  return {
    scores: {
      overall: overallScore,
      seo: seoScore,
      a11y: a11yScore,
      brokenLinks: brokenLinksScore,
      mobileReadiness: mobileScore,
    },
    summary: {
      passedCount: counts.passed,
      warningCount: counts.warning,
      errorCount: counts.critical,
      totalChecks: allFindings.length,
    }
  };
}
