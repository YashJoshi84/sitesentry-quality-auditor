import React, { useState, useEffect } from 'react';
import {
  FileJson,
  FileSpreadsheet,
  RotateCw,
  ArrowLeft,
  ExternalLink,
  Clock,
  Layers,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Copy,
  Check,
  Sparkles,
  Bot,
  Loader2,
  CheckCheck,
} from 'lucide-react';
import ScoreGauge from './ScoreGauge';
import CategoryBreakdown from './CategoryBreakdown';
import FindingsList from './FindingsList';
import LinksTable from './LinksTable';
import { fetchAuditById, getExportUrl, generateAiBrief } from '../services/api';

export default function ReportView({
  auditId,
  onBack,
  onReAudit,
}) {
  const [audit, setAudit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState('findings'); // 'findings' | 'links'

  // Gemini AI state
  const [aiBrief, setAiBrief] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);

  const loadReport = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchAuditById(auditId);
      setAudit(data);
      if (data.aiExecutiveBrief?.summary) {
        setAiBrief(data.aiExecutiveBrief);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (auditId) {
      loadReport();
    }
  }, [auditId]);

  const handleGenerateAiBrief = async () => {
    try {
      setAiLoading(true);
      setAiError(null);
      const res = await generateAiBrief(auditId);
      setAiBrief(res.aiExecutiveBrief);
    } catch (err) {
      setAiError(err.message || 'Failed to generate AI brief');
    } finally {
      setAiLoading(false);
    }
  };

  const copyUrl = () => {
    if (audit?.url) {
      navigator.clipboard.writeText(audit.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-24 text-center">
        <div className="w-8 h-8 rounded-md bg-app-surface border border-app-border flex items-center justify-center mx-auto mb-3 animate-spin text-text-primary">
          <RotateCw className="w-4 h-4" />
        </div>
        <h2 className="text-sm font-medium text-text-primary">Loading Audit Report</h2>
        <p className="text-xs text-text-tertiary mt-1 font-mono">Retrieving report from MongoDB...</p>
      </div>
    );
  }

  if (error || !audit) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center space-y-4">
        <div className="p-4 rounded-lg bg-status-error-bg border border-status-error-border text-status-error text-xs">
          <p className="font-medium">Failed to load report</p>
          <p className="mt-0.5 text-text-secondary">{error || 'Report not found'}</p>
        </div>
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-app-surface border border-app-border text-xs text-text-secondary hover:text-text-primary transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to History
        </button>
      </div>
    );
  }

  const { scores, summary, meta, findings = [], checkedLinks = [] } = audit;

  const formatDate = (dateStr) => {
    try {
      return new Date(dateStr).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Top Navigation & Actions Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-app-border">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back</span>
        </button>

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => onReAudit(audit.url)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-app-surface hover:bg-app-raised border border-app-border hover:border-app-border-hover text-text-secondary hover:text-text-primary text-xs font-medium transition-colors"
          >
            <RotateCw className="w-3.5 h-3.5 text-text-primary" />
            <span>Re-Audit</span>
          </button>

          <a
            href={getExportUrl(audit._id, 'json')}
            download
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-app-surface hover:bg-app-raised border border-app-border hover:border-app-border-hover text-text-secondary hover:text-text-primary text-xs font-medium transition-colors"
          >
            <FileJson className="w-3.5 h-3.5 text-text-primary" />
            <span>JSON</span>
          </a>

          <a
            href={getExportUrl(audit._id, 'csv')}
            download
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-app-surface hover:bg-app-raised border border-app-border hover:border-app-border-hover text-text-secondary hover:text-text-primary text-xs font-medium transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-status-success" />
            <span>CSV</span>
          </a>
        </div>
      </div>

      {/* Partial Scan Notice Banner */}
      {audit.status === 'partially_completed' && (
        <div className="p-3.5 rounded-md bg-status-warning-bg border border-status-warning-border text-xs text-status-warning flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-medium text-text-primary">Partial Scan Coverage</p>
            <p className="text-text-secondary">
              One or more audit categories could not complete due to target server restrictions or scanner timeouts. The reported score reflects verified checks only and does not award unearned points for incomplete sections.
            </p>
          </div>
        </div>
      )}

      {/* Main Overview Banner */}
      <div className="surface-card p-6 border border-app-border">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          {/* Target Metadata */}
          <div className="space-y-3 flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded border border-app-border bg-app-raised text-text-secondary">
                Audit Summary
              </span>
              <span className="flex items-center gap-1 text-text-tertiary">
                <Calendar className="w-3 h-3" />
                {formatDate(audit.createdAt)}
              </span>
              {meta?.auditDurationMs && (
                <span className="flex items-center gap-1 text-text-tertiary font-mono">
                  <Clock className="w-3 h-3" />
                  {(meta.auditDurationMs / 1000).toFixed(1)}s
                </span>
              )}
            </div>

            <div>
              <h1 className="text-xl sm:text-2xl font-medium text-text-primary tracking-tight truncate">
                {meta?.pageTitle || audit.domain}
              </h1>

              <div className="flex items-center gap-2 mt-1">
                <a
                  href={audit.url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-xs text-text-primary hover:underline hover:text-white flex items-center gap-1 truncate max-w-md"
                >
                  <span className="truncate">{audit.url}</span>
                  <ExternalLink className="w-3 h-3 flex-shrink-0" />
                </a>

                <button
                  onClick={copyUrl}
                  className="p-1 rounded text-text-tertiary hover:text-text-primary transition-colors"
                  title="Copy URL"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-status-success" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Technical Specs Tags */}
            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs font-mono text-text-secondary">
              <span className="px-2 py-0.5 rounded bg-app-raised border border-app-border text-[11px]">
                HTTP {meta?.httpStatus || 200}
              </span>
              {meta?.loadTimeMs && (
                <span className="px-2 py-0.5 rounded bg-app-raised border border-app-border text-[11px]">
                  {meta.loadTimeMs}ms latency
                </span>
              )}
              {meta?.htmlSizeBytes && (
                <span className="px-2 py-0.5 rounded bg-app-raised border border-app-border text-[11px]">
                  {(meta.htmlSizeBytes / 1024).toFixed(1)} KB
                </span>
              )}
              {meta?.imagesCount && (
                <span className="px-2 py-0.5 rounded bg-app-raised border border-app-border text-[11px]">
                  {meta.imagesCount.total} images ({meta.imagesCount.missingAlt} no alt)
                </span>
              )}
            </div>
          </div>

          {/* Minimalist Score Gauge */}
          <div className="flex-shrink-0 self-center lg:self-auto">
            <ScoreGauge score={scores?.overall || 0} size={140} strokeWidth={8} />
          </div>
        </div>

        {/* Counts summary bar */}
        <div className="mt-6 pt-4 border-t border-app-border grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <div className="p-2.5 rounded-md bg-app-raised border border-app-border">
            <span className="text-[10px] font-mono uppercase tracking-wider text-status-success block">
              Passed Checks
            </span>
            <span className="text-xl font-mono font-medium text-text-primary mt-0.5 block">
              {summary?.passedCount ?? 0}
            </span>
          </div>

          <div className="p-2.5 rounded-md bg-app-raised border border-app-border">
            <span className="text-[10px] font-mono uppercase tracking-wider text-status-warning block">
              Warnings
            </span>
            <span className="text-xl font-mono font-medium text-text-primary mt-0.5 block">
              {summary?.warningCount ?? 0}
            </span>
          </div>

          <div className="p-2.5 rounded-md bg-app-raised border border-app-border">
            <span className="text-[10px] font-mono uppercase tracking-wider text-status-error block">
              Critical Errors
            </span>
            <span className="text-xl font-mono font-medium text-text-primary mt-0.5 block">
              {summary?.errorCount ?? 0}
            </span>
          </div>

          <div className="p-2.5 rounded-md bg-app-raised border border-app-border">
            <span className="text-[10px] font-mono uppercase tracking-wider text-text-secondary block">
              Total Inspected
            </span>
            <span className="text-xl font-mono font-medium text-text-primary mt-0.5 block">
              {summary?.totalChecks ?? 0}
            </span>
          </div>
        </div>
      </div>

      {/* Gemini AI Executive Brief (Quiet, elegant developer card) */}
      <div className="surface-card p-5 border border-app-border space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-app-border">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-app-raised border border-app-border flex items-center justify-center text-text-primary">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-medium text-text-primary text-xs">Gemini Executive Brief</h3>
                <span className="text-[10px] font-mono text-text-tertiary px-1.5 py-0.2 rounded border border-app-border bg-app-raised">
                  gemini-3.5-flash-lite
                </span>
                {aiBrief && (
                  <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-mono text-status-success px-1.5 py-0.2 rounded bg-status-success-bg border border-status-success-border">
                    <CheckCheck className="w-3 h-3" /> Cached
                  </span>
                )}
              </div>
              <p className="text-[11px] text-text-secondary mt-0.5">
                AI synthesis of root architectural weaknesses and prioritized action items.
              </p>
            </div>
          </div>

          {/* Action Button */}
          {!aiBrief && (
            <button
              onClick={handleGenerateAiBrief}
              disabled={aiLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-app-raised hover:bg-app-overlay border border-app-border text-text-primary text-xs font-medium transition-colors disabled:opacity-50"
            >
              {aiLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-text-primary" />
                  <span>Synthesizing...</span>
                </>
              ) : (
                <>
                  <Bot className="w-3.5 h-3.5 text-text-primary" />
                  <span>Generate Brief</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* AI Error message */}
        {aiError && (
          <div className="p-3 rounded-md bg-status-error-bg border border-status-error-border text-status-error text-xs">
            {aiError}
          </div>
        )}

        {/* Generated Brief Content */}
        {aiBrief ? (
          <div className="space-y-3.5 text-xs">
            {/* Plain English Summary */}
            <div className="p-3.5 rounded-md bg-app-raised border border-app-border text-text-secondary leading-relaxed font-normal">
              <span className="text-[10px] font-mono uppercase tracking-wider text-text-primary font-medium block mb-1">
                Executive Synthesis
              </span>
              <p>{aiBrief.summary}</p>
            </div>

            {/* Recommendations & Est. Time */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2 space-y-1.5">
                <span className="text-[10px] font-mono uppercase tracking-wider text-text-tertiary block">
                  Priority Action Items
                </span>
                <div className="space-y-1.5">
                  {(aiBrief.topRecommendations || []).map((rec, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-text-secondary p-2 rounded-md bg-app-raised border border-app-border">
                      <span className="w-4 h-4 rounded bg-app-surface border border-app-border text-text-tertiary text-[10px] font-mono font-medium flex items-center justify-center flex-shrink-0 mt-0.5">
                        {i + 1}
                      </span>
                      <span>{rec}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Time Estimate Box */}
              <div className="p-3.5 rounded-md bg-app-raised border border-app-border flex flex-col justify-center text-center">
                <span className="text-[10px] font-mono uppercase tracking-wider text-text-tertiary">
                  Estimated Effort
                </span>
                <span className="text-base font-mono font-medium text-text-primary mt-1">
                  {aiBrief.estimatedFixTime || '2–4 Hours'}
                </span>
                <span className="text-[10px] text-text-tertiary mt-0.5">
                  To address major items
                </span>
              </div>
            </div>
          </div>
        ) : !aiLoading && (
          <p className="text-xs text-text-tertiary italic">
            Click "Generate Brief" for an automated executive review of {audit.domain}.
          </p>
        )}
      </div>

      {/* Category Breakdown Cards */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-text-primary" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-text-secondary font-mono">
              Category Breakdown
            </h2>
          </div>
          <span className="text-[11px] text-text-tertiary">Select card to filter findings</span>
        </div>

        <CategoryBreakdown
          scores={scores}
          summary={summary}
          findings={findings}
          selectedCategory={selectedCategory}
          onSelectCategory={(cat) => setSelectedCategory(cat)}
        />
      </div>

      {/* Content Section Tabs: Findings vs Checked Links */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center gap-2 border-b border-app-border pb-2">
          <button
            onClick={() => setActiveTab('findings')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeTab === 'findings'
                ? 'bg-app-raised text-text-primary border border-app-border'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <span>Findings</span>
            <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-app-surface text-text-tertiary border border-app-border">
              {findings.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('links')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeTab === 'links'
                ? 'bg-app-raised text-text-primary border border-app-border'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <span>Verified Links</span>
            <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-app-surface text-text-tertiary border border-app-border">
              {checkedLinks.length}
            </span>
          </button>
        </div>

        {/* Tab 1: Findings List */}
        {activeTab === 'findings' && (
          <FindingsList
            auditId={audit._id}
            findings={findings}
            selectedCategory={selectedCategory}
            onCategoryChange={(cat) => setSelectedCategory(cat)}
          />
        )}

        {/* Tab 2: Hyperlinks Verification Table */}
        {activeTab === 'links' && (
          <LinksTable checkedLinks={checkedLinks} />
        )}
      </div>
    </div>
  );
}
