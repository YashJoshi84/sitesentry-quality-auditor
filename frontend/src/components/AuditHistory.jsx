import React, { useState, useEffect } from 'react';
import {
  History,
  Search,
  Trash2,
  Calendar,
  Clock,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RotateCw,
  Plus,
  Loader2,
} from 'lucide-react';
import { fetchAuditHistory, deleteAuditRecord } from '../services/api';
import { getScoreGrade } from './ScoreGauge';

export default function AuditHistory({ onOpenReport, onReAudit, onNewAudit }) {
  const [audits, setAudits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  const loadHistory = async (query = '') => {
    try {
      setLoading(true);
      const data = await fetchAuditHistory(query);
      setAudits(data);
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory(search);
  }, [search]);

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    try {
      setDeletingId(id);
      await deleteAuditRecord(id);
      setAudits((prev) => prev.filter((a) => a._id !== id));
      setDeleteConfirmId(null);
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (dateStr) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-app-border">
        <div>
          <h1 className="text-xl sm:text-2xl font-medium text-text-primary tracking-tight flex items-center gap-2">
            <History className="w-5 h-5 text-text-primary" />
            Audit History
          </h1>
          <p className="text-xs text-text-secondary mt-0.5">
            Historical website audits stored in MongoDB.
          </p>
        </div>

        <button
          onClick={onNewAudit}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#E6E8E6] hover:bg-white text-[#17191B] text-xs font-medium transition-colors shadow-subtle"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Audit</span>
        </button>
      </div>

      {/* Search & Stats Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 max-w-sm">
          <Search className="w-3.5 h-3.5 text-text-tertiary absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Filter by domain or URL..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-app-surface border border-app-border rounded-md pl-8 pr-3 py-1.5 text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-text-primary transition-colors font-mono"
          />
        </div>

        {/* Quick summary metrics */}
        <div className="flex items-center gap-3 text-xs font-mono text-text-tertiary">
          <span>
            Total: <strong className="text-text-primary font-medium">{audits.length}</strong>
          </span>
          <button
            onClick={() => loadHistory(search)}
            className="p-1.5 rounded hover:bg-app-surface text-text-tertiary hover:text-text-primary transition-colors"
            title="Refresh history"
          >
            <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* History Grid / List */}
      {loading ? (
        <div className="p-12 text-center rounded-lg surface-card">
          <Loader2 className="w-6 h-6 animate-spin text-text-primary mx-auto mb-2" />
          <p className="text-xs text-text-secondary">Loading history...</p>
        </div>
      ) : audits.length === 0 ? (
        <div className="p-12 text-center rounded-lg surface-card space-y-3">
          <div className="w-9 h-9 rounded-md bg-app-raised border border-app-border text-text-tertiary flex items-center justify-center mx-auto">
            <ShieldCheck className="w-5 h-5 text-text-primary" />
          </div>
          <div>
            <h3 className="text-xs font-medium text-text-primary">No Audits Found</h3>
            <p className="text-xs text-text-tertiary max-w-xs mx-auto mt-0.5">
              {search
                ? `No records matched "${search}".`
                : 'No website audits have been run yet.'}
            </p>
          </div>
          <button
            onClick={onNewAudit}
            className="px-3 py-1.5 rounded-md bg-[#E6E8E6] hover:bg-white text-[#17191B] text-xs font-medium transition-colors"
          >
            Start First Audit
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {audits.map((audit) => {
            const overallScore = audit.scores?.overall ?? 0;
            const { grade, color } = getScoreGrade(overallScore);

            const scoreColors = {
              emerald: 'text-status-success border-status-success-border bg-status-success-bg',
              amber: 'text-status-warning border-status-warning-border bg-status-warning-bg',
              rose: 'text-status-error border-status-error-border bg-status-error-bg',
            }[color] || 'text-status-success border-status-success-border bg-status-success-bg';

            const isConfirmingDelete = deleteConfirmId === audit._id;

            return (
              <div
                key={audit._id}
                onClick={() => onOpenReport(audit._id)}
                className="group rounded-lg surface-card p-3.5 border border-app-border hover:border-app-border-hover transition-colors cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                {/* Left: Domain, URL, Date */}
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-text-primary text-xs tracking-tight group-hover:text-white transition-colors truncate">
                      {audit.domain}
                    </span>
                    <span className="text-[10px] text-text-tertiary font-mono">
                      {formatDate(audit.createdAt)}
                    </span>
                  </div>
                  <p className="text-[11px] text-text-secondary font-mono truncate">
                    {audit.url}
                  </p>
                </div>

                {/* Right: Scores, counts, action */}
                <div className="flex items-center gap-4 flex-shrink-0 self-start sm:self-center">
                  {/* Summary Counters */}
                  <div className="flex items-center gap-2 text-[11px] font-mono text-text-tertiary">
                    <span className="flex items-center gap-0.5 text-status-success" title="Passed">
                      <CheckCircle2 className="w-3 h-3" />
                      {audit.summary?.passedCount ?? 0}
                    </span>
                    <span className="flex items-center gap-0.5 text-status-warning" title="Warnings">
                      <AlertTriangle className="w-3 h-3" />
                      {audit.summary?.warningCount ?? 0}
                    </span>
                    <span className="flex items-center gap-0.5 text-status-error" title="Critical Errors">
                      <XCircle className="w-3 h-3" />
                      {audit.summary?.errorCount ?? 0}
                    </span>
                  </div>

                  {/* Overall Score Badge */}
                  <div className={`px-2 py-0.5 rounded border text-xs font-mono font-medium ${scoreColors}`}>
                    {overallScore} <span className="text-[10px] font-normal uppercase">{grade}</span>
                  </div>

                  {/* Actions: Delete or Confirm */}
                  <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                    {isConfirmingDelete ? (
                      <div className="flex items-center gap-1 text-[11px] font-mono">
                        <button
                          onClick={(e) => handleDelete(audit._id, e)}
                          disabled={deletingId === audit._id}
                          className="px-2 py-0.5 rounded bg-status-error hover:opacity-90 text-white text-[10px] font-medium"
                        >
                          {deletingId === audit._id ? 'Deleting...' : 'Confirm'}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirmId(null);
                          }}
                          className="px-1.5 py-0.5 rounded hover:bg-app-raised text-text-tertiary text-[10px]"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteConfirmId(audit._id);
                        }}
                        className="p-1 rounded text-text-tertiary hover:text-status-error hover:bg-status-error-bg transition-colors"
                        title="Delete audit"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <span className="text-text-tertiary group-hover:text-text-primary transition-colors pl-1">
                      <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
