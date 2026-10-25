import React, { useState } from 'react';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import LandingPage from './components/LandingPage';
import AuditProgress from './components/AuditProgress';
import ReportView from './components/ReportView';
import AuditHistory from './components/AuditHistory';
import { startAudit } from './services/api';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';

export default function App() {
  const [currentView, setCurrentView] = useState('landing'); // 'landing' | 'progress' | 'report' | 'history'
  const [activeAuditId, setActiveAuditId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'error') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4500);
  };

  const handleStartAudit = async (targetUrl) => {
    try {
      setLoading(true);
      const res = await startAudit(targetUrl);
      setActiveAuditId(res.auditId);
      setCurrentView('progress');
    } catch (err) {
      showToast(err.message || 'Failed to start audit', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAuditComplete = (completedAuditId) => {
    setActiveAuditId(completedAuditId);
    setCurrentView('report');
  };

  const handleOpenReport = (auditId) => {
    setActiveAuditId(auditId);
    setCurrentView('report');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleReAudit = (url) => {
    handleStartAudit(url);
  };

  const handleNewAuditClick = () => {
    setCurrentView('landing');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen flex flex-col bg-app-bg text-text-primary">
      {/* Toast Notification (Refined, quiet) */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50">
          <div
            className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg border text-xs shadow-elevated ${
              toast.type === 'error'
                ? 'bg-app-raised border-status-error-border text-status-error'
                : 'bg-app-raised border-status-success-border text-status-success'
            }`}
          >
            {toast.type === 'error' ? (
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            )}
            <span className="font-normal text-text-primary">{toast.message}</span>
            <button
              onClick={() => setToast(null)}
              className="ml-1 p-0.5 rounded text-text-tertiary hover:text-text-primary transition-colors"
              aria-label="Dismiss notification"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Main Top Navbar */}
      <Navbar
        currentView={currentView}
        setCurrentView={setCurrentView}
        onNewAuditClick={handleNewAuditClick}
      />

      {/* Main Content Area */}
      <main className="flex-1">
        {currentView === 'landing' && (
          <LandingPage
            onStartAudit={handleStartAudit}
            loading={loading}
          />
        )}

        {currentView === 'progress' && (
          <AuditProgress
            auditId={activeAuditId}
            onAuditComplete={handleAuditComplete}
            onCancel={() => setCurrentView('landing')}
          />
        )}

        {currentView === 'report' && (
          <ReportView
            auditId={activeAuditId}
            onBack={() => setCurrentView('history')}
            onReAudit={handleReAudit}
          />
        )}

        {currentView === 'history' && (
          <AuditHistory
            onOpenReport={handleOpenReport}
            onReAudit={handleReAudit}
            onNewAudit={handleNewAuditClick}
          />
        )}
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}
