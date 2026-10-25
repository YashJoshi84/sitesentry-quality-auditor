import React, { useState } from 'react';
import {
  Globe,
  ArrowRight,
  Search,
  Accessibility,
  Link2,
  Smartphone,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Terminal,
  FileSpreadsheet,
  Cpu,
} from 'lucide-react';

const SAMPLE_URLS = [
  { label: 'Example.com', url: 'https://example.com' },
  { label: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/Web_accessibility' },
  { label: 'Hacker News', url: 'https://news.ycombinator.com' },
  { label: 'W3C Web Standards', url: 'https://www.w3.org' },
];

export default function LandingPage({ onStartAudit, loading }) {
  const [inputUrl, setInputUrl] = useState('');
  const [validationError, setValidationError] = useState('');

  const handleSubmit = (e) => {
    e?.preventDefault();
    setValidationError('');

    const trimmed = inputUrl.trim();
    if (!trimmed) {
      setValidationError('Please enter a website URL to audit.');
      return;
    }

    onStartAudit(trimmed);
  };

  const selectSample = (url) => {
    setInputUrl(url);
    setValidationError('');
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-16 sm:py-20 space-y-20">
      {/* Hero Section */}
      <section className="text-center space-y-6 max-w-2xl mx-auto">
        <div className="space-y-3">
          <h1 className="text-3xl sm:text-4xl font-medium tracking-tight text-text-primary leading-tight">
            Understand your website's quality.
          </h1>
          <p className="text-sm sm:text-base text-text-secondary leading-relaxed font-normal">
            Automated quality inspection for SEO metadata, WCAG accessibility, broken links, and mobile viewport readiness.
          </p>
        </div>

        {/* URL Input Form (Focal Point) */}
        <form onSubmit={handleSubmit} className="pt-3">
          <div className="relative flex flex-col sm:flex-row items-stretch sm:items-center rounded-lg bg-app-surface border border-app-border p-1.5 focus-within:border-text-primary focus-within:ring-1 focus-within:ring-[#484E50] transition-all shadow-subtle">
            <div className="relative flex-1 flex items-center pl-2.5">
              <Globe className="w-4 h-4 text-text-tertiary flex-shrink-0" />
              <input
                type="text"
                value={inputUrl}
                onChange={(e) => {
                  setInputUrl(e.target.value);
                  if (validationError) setValidationError('');
                }}
                placeholder="https://example.com"
                disabled={loading}
                className="w-full bg-transparent px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none font-mono"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 sm:mt-0 flex items-center justify-center gap-1.5 px-4 py-2 rounded-md bg-[#E6E8E6] hover:bg-white text-[#17191B] text-xs font-medium transition-colors disabled:opacity-40 flex-shrink-0 shadow-subtle"
            >
              <span>{loading ? 'Starting scan...' : 'Run Audit'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Validation error */}
          {validationError && (
            <div className="mt-2.5 flex items-center justify-center gap-1.5 text-xs text-status-error font-normal">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          {/* Sample URL Controls */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5 text-xs">
            <span className="text-text-tertiary mr-1">Sample targets:</span>
            {SAMPLE_URLS.map((sample, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => selectSample(sample.url)}
                className="px-2.5 py-1 rounded-md bg-app-surface hover:bg-app-raised border border-app-border hover:border-app-border-hover text-text-secondary hover:text-text-primary text-[11px] font-mono transition-colors"
              >
                {sample.label}
              </button>
            ))}
          </div>
        </form>
      </section>

      {/* Capabilities Section (Clean structured grid) */}
      <section className="space-y-6 pt-4 border-t border-app-border">
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-text-tertiary font-mono">
            Inspection Capabilities
          </h2>
          <span className="text-xs text-text-secondary">
            Continuous standards-based automated checks
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* SEO & Metadata */}
          <div className="surface-card p-5 space-y-3">
            <div className="w-8 h-8 rounded-md bg-app-raised border border-app-border flex items-center justify-center text-text-primary">
              <Search className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-medium text-text-primary text-sm">SEO & Metadata</h3>
              <p className="text-xs text-text-secondary mt-1 leading-relaxed">
                Evaluates title tags, meta descriptions, single primary H1 hierarchy, canonical declarations, and image alt attributes.
              </p>
            </div>
            <div className="pt-2 border-t border-app-border text-[11px] text-text-secondary space-y-1 font-mono">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3 h-3 text-status-success flex-shrink-0" />
                <span>Title & description lengths</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3 h-3 text-status-success flex-shrink-0" />
                <span>Heading outline structure</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3 h-3 text-status-success flex-shrink-0" />
                <span>Canonical & open graph tags</span>
              </div>
            </div>
          </div>

          {/* axe-core Accessibility */}
          <div className="surface-card p-5 space-y-3">
            <div className="w-8 h-8 rounded-md bg-app-raised border border-app-border flex items-center justify-center text-text-primary">
              <Accessibility className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-medium text-text-primary text-sm">axe-core Accessibility</h3>
              <p className="text-xs text-text-secondary mt-1 leading-relaxed">
                Automated WCAG 2.1 Level AA scanner inspecting interactive controls, ARIA attributes, button names, and form labels.
              </p>
            </div>
            <div className="pt-2 border-t border-app-border text-[11px] text-text-secondary space-y-1 font-mono">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3 h-3 text-status-success flex-shrink-0" />
                <span>WCAG 2.1 AA automated rules</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3 h-3 text-status-success flex-shrink-0" />
                <span>Unlabeled form inputs</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3 h-3 text-status-success flex-shrink-0" />
                <span>Keyboard tab order index</span>
              </div>
            </div>
          </div>

          {/* Broken Links */}
          <div className="surface-card p-5 space-y-3">
            <div className="w-8 h-8 rounded-md bg-app-raised border border-app-border flex items-center justify-center text-text-primary">
              <Link2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-medium text-text-primary text-sm">Broken Links</h3>
              <p className="text-xs text-text-secondary mt-1 leading-relaxed">
                Extracts outgoing and internal hyperlinks, resolves relative URLs, and checks status codes with bounded concurrency.
              </p>
            </div>
            <div className="pt-2 border-t border-app-border text-[11px] text-text-secondary space-y-1 font-mono">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3 h-3 text-status-success flex-shrink-0" />
                <span>Concurrent HTTP resolution</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3 h-3 text-status-success flex-shrink-0" />
                <span>404, 500 & timeout flags</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3 h-3 text-status-success flex-shrink-0" />
                <span>Target latency tracking</span>
              </div>
            </div>
          </div>

          {/* Mobile Readiness */}
          <div className="surface-card p-5 space-y-3">
            <div className="w-8 h-8 rounded-md bg-app-raised border border-app-border flex items-center justify-center text-text-primary">
              <Smartphone className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-medium text-text-primary text-sm">Mobile Readiness</h3>
              <p className="text-xs text-text-secondary mt-1 leading-relaxed">
                Detects viewport scaling, fixed desktop pixel widths, pinch-zoom restrictions, and mobile layout overflow.
              </p>
            </div>
            <div className="pt-2 border-t border-app-border text-[11px] text-text-secondary space-y-1 font-mono">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3 h-3 text-status-success flex-shrink-0" />
                <span>Device width scaling check</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3 h-3 text-status-success flex-shrink-0" />
                <span>375px viewport emulation</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3 h-3 text-status-success flex-shrink-0" />
                <span>Horizontal overflow alert</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Developer Tool Architecture Spec (Minimalist specification box) */}
      <section className="surface-card p-6 border border-app-border space-y-4">
        <div className="flex items-center justify-between border-b border-app-border pb-3">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-text-primary" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary font-mono">
              Architecture & Data Flow
            </h3>
          </div>
          <span className="text-[11px] font-mono text-text-tertiary">MERN + Cheerio + Playwright</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-text-secondary leading-relaxed">
          <div>
            <strong className="text-text-primary block font-medium mb-1">Real-time Pipeline</strong>
            <span>Non-blocking execution streaming stage updates via Server-Sent Events (SSE).</span>
          </div>
          <div>
            <strong className="text-text-primary block font-medium mb-1">Standard Exports</strong>
            <span>Direct export to formatted JSON or RFC-4180 CSV for engineering review.</span>
          </div>
          <div>
            <strong className="text-text-primary block font-medium mb-1">MongoDB Persistence</strong>
            <span>All audit logs, findings, and checked link health records indexed and stored.</span>
          </div>
        </div>
      </section>
    </div>
  );
}
