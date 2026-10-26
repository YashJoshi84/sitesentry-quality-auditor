import React from 'react';
import { ShieldCheck, History, Sparkles, Plus } from 'lucide-react';

export default function Navbar({ currentView, setCurrentView, onNewAuditClick }) {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-app-border bg-app-bg">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        {/* Brand */}
        <div 
          onClick={() => setCurrentView('landing')}
          className="flex items-center gap-2.5 cursor-pointer group select-none"
        >
          <div className="w-7 h-7 rounded-md bg-app-surface border border-app-border flex items-center justify-center text-text-primary group-hover:border-app-border-hover transition-colors">
            <ShieldCheck className="w-4 h-4 text-text-primary" />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm tracking-tight text-text-primary">
              SiteSentry
            </span>
            <span className="text-[10px] font-mono text-text-tertiary px-1.5 py-0.5 rounded border border-app-border bg-app-surface">
              v1.0
            </span>
          </div>
        </div>

        {/* Navigation & Controls */}
        <div className="flex items-center gap-3">
          <nav className="flex items-center gap-1">
            <button
              onClick={() => setCurrentView('landing')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                currentView === 'landing'
                  ? 'bg-app-raised text-text-primary border border-app-border'
                  : 'text-text-secondary hover:text-text-primary hover:bg-app-surface'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Auditor</span>
            </button>

            <button
              onClick={() => setCurrentView('history')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                currentView === 'history'
                  ? 'bg-app-raised text-text-primary border border-app-border'
                  : 'text-text-secondary hover:text-text-primary hover:bg-app-surface'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>History</span>
            </button>
          </nav>

          {/* Quick New Audit Button if inside Report or History */}
          {currentView !== 'landing' && currentView !== 'progress' && (
            <button
              onClick={onNewAuditClick}
              className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-[#E6E8E6] hover:bg-white text-[#17191B] text-xs font-medium transition-colors shadow-subtle"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">New Audit</span>
            </button>
          )}

          {/* Subtle Engine Status Indicator */}
          <div className="hidden md:flex items-center gap-1.5 pl-3 border-l border-app-border text-xs text-text-secondary">
            <span className="w-1.5 h-1.5 rounded-full bg-status-success"></span>
            <span className="text-[11px] font-mono text-text-tertiary">Ready</span>
          </div>
        </div>
      </div>
    </header>
  );
}
