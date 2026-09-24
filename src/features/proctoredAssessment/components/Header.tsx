import React from 'react';
import { Shield, Camera, Mic, Monitor, Pause, HeartHandshake, History, Settings } from 'lucide-react';
import { AssessmentStage, DeviceStatus, EventSeverity } from '../types';

interface HeaderProps {
  currentStage: AssessmentStage;
  deviceStatus: DeviceStatus;
  proctorSeverity: EventSeverity;
  onPause: () => void;
  onOpenCrisis: () => void;
  onViewHistory: () => void;
  onViewAdmin: () => void;
  completedQuestionsCount: number;
}

const SESSION_STATUS: Record<EventSeverity, { label: string; dot: string }> = {
  GREEN: { label: 'Session running normally', dot: 'bg-emerald-500' },
  YELLOW: { label: 'Brief interruption noted', dot: 'bg-amber-400' },
  ORANGE: { label: 'Interruption noted', dot: 'bg-amber-500' },
  RED: { label: 'Session could not be confirmed', dot: 'bg-rose-500' },
};

const DeviceIndicator: React.FC<{ icon: React.ElementType; label: string; active: boolean }> = ({
  icon: Icon,
  label,
  active,
}) => (
  <span className="flex items-center gap-1.5">
    <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-emerald-500' : 'bg-stone-300'}`} aria-hidden="true" />
    <Icon className="h-3.5 w-3.5 text-stone-500" aria-hidden="true" />
    <span>
      {label}
      <span className="sr-only">{active ? ' on' : ' off'}</span>
    </span>
  </span>
);

export const Header: React.FC<HeaderProps> = ({
  currentStage,
  deviceStatus,
  proctorSeverity,
  onPause,
  onOpenCrisis,
  onViewHistory,
  onViewAdmin,
  completedQuestionsCount,
}) => {
  const isMonitoredStage =
    currentStage === 'PCL5_ASSESSMENT' ||
    currentStage === 'FUNCTIONAL_IMPACT' ||
    currentStage === 'CONTEXTUAL_INTERVIEW';
  const status = SESSION_STATUS[proctorSeverity];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-stone-200 bg-stone-50/95 px-4 py-3 backdrop-blur sm:px-6">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-800 text-teal-50">
            <Shield className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="whitespace-nowrap leading-tight">
            <span className="block text-base font-semibold tracking-tight text-stone-900">Aura</span>
            <span className="block text-xs text-stone-500">Trauma assessment</span>
          </div>
        </div>

        {isMonitoredStage && (
          <div
            className="hidden items-center gap-4 whitespace-nowrap text-xs text-stone-600 xl:flex"
            role="status"
            aria-live="polite"
          >
            <DeviceIndicator icon={Camera} label="Camera" active={deviceStatus.cameraActive} />
            <DeviceIndicator icon={Mic} label="Microphone" active={deviceStatus.microphoneActive} />
            {deviceStatus.screenShareActive && <DeviceIndicator icon={Monitor} label="Screen" active />}
            <span className="flex items-center gap-1.5 border-l border-stone-200 pl-4">
              <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} aria-hidden="true" />
              {status.label}
            </span>
          </div>
        )}

        <div className="flex items-center gap-1.5">
          {currentStage === 'PCL5_ASSESSMENT' && (
            <div className="mr-2 hidden items-center gap-2 sm:flex">
              <span className="whitespace-nowrap text-xs text-stone-600">{completedQuestionsCount} of 20 answered</span>
              <div
                className="h-1.5 w-20 overflow-hidden rounded-full bg-stone-200"
                role="progressbar"
                aria-label="Questions answered"
                aria-valuemin={0}
                aria-valuemax={20}
                aria-valuenow={completedQuestionsCount}
              >
                <div
                  className="h-full bg-teal-600 transition-all duration-300"
                  style={{ width: `${(completedQuestionsCount / 20) * 100}%` }}
                />
              </div>
            </div>
          )}

          {isMonitoredStage && (
            <button
              type="button"
              onClick={onPause}
              id="pause-assessment-btn"
              className="flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 transition hover:bg-stone-100"
            >
              <Pause className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Pause</span>
            </button>
          )}

          <button
            type="button"
            onClick={onOpenCrisis}
            id="crisis-support-btn"
            className="flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-teal-200 bg-teal-50 px-3 py-1.5 text-sm font-medium text-teal-800 transition hover:bg-teal-100"
          >
            <HeartHandshake className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Crisis support</span>
            <span className="sm:hidden">Support</span>
          </button>

          <button
            type="button"
            onClick={onViewHistory}
            id="assessment-history-btn"
            title="Assessment history"
            aria-label="Assessment history"
            className="rounded-lg p-2 text-stone-600 transition hover:bg-stone-200 hover:text-stone-900"
          >
            <History className="h-4 w-4" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={onViewAdmin}
            id="admin-research-btn"
            title="Research settings"
            aria-label="Research settings"
            className="rounded-lg p-2 text-stone-600 transition hover:bg-stone-200 hover:text-stone-900"
          >
            <Settings className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </header>
  );
};
