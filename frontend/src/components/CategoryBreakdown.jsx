import React from 'react';
import { Search, Accessibility, Link2, Smartphone, ArrowRight, AlertTriangle, XCircle, CheckCircle2 } from 'lucide-react';

export default function CategoryBreakdown({ scores, summary, findings = [], onSelectCategory, selectedCategory }) {
  const getCategoryStats = (catKey) => {
    const catFindings = findings.filter(f => f.category === catKey);
    return {
      total: catFindings.length,
      errors: catFindings.filter(f => f.severity === 'critical').length,
      warnings: catFindings.filter(f => f.severity === 'warning').length,
      passed: catFindings.filter(f => f.severity === 'passed').length,
    };
  };

  const categories = [
    {
      key: 'seo',
      title: 'SEO & Metadata',
      score: scores?.seo ?? 0,
      icon: Search,
      weight: '25% Weight',
      desc: 'Title tags, meta descriptions, headings hierarchy, and canonical definitions.',
    },
    {
      key: 'accessibility',
      title: 'Axe Accessibility',
      score: scores?.a11y ?? 0,
      icon: Accessibility,
      weight: '30% Weight',
      desc: 'WCAG 2.1 compliance, form labels, button text, and ARIA roles.',
    },
    {
      key: 'broken_links',
      title: 'Hyperlinks',
      score: scores?.brokenLinks ?? 0,
      icon: Link2,
      weight: '20% Weight',
      desc: 'Internal and external link health, HTTP status codes, and connectivity.',
    },
    {
      key: 'mobile',
      title: 'Mobile Readiness',
      score: scores?.mobileReadiness ?? 0,
      icon: Smartphone,
      weight: '25% Weight',
      desc: 'Viewport configuration, layout overflow detection, and fluid indicators.',
    },
  ];

  const getScoreStyle = (score) => {
    if (score >= 80) return 'text-status-success border-status-success-border bg-status-success-bg';
    if (score >= 60) return 'text-status-warning border-status-warning-border bg-status-warning-bg';
    return 'text-status-error border-status-error-border bg-status-error-bg';
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {categories.map((cat) => {
        const stats = getCategoryStats(cat.key);
        const Icon = cat.icon;
        const isSelected = selectedCategory === cat.key;
        const scoreStyle = getScoreStyle(cat.score);

        return (
          <div
            key={cat.key}
            onClick={() => onSelectCategory(isSelected ? 'all' : cat.key)}
            className={`cursor-pointer rounded-lg p-4 border transition-colors select-none flex flex-col justify-between ${
              isSelected
                ? 'border-text-primary bg-app-raised shadow-subtle'
                : 'bg-app-surface border-app-border hover:border-app-border-hover'
            }`}
          >
            <div>
              {/* Header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded bg-app-raised border border-app-border text-text-primary">
                    <Icon className="w-3.5 h-3.5 text-text-primary" />
                  </div>
                  <div>
                    <h3 className="font-medium text-text-primary text-xs">{cat.title}</h3>
                    <span className="text-[10px] text-text-tertiary font-mono">{cat.weight}</span>
                  </div>
                </div>

                {/* Score Chip */}
                <div className={`px-2 py-0.5 rounded text-xs font-mono font-medium border ${scoreStyle}`}>
                  {cat.score}
                </div>
              </div>

              {/* Description */}
              <p className="text-[11px] text-text-secondary line-clamp-2 mb-3 leading-relaxed">
                {cat.desc}
              </p>
            </div>

            {/* Metric counters */}
            <div className="flex items-center justify-between pt-2.5 border-t border-app-border text-[11px] font-mono">
              <div className="flex items-center gap-2.5">
                <span className="flex items-center gap-1 text-status-error" title="Critical Errors">
                  <XCircle className="w-3 h-3" />
                  {stats.errors}
                </span>
                <span className="flex items-center gap-1 text-status-warning" title="Warnings">
                  <AlertTriangle className="w-3 h-3" />
                  {stats.warnings}
                </span>
                <span className="flex items-center gap-1 text-status-success" title="Passed Checks">
                  <CheckCircle2 className="w-3 h-3" />
                  {stats.passed}
                </span>
              </div>

              <span className={`flex items-center gap-1 font-sans text-[11px] transition-colors ${isSelected ? 'text-text-primary font-medium' : 'text-text-tertiary'}`}>
                {isSelected ? 'Filtered' : 'Filter'}
                <ArrowRight className="w-3 h-3" />
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
