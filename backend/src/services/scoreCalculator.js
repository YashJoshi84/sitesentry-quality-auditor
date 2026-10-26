/**
 * Quality Score Calculator
 * Deterministic, explainable scoring engine with configurable category weights,
 * defect deduplication, and honest missing/failed category tracking.
 */

export const DEFAULT_CATEGORY_WEIGHTS = {
  accessibility: 0.30,
  seo: 0.25,
  mobile: 0.25,
  broken_links: 0.20,
};

export const SEVERITY_DEDUCTIONS = {
  critical: 15, // Severe defect with direct user or search penalty
  warning: 5,   // Moderate issue or deviation from standard best practices
  info: 0,      // Informational observation; does not deduct score
  passed: 0,    // Successful verification
};

export function calculateAuditScores(allFindings = [], categoryStatuses = {}) {
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

  const findingsPerCategory = {
    seo: 0,
    accessibility: 0,
    broken_links: 0,
    mobile: 0,
  };

  // Set to track and deduplicate findings by unique signature
  const seenFindingSignatures = new Set();
  const deduplicatedFindings = [];

  for (const finding of allFindings) {
    if (!finding || typeof finding !== 'object') continue;

    const cat = finding.category;
    if (!categoryDeductions.hasOwnProperty(cat)) continue;

    findingsPerCategory[cat]++;

    // Create unique signature to deduplicate equivalent findings
    const signature = `${cat}:${finding.id || ''}:${finding.title || ''}`.toLowerCase();

    if (seenFindingSignatures.has(signature)) {
      // Duplicate finding: record in total checks count but skip penalty deduction
      continue;
    }
    seenFindingSignatures.add(signature);
    deduplicatedFindings.push(finding);

    const sev = finding.severity;
    if (sev === 'passed') {
      counts.passed++;
    } else if (sev === 'critical') {
      counts.critical++;
      categoryDeductions[cat] += SEVERITY_DEDUCTIONS.critical;
    } else if (sev === 'warning') {
      counts.warning++;
      categoryDeductions[cat] += SEVERITY_DEDUCTIONS.warning;
    } else if (sev === 'info') {
      counts.info++;
      categoryDeductions[cat] += SEVERITY_DEDUCTIONS.info;
    }
  }

  // Determine individual category scores and execution status
  // Missing or failed categories MUST NOT receive a 100
  const evaluateCategory = (catKey) => {
    const explicitStatus = categoryStatuses[catKey];
    const findingCount = findingsPerCategory[catKey];

    if (explicitStatus === 'failed') {
      return { score: 0, status: 'failed', deductions: 100 };
    }

    if (explicitStatus === 'skipped') {
      return { score: null, status: 'skipped', deductions: 0 };
    }

    // If an explicit status was not given but 0 findings exist for the category,
    // mark as incomplete/failed rather than silently awarding a perfect 100!
    if (findingCount === 0 && !explicitStatus) {
      return { score: 0, status: 'incomplete', deductions: 100 };
    }

    const score = Math.max(0, Math.min(100, 100 - categoryDeductions[catKey]));
    const status = explicitStatus || 'completed';
    return { score, status, deductions: categoryDeductions[catKey] };
  };

  const seoEval = evaluateCategory('seo');
  const a11yEval = evaluateCategory('accessibility');
  const linkEval = evaluateCategory('broken_links');
  const mobileEval = evaluateCategory('mobile');

  // Weighted overall calculation
  // Uses product default weights: Accessibility 30%, SEO 25%, Mobile 25%, Broken Links 20%
  let activeWeightTotal = 0;
  let weightedScoreSum = 0;

  const categories = [
    { key: 'accessibility', eval: a11yEval, weight: DEFAULT_CATEGORY_WEIGHTS.accessibility },
    { key: 'seo', eval: seoEval, weight: DEFAULT_CATEGORY_WEIGHTS.seo },
    { key: 'mobile', eval: mobileEval, weight: DEFAULT_CATEGORY_WEIGHTS.mobile },
    { key: 'broken_links', eval: linkEval, weight: DEFAULT_CATEGORY_WEIGHTS.broken_links },
  ];

  for (const c of categories) {
    if (c.eval.status === 'skipped') {
      // Skipped category is omitted from active weights
      continue;
    }
    activeWeightTotal += c.weight;
    weightedScoreSum += (c.eval.score || 0) * c.weight;
  }

  const overallScore = activeWeightTotal > 0
    ? Math.max(0, Math.min(100, Math.round(weightedScoreSum / activeWeightTotal)))
    : 0;

  return {
    scores: {
      overall: overallScore,
      seo: seoEval.score,
      a11y: a11yEval.score,
      brokenLinks: linkEval.score,
      mobileReadiness: mobileEval.score,
    },
    categoryDetails: {
      seo: seoEval,
      accessibility: a11yEval,
      broken_links: linkEval,
      mobile: mobileEval,
    },
    summary: {
      passedCount: counts.passed,
      warningCount: counts.warning,
      errorCount: counts.critical,
      totalChecks: allFindings.length,
      uniqueFindingsCount: deduplicatedFindings.length,
    }
  };
}
