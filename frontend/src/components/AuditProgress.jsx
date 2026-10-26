import React, { useEffect, useState, useRef } from 'react';
import { Loader2, CheckCircle2, AlertCircle, ArrowLeft, Terminal, Search, Accessibility, Link2, Smartphone } from 'lucide-react';
import { getProgressEventSourceUrl, fetchAuditById } from '../services/api';

const STAGES = [
  { id: 'fetch', label: 'Page Fetch & Render', icon: Search },
  { id: 'seo', label: 'SEO & Metadata', icon: Search },
  { id: 'a11y', label: 'axe-core Accessibility', icon: Accessibility },
  { id: 'links', label: 'Hyperlinks Check', icon: Link2 },
  { id: 'mobile', label: 'Mobile Readiness', icon: Smartphone },
  { id: 'scoring', label: 'Score Aggregation', icon: CheckCircle2 },
];

const STAGE_MAP = {
  queued: 'fetch',
  validating: 'fetch',
  fetching_html: 'fetch',
  fetch: 'fetch',
  seo_audit: 'seo',
  seo: 'seo',
  a11y_audit: 'a11y',
  a11y: 'a11y',
  link_audit: 'links',
  links: 'links',
  mobile_audit: 'mobile',
  mobile: 'mobile',
  finalizing: 'scoring',
  scoring: 'scoring',
  completed: 'scoring',
};

export default function AuditProgress({ auditId, onAuditComplete, onCancel }) {
  const [currentStage, setCurrentStage] = useState('fetch');
  const [progressPercent, setProgressPercent] = useState(10);
  const [statusMessage, setStatusMessage] = useState('Initializing audit engine pipeline...');
  const [logs, setLogs] = useState([]);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const completedRef = useRef(false);

  useEffect(() => {
    if (!auditId) return;

    let pollInterval = null;
    let eventSource = null;

    const handleProgressData = (data) => {
      if (!data || completedRef.current) return;

      const stageKey = data.stage || data.currentStage;
      if (stageKey && STAGE_MAP[stageKey]) {
        setCurrentStage(STAGE_MAP[stageKey]);
      }

      const percent = data.progress ?? data.percent ?? data.progressPercent;
      if (percent !== undefined) {
        setProgressPercent((prev) => Math.max(prev, percent));
      }

      const msg = data.message || data.statusMessage;
      if (msg) {
        setStatusMessage(msg);
        setLogs((prev) => [...prev.slice(-15), `[${new Date().toLocaleTimeString()}] ${msg}`]);
      }

      const status = data.status || (stageKey === 'completed' ? 'completed' : stageKey === 'partially_completed' ? 'partially_completed' : stageKey === 'cancelled' ? 'cancelled' : stageKey === 'failed' ? 'failed' : null);

      if (status === 'completed' || status === 'partially_completed' || (percent === 100 && status !== 'failed' && status !== 'cancelled')) {
        completedRef.current = true;
        setProgressPercent(100);
        setStatusMessage(status === 'partially_completed' ? 'Audit finished with partial scan coverage. Redirecting to report...' : 'Audit inspection complete. Redirecting to report...');
        if (pollInterval) clearInterval(pollInterval);
        if (eventSource) eventSource.close();
        setTimeout(() => {
          onAuditComplete(data.auditId || data._id || auditId);
        }, 400);
      } else if (status === 'failed' || status === 'cancelled') {
        completedRef.current = true;
        setHasError(true);
        setErrorMessage(data.error || data.errorMessage || (status === 'cancelled' ? 'Audit was cancelled by request.' : 'Audit encountered an unexpected failure.'));
        setStatusMessage(status === 'cancelled' ? 'Audit cancelled.' : 'Audit failed.');
        if (pollInterval) clearInterval(pollInterval);
        if (eventSource) eventSource.close();
      }
    };

    // 1. Establish SSE EventSource connection
    try {
      const sseUrl = getProgressEventSourceUrl(auditId);
      eventSource = new EventSource(sseUrl);

      eventSource.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          handleProgressData(data);
        } catch (err) {
          console.warn('Failed to parse SSE message:', err);
        }
      };

      eventSource.addEventListener('progress', (e) => {
        try {
          const data = JSON.parse(e.data);
          handleProgressData(data);
        } catch (err) {
          console.warn('Failed to parse SSE progress:', err);
        }
      });

      eventSource.addEventListener('completed', (e) => {
        try {
          const data = JSON.parse(e.data);
          handleProgressData({ ...data, status: 'completed' });
        } catch {
          handleProgressData({ status: 'completed' });
        }
      });

      eventSource.addEventListener('failed', (e) => {
        try {
          const data = JSON.parse(e.data);
          handleProgressData({ ...data, status: 'failed' });
        } catch {
          handleProgressData({ status: 'failed' });
        }
      });

      eventSource.onerror = (err) => {
        console.warn('SSE stream disconnected or buffering:', err);
      };
    } catch (sseErr) {
      console.warn('Could not initialize EventSource:', sseErr);
    }

    // 2. Active Fallback Polling via fetchAuditById
    // Guaranteed to advance progress and complete even if proxies/free tiers buffer SSE
    pollInterval = setInterval(async () => {
      if (completedRef.current) return;
      try {
        const audit = await fetchAuditById(auditId);
        if (audit) {
          handleProgressData(audit);
        }
      } catch {
        // Ignore transient poll errors while audit runs
      }
    }, 1200);

    return () => {
      if (eventSource) eventSource.close();
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [auditId]);

  const currentStageIndex = STAGES.findIndex((s) => s.id === currentStage);

  return (
    <div className="max-w-3xl mx-auto py-16 px-4 sm:px-6 space-y-6">
      {/* Header Banner */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-1.5 text-xs text-text-tertiary font-mono">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-text-primary" />
          <span>INSPECTION IN PROGRESS</span>
        </div>

        <h2 className="text-2xl font-medium text-text-primary tracking-tight">
          Auditing Website Quality
        </h2>
        <p className="text-xs text-text-secondary max-w-md mx-auto">
          {statusMessage}
        </p>
      </div>

      {/* Progress Bar (Quiet, thin) */}
      <div className="surface-card p-4 border border-app-border space-y-2">
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="text-text-tertiary">Overall Progress</span>
          <span className="text-text-primary font-medium">{progressPercent}%</span>
        </div>

        <div className="w-full h-1.5 bg-app-raised rounded-full overflow-hidden">
          <div
            className="h-full bg-text-primary rounded-full transition-all duration-300"
            style={{ width: `${Math.max(5, progressPercent)}%` }}
          />
        </div>
      </div>

      {/* Pipeline Stepper */}
      <div className="surface-card p-4 border border-app-border space-y-3">
        <span className="text-[10px] font-mono uppercase tracking-wider text-text-tertiary block">
          Pipeline Stages
        </span>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {STAGES.map((stage, idx) => {
            const Icon = stage.icon;
            const isCompleted = currentStageIndex > idx || progressPercent === 100;
            const isCurrent = currentStageIndex === idx && progressPercent < 100;

            return (
              <div
                key={stage.id}
                className={`p-2.5 rounded-md border text-xs transition-colors flex items-center gap-2 ${
                  isCurrent
                    ? 'border-text-primary bg-app-raised text-text-primary'
                    : isCompleted
                    ? 'border-app-border bg-app-surface text-text-secondary'
                    : 'border-app-border/40 bg-app-bg text-text-tertiary'
                }`}
              >
                <div className="flex-shrink-0">
                  {isCurrent ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-text-primary" />
                  ) : isCompleted ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-status-success" />
                  ) : (
                    <Icon className="w-3.5 h-3.5 text-text-tertiary" />
                  )}
                </div>

                <div className="min-w-0 flex-1 truncate">
                  <p className="font-medium truncate leading-tight text-[11px]">
                    {stage.label}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Terminal Live Event Log */}
      <div className="surface-card border border-app-border overflow-hidden">
        <div className="bg-app-raised px-3.5 py-2 border-b border-app-border flex items-center justify-between text-xs font-mono text-text-tertiary">
          <div className="flex items-center gap-1.5">
            <Terminal className="w-3.5 h-3.5 text-text-secondary" />
            <span>Audit Event Log</span>
          </div>
          <span className="text-[10px] text-status-success font-mono">
            Connected
          </span>
        </div>

        <div className="p-3 bg-[#131516] font-mono text-[11px] space-y-1 max-h-40 overflow-y-auto">
          {logs.map((log, i) => (
            <div key={i} className="text-text-secondary">
              <span className="text-text-tertiary select-none mr-2">›</span>
              {log}
            </div>
          ))}
          {logs.length === 0 && (
            <div className="text-text-tertiary italic">Connecting to audit engine...</div>
          )}
        </div>
      </div>

      {/* Error State Banner */}
      {hasError && (
        <div className="p-4 rounded-md bg-status-error-bg border border-status-error-border text-status-error text-xs space-y-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <h4 className="font-medium">Audit Failed</h4>
          </div>
          <p className="text-text-secondary">{errorMessage}</p>
          <button
            onClick={onCancel}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-app-surface border border-app-border text-text-primary text-xs font-medium hover:bg-app-raised transition-colors mt-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Return to Homepage
          </button>
        </div>
      )}

      {/* Cancel button */}
      {!hasError && (
        <div className="text-center pt-1">
          <button
            onClick={onCancel}
            className="text-xs text-text-tertiary hover:text-text-secondary transition-colors"
          >
            Cancel scan
          </button>
        </div>
      )}
    </div>
  );
}
