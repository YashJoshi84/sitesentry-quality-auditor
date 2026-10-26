import React from 'react';
import { ShieldCheck } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="w-full border-t border-app-border bg-app-bg py-8 text-xs text-text-tertiary mt-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Brand & info */}
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-app-surface border border-app-border flex items-center justify-center text-text-primary">
              <ShieldCheck className="w-3 h-3 text-text-primary" />
            </div>
            <span className="font-medium text-text-secondary text-xs">
              SiteSentry
            </span>
            <span className="text-text-tertiary">•</span>
            <span className="text-text-tertiary">Automated Website Quality & Accessibility Auditor</span>
          </div>

          {/* Engine Technologies Tags */}
          <div className="flex flex-wrap items-center gap-1.5 font-mono text-[10px]">
            <span className="px-2 py-0.5 rounded bg-app-surface border border-app-border text-text-secondary">
              React + Vite
            </span>
            <span className="px-2 py-0.5 rounded bg-app-surface border border-app-border text-text-secondary">
              Express + Node.js
            </span>
            <span className="px-2 py-0.5 rounded bg-app-surface border border-app-border text-text-secondary">
              MongoDB
            </span>
            <span className="px-2 py-0.5 rounded bg-app-surface border border-app-border text-text-secondary">
              axe-core + Playwright
            </span>
            <span className="px-2 py-0.5 rounded bg-app-surface border border-app-border text-text-secondary">
              Cheerio
            </span>
          </div>
        </div>

        <div className="pt-4 mt-4 border-t border-app-border/40 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-text-tertiary">
          <p>© {new Date().getFullYear()} SiteSentry. Built for High-Precision Software Engineering Project.</p>
          <div className="flex items-center gap-3">
            <span>Deterministic Auditing</span>
            <span>•</span>
            <span>WCAG 2.1 AA Automated Heuristics</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
