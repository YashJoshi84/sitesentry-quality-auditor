import React from 'react';

export function getScoreGrade(score) {
  if (score >= 95) return { grade: 'A+', label: 'Exceptional', color: 'emerald' };
  if (score >= 90) return { grade: 'A', label: 'Excellent', color: 'emerald' };
  if (score >= 75) return { grade: 'B', label: 'Good Quality', color: 'emerald' };
  if (score >= 60) return { grade: 'C', label: 'Needs Polish', color: 'amber' };
  return { grade: 'F', label: 'Critical Issues', color: 'rose' };
}

export default function ScoreGauge({ score = 0, size = 150, strokeWidth = 8, title = "Overall Score" }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedScore = Math.max(0, Math.min(100, Math.round(score)));
  const offset = circumference - (clampedScore / 100) * circumference;

  const { grade, label, color } = getScoreGrade(clampedScore);

  const colorConfig = {
    emerald: {
      stroke: '#48C78E',
      textColor: 'text-status-success',
      badgeBg: 'bg-status-success-bg text-status-success border-status-success-border',
      ringColor: '#25282B',
    },
    amber: {
      stroke: '#E5B84B',
      textColor: 'text-status-warning',
      badgeBg: 'bg-status-warning-bg text-status-warning border-status-warning-border',
      ringColor: '#25282B',
    },
    rose: {
      stroke: '#F16B68',
      textColor: 'text-status-error',
      badgeBg: 'bg-status-error-bg text-status-error border-status-error-border',
      ringColor: '#25282B',
    },
  }[color] || {
    stroke: '#48C78E',
    textColor: 'text-status-success',
    badgeBg: 'bg-status-success-bg text-status-success border-status-success-border',
    ringColor: '#25282B',
  };

  return (
    <div className="flex flex-col items-center justify-center p-5 rounded-lg bg-app-surface border border-app-border">
      <span className="text-[11px] font-mono uppercase tracking-wider text-text-tertiary mb-3">{title}</span>
      
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          {/* Background track circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={colorConfig.ringColor}
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          {/* Active progress circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={colorConfig.stroke}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            fill="transparent"
            style={{
              transition: 'stroke-dashoffset 800ms cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          />
        </svg>

        {/* Center score details */}
        <div className="absolute flex flex-col items-center justify-center text-center">
          <div className="flex items-baseline">
            <span className="text-4xl font-mono font-medium tracking-tight text-text-primary">{clampedScore}</span>
            <span className="text-xs font-mono text-text-tertiary ml-0.5">/100</span>
          </div>
          <span className={`text-[11px] font-mono font-semibold uppercase mt-0.5 ${colorConfig.textColor}`}>
            Grade {grade}
          </span>
        </div>
      </div>

      <div className={`mt-3 px-2.5 py-0.5 rounded text-[11px] font-mono border ${colorConfig.badgeBg}`}>
        {label}
      </div>
    </div>
  );
}
