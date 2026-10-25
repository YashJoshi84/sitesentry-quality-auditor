import React, { useState, useMemo } from 'react';
import { ExternalLink, CheckCircle2, XCircle, Search, Filter, AlertCircle } from 'lucide-react';

export default function LinksTable({ checkedLinks = [] }) {
  const [filterMode, setFilterMode] = useState('all'); // 'all' | 'broken' | 'healthy'
  const [searchQuery, setSearchQuery] = useState('');

  const stats = useMemo(() => {
    const total = checkedLinks.length;
    const broken = checkedLinks.filter(l => !l.ok).length;
    const healthy = checkedLinks.filter(l => l.ok).length;
    return { total, broken, healthy };
  }, [checkedLinks]);

  const filteredLinks = useMemo(() => {
    return checkedLinks.filter(link => {
      if (filterMode === 'broken' && link.ok) return false;
      if (filterMode === 'healthy' && !link.ok) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesUrl = link.url?.toLowerCase().includes(q);
        const matchesStatus = String(link.status || '').includes(q);
        const matchesText = link.sourceSnippet?.toLowerCase().includes(q);
        return matchesUrl || matchesStatus || matchesText;
      }
      return true;
    });
  }, [checkedLinks, filterMode, searchQuery]);

  const getStatusBadge = (link) => {
    if (!link.ok) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono border bg-status-error-bg text-status-error border-status-error-border">
          <XCircle className="w-3 h-3" />
          {link.status ? `HTTP ${link.status}` : 'FAILED'}
        </span>
      );
    }
    if (link.status >= 300 && link.status < 400) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono border bg-status-info-bg text-status-info border-status-info-border">
          HTTP {link.status}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono border bg-status-success-bg text-status-success border-status-success-border">
        <CheckCircle2 className="w-3 h-3" />
        HTTP {link.status || 200}
      </span>
    );
  };

  if (!checkedLinks || checkedLinks.length === 0) {
    return (
      <div className="p-8 text-center rounded-lg surface-card">
        <AlertCircle className="w-6 h-6 text-text-tertiary mx-auto mb-2" />
        <p className="text-xs text-text-secondary">No outbound links discovered on this page.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg surface-card border border-app-border space-y-3 p-4">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary font-mono">
            Hyperlink Verification
          </h3>
          <p className="text-xs text-text-tertiary mt-0.5 font-normal">
            Bounded asynchronous HTTP status and connectivity verification.
          </p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-1.5 text-xs">
          <button
            onClick={() => setFilterMode('all')}
            className={`px-2.5 py-1 rounded text-xs transition-colors ${
              filterMode === 'all'
                ? 'bg-app-raised text-text-primary border border-app-border'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            All ({stats.total})
          </button>
          <button
            onClick={() => setFilterMode('broken')}
            className={`px-2.5 py-1 rounded text-xs transition-colors ${
              filterMode === 'broken'
                ? 'bg-status-error-bg text-status-error border border-status-error-border'
                : 'text-text-secondary hover:text-status-error'
            }`}
          >
            Broken ({stats.broken})
          </button>
          <button
            onClick={() => setFilterMode('healthy')}
            className={`px-2.5 py-1 rounded text-xs transition-colors ${
              filterMode === 'healthy'
                ? 'bg-status-success-bg text-status-success border border-status-success-border'
                : 'text-text-secondary hover:text-status-success'
            }`}
          >
            Healthy ({stats.healthy})
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-md border border-app-border">
        <table className="w-full text-left text-xs text-text-secondary">
          <thead className="bg-app-raised text-text-tertiary text-[10px] font-mono uppercase tracking-wider border-b border-app-border">
            <tr>
              <th className="py-2.5 px-3 font-medium">Status</th>
              <th className="py-2.5 px-3 font-medium">Target URL</th>
              <th className="py-2.5 px-3 font-medium">Anchor Text</th>
              <th className="py-2.5 px-3 font-medium text-right">Latency</th>
              <th className="py-2.5 px-3 font-medium">Diagnostics</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-app-border font-sans">
            {filteredLinks.map((link, idx) => (
              <tr key={idx} className="hover:bg-app-raised/50 transition-colors">
                <td className="py-2.5 px-3 whitespace-nowrap">
                  {getStatusBadge(link)}
                </td>
                <td className="py-2.5 px-3 max-w-[300px] truncate font-mono text-[11px]">
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-text-primary hover:text-white hover:underline flex items-center gap-1.5 truncate"
                  >
                    <span className="truncate">{link.url}</span>
                    <ExternalLink className="w-3 h-3 flex-shrink-0 text-text-tertiary" />
                  </a>
                </td>
                <td className="py-2.5 px-3 max-w-[160px] truncate text-text-secondary">
                  {link.sourceSnippet || '—'}
                </td>
                <td className="py-2.5 px-3 text-right font-mono text-[11px] text-text-tertiary whitespace-nowrap">
                  {link.durationMs ? `${link.durationMs}ms` : '—'}
                </td>
                <td className="py-2.5 px-3 text-text-tertiary font-mono text-[11px]">
                  {link.error ? (
                    <span className="text-status-error">{link.error}</span>
                  ) : (
                    <span className="text-text-secondary">{link.statusText || 'Resolved'}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
