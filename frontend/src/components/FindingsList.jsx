import React, { useState, useMemo } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Info,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Search,
  Filter,
  Code2,
  Lightbulb,
  Sparkles,
  Bot,
  Copy,
  Check,
  Loader2,
} from 'lucide-react';
import { generateFindingAiFix } from '../services/api';

export default function FindingsList({
  auditId,
  findings = [],
  selectedCategory = 'all',
  onCategoryChange,
}) {
  const [selectedSeverity, setSelectedSeverity] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedIds, setExpandedIds] = useState(new Set());

  // AI Fix state per finding
  const [aiFixes, setAiFixes] = useState(() => {
    const initial = {};
    for (const f of findings) {
      if (f.aiFix?.code) {
        initial[f.id] = f.aiFix;
      }
    }
    return initial;
  });
  const [aiLoadingIds, setAiLoadingIds] = useState(new Set());
  const [copiedFixId, setCopiedFixId] = useState(null);

  const toggleExpand = (id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedIds(new Set(findings.map((f) => f.id)));
  };

  const collapseAll = () => {
    setExpandedIds(new Set());
  };

  const handleGenerateAiFix = async (finding) => {
    if (!auditId) return;
    try {
      setAiLoadingIds((prev) => new Set(prev).add(finding.id));
      const res = await generateFindingAiFix(auditId, finding.id);
      setAiFixes((prev) => ({
        ...prev,
        [finding.id]: res.aiFix,
      }));
    } catch (err) {
      alert(`AI Fix Error: ${err.message}`);
    } finally {
      setAiLoadingIds((prev) => {
        const next = new Set(prev);
        next.delete(finding.id);
        return next;
      });
    }
  };

  const copyCode = (findingId, code) => {
    navigator.clipboard.writeText(code);
    setCopiedFixId(findingId);
    setTimeout(() => setCopiedFixId(null), 2000);
  };

  // Filtered findings
  const filteredFindings = useMemo(() => {
    return findings.filter((f) => {
      if (selectedCategory !== 'all' && f.category !== selectedCategory) {
        return false;
      }
      if (selectedSeverity !== 'all' && f.severity !== selectedSeverity) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = f.title?.toLowerCase().includes(q);
        const matchesDesc = f.description?.toLowerCase().includes(q);
        const matchesEvidence = f.evidence?.toLowerCase().includes(q);
        const matchesRec = f.recommendation?.toLowerCase().includes(q);
        const matchesSelector = f.selector?.toLowerCase().includes(q);
        return matchesTitle || matchesDesc || matchesEvidence || matchesRec || matchesSelector;
      }
      return true;
    });
  }, [findings, selectedCategory, selectedSeverity, searchQuery]);

  // Counts for tabs
  const categoryCounts = useMemo(() => {
    return {
      all: findings.length,
      seo: findings.filter((f) => f.category === 'seo').length,
      accessibility: findings.filter((f) => f.category === 'accessibility').length,
      broken_links: findings.filter((f) => f.category === 'broken_links').length,
      mobile: findings.filter((f) => f.category === 'mobile').length,
    };
  }, [findings]);

  const severityCounts = useMemo(() => {
    return {
      all: findings.length,
      critical: findings.filter((f) => f.severity === 'critical').length,
      warning: findings.filter((f) => f.severity === 'warning').length,
      info: findings.filter((f) => f.severity === 'info').length,
      passed: findings.filter((f) => f.severity === 'passed').length,
    };
  }, [findings]);

  const severityBadge = (sev) => {
    switch (sev) {
      case 'critical':
        return {
          icon: AlertCircle,
          label: 'Critical',
          badgeClass: 'bg-status-error-bg text-status-error border-status-error-border',
        };
      case 'warning':
        return {
          icon: AlertTriangle,
          label: 'Warning',
          badgeClass: 'bg-status-warning-bg text-status-warning border-status-warning-border',
        };
      case 'info':
        return {
          icon: Info,
          label: 'Advisory',
          badgeClass: 'bg-status-info-bg text-status-info border-status-info-border',
        };
      case 'passed':
      default:
        return {
          icon: CheckCircle2,
          label: 'Passed',
          badgeClass: 'bg-status-success-bg text-status-success border-status-success-border',
        };
    }
  };

  const categoryLabel = (cat) => {
    switch (cat) {
      case 'seo':
        return 'SEO';
      case 'accessibility':
        return 'Accessibility';
      case 'broken_links':
        return 'Links';
      case 'mobile':
        return 'Mobile';
      default:
        return cat;
    }
  };

  return (
    <div className="space-y-4">
      {/* Category Tabs & Search Bar */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 p-2.5 rounded-lg bg-app-surface border border-app-border">
        {/* Category Filter Pills */}
        <div className="flex flex-wrap items-center gap-1">
          {[
            { id: 'all', label: 'All' },
            { id: 'seo', label: 'SEO' },
            { id: 'accessibility', label: 'Accessibility' },
            { id: 'broken_links', label: 'Links' },
            { id: 'mobile', label: 'Mobile' },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => onCategoryChange(cat.id)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors ${
                selectedCategory === cat.id
                  ? 'bg-app-raised text-text-primary border border-app-border'
                  : 'text-text-secondary hover:text-text-primary hover:bg-app-raised'
              }`}
            >
              <span>{cat.label}</span>
              <span
                className={`px-1 py-0.2 rounded text-[10px] font-mono ${
                  selectedCategory === cat.id
                    ? 'text-accent font-medium'
                    : 'text-text-tertiary'
                }`}
              >
                {categoryCounts[cat.id]}
              </span>
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative min-w-[240px]">
          <Search className="w-3.5 h-3.5 text-text-tertiary absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search findings or selectors..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-app-raised border border-app-border rounded-md pl-8 pr-3 py-1.5 text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent transition-colors font-mono"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-text-tertiary hover:text-text-secondary"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Severity Filter Pills & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs px-1">
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-text-tertiary font-mono mr-1 text-[11px] flex items-center gap-1">
            <Filter className="w-3 h-3" /> Severity:
          </span>
          {[
            { id: 'all', label: 'All', count: severityCounts.all },
            { id: 'critical', label: 'Critical', count: severityCounts.critical, color: 'text-status-error' },
            { id: 'warning', label: 'Warning', count: severityCounts.warning, color: 'text-status-warning' },
            { id: 'info', label: 'Advisory', count: severityCounts.info, color: 'text-status-info' },
            { id: 'passed', label: 'Passed', count: severityCounts.passed, color: 'text-status-success' },
          ].map((sev) => (
            <button
              key={sev.id}
              onClick={() => setSelectedSeverity(sev.id)}
              className={`px-2 py-0.5 rounded text-xs transition-colors flex items-center gap-1 ${
                selectedSeverity === sev.id
                  ? 'bg-app-raised text-text-primary border border-app-border'
                  : 'text-text-secondary hover:text-text-primary hover:bg-app-surface'
              }`}
            >
              <span className={sev.color || ''}>{sev.label}</span>
              <span className="font-mono text-[10px] text-text-tertiary">({sev.count})</span>
            </button>
          ))}
        </div>

        {/* Expand / Collapse All */}
        <div className="flex items-center gap-2 text-text-tertiary text-[11px]">
          <button
            onClick={expandAll}
            className="hover:text-text-secondary transition-colors"
          >
            Expand all
          </button>
          <span>•</span>
          <button
            onClick={collapseAll}
            className="hover:text-text-secondary transition-colors"
          >
            Collapse all
          </button>
        </div>
      </div>

      {/* Findings List Container */}
      <div className="space-y-2">
        {filteredFindings.length === 0 ? (
          <div className="p-8 text-center rounded-lg surface-card">
            <CheckCircle2 className="w-6 h-6 text-text-tertiary mx-auto mb-2" />
            <h4 className="text-xs font-medium text-text-secondary">No matching findings</h4>
            <p className="text-[11px] text-text-tertiary mt-0.5">
              No audit findings match the current filter or search criteria.
            </p>
          </div>
        ) : (
          filteredFindings.map((finding) => {
            const isExpanded = expandedIds.has(finding.id);
            const { icon: SeverityIcon, label: sevLabel, badgeClass } = severityBadge(
              finding.severity
            );
            const isAiLoading = aiLoadingIds.has(finding.id);
            const currentAiFix = aiFixes[finding.id];

            return (
              <div
                key={finding.id}
                className="rounded-lg surface-card border border-app-border overflow-hidden transition-colors"
              >
                {/* Header (Compact row) */}
                <div
                  onClick={() => toggleExpand(finding.id)}
                  className="p-3.5 flex items-center justify-between gap-3 cursor-pointer select-none hover:bg-app-raised/60 transition-colors"
                >
                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    <SeverityIcon className={`w-4 h-4 flex-shrink-0 ${
                      finding.severity === 'critical' ? 'text-status-error' :
                      finding.severity === 'warning' ? 'text-status-warning' :
                      finding.severity === 'passed' ? 'text-status-success' : 'text-status-info'
                    }`} />

                    <div className="flex flex-wrap items-center gap-2 min-w-0 flex-1">
                      <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded border ${badgeClass}`}>
                        {sevLabel}
                      </span>
                      <span className="text-[10px] font-mono text-text-tertiary px-1.5 py-0.2 rounded bg-app-raised border border-app-border">
                        {categoryLabel(finding.category)}
                      </span>
                      {finding.selector && (
                        <span className="hidden sm:inline-block text-[11px] font-mono text-text-tertiary bg-app-raised px-1.5 py-0.2 rounded border border-app-border truncate max-w-[200px]">
                          {finding.selector}
                        </span>
                      )}
                      <h4 className="text-xs font-medium text-text-primary truncate ml-0.5">
                        {finding.title}
                      </h4>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0 text-text-tertiary">
                    {currentAiFix && (
                      <span className="text-[10px] font-mono text-accent hidden sm:inline-block">
                        AI fix ready
                      </span>
                    )}
                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </div>
                </div>

                {/* Expanded Detail Panel */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-2 border-t border-app-border space-y-3 bg-app-surface text-xs">
                    {/* Description */}
                    <div>
                      <span className="text-[10px] font-mono uppercase tracking-wider text-text-tertiary block mb-1">
                        Explanation
                      </span>
                      <p className="text-text-secondary leading-relaxed font-normal">
                        {finding.description}
                      </p>
                    </div>

                    {/* Evidence Snippet */}
                    {finding.evidence && (
                      <div className="rounded-md bg-app-raised border border-app-border p-3 space-y-1.5">
                        <div className="flex items-center justify-between text-[11px] font-mono text-text-tertiary">
                          <span className="flex items-center gap-1">
                            <Code2 className="w-3.5 h-3.5 text-accent" />
                            Detected Evidence
                          </span>
                          {finding.selector && (
                            <span className="text-text-secondary">{finding.selector}</span>
                          )}
                        </div>
                        <pre className="font-mono text-[11px] text-text-primary overflow-x-auto whitespace-pre-wrap p-2 rounded bg-[#0A0C0E] border border-app-border">
                          {finding.evidence}
                        </pre>
                      </div>
                    )}

                    {/* Remediation Guide */}
                    <div className="rounded-md bg-app-raised border border-app-border p-3 space-y-2">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 text-text-primary text-[11px] font-medium">
                          <Lightbulb className="w-3.5 h-3.5 text-status-warning" />
                          <span>Recommended Fix</span>
                        </div>

                        {/* AI Code Fix button (only for non-passed items) */}
                        {finding.severity !== 'passed' && (
                          <button
                            onClick={() => handleGenerateAiFix(finding)}
                            disabled={isAiLoading}
                            className="flex items-center gap-1 px-2 py-1 rounded bg-app-surface hover:bg-app-overlay border border-app-border text-text-secondary hover:text-text-primary text-[10px] font-mono transition-colors disabled:opacity-50"
                          >
                            {isAiLoading ? (
                              <>
                                <Loader2 className="w-3 h-3 animate-spin text-accent" />
                                <span>Generating...</span>
                              </>
                            ) : currentAiFix ? (
                              <>
                                <Sparkles className="w-3 h-3 text-accent" />
                                <span>Re-generate AI Fix</span>
                              </>
                            ) : (
                              <>
                                <Bot className="w-3 h-3 text-accent" />
                                <span>AI Code Fix</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>

                      <p className="text-text-secondary leading-relaxed font-normal">
                        {finding.recommendation}
                      </p>

                      {/* Display Generated AI Code Fix */}
                      {currentAiFix && (
                        <div className="mt-2.5 p-3 rounded-md bg-[#0A0C0E] border border-app-border space-y-2">
                          <div className="flex items-center justify-between text-[11px] font-mono text-text-secondary pb-1.5 border-b border-app-border">
                            <span className="flex items-center gap-1.5 text-accent">
                              <Sparkles className="w-3 h-3" />
                              Gemini Solution ({currentAiFix.language || 'html'})
                            </span>
                            <button
                              onClick={() => copyCode(finding.id, currentAiFix.code)}
                              className="flex items-center gap-1 text-[10px] text-text-secondary hover:text-text-primary px-1.5 py-0.5 rounded bg-app-raised border border-app-border transition-colors"
                            >
                              {copiedFixId === finding.id ? (
                                <>
                                  <Check className="w-3 h-3 text-status-success" />
                                  <span className="text-status-success">Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" />
                                  <span>Copy</span>
                                </>
                              )}
                            </button>
                          </div>

                          <pre className="font-mono text-[11px] text-text-primary p-2 rounded bg-app-raised overflow-x-auto whitespace-pre-wrap">
                            {currentAiFix.code}
                          </pre>

                          {currentAiFix.explanation && (
                            <p className="text-[11px] text-text-secondary italic">
                              {currentAiFix.explanation}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
