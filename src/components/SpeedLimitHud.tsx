import {useState} from 'react';
import {AlertTriangle, RefreshCw, X} from 'lucide-react';
import {speedUnitLabel} from '../lib/geoUtils';
import type {SpeedLimitStatus, UnitSystem} from '../types/ride';

interface SpeedLimitHudProps {
  currentSpeed: number;
  unitSystem: UnitSystem;
  activeLimit: number | null;
  limitSource: 'roads-api' | 'manual' | null;
  isOverLimit: boolean;
  roadStatus: SpeedLimitStatus;
  manualLimit: number | null;
  onSetManualLimit: (limit: number | null) => void;
  onRefreshRoadLimit: () => void;
  onOpenCluster: () => void;
}

export function SpeedLimitHud({
  currentSpeed,
  unitSystem,
  activeLimit,
  limitSource,
  isOverLimit,
  roadStatus,
  manualLimit,
  onSetManualLimit,
  onRefreshRoadLimit,
  onOpenCluster,
}: SpeedLimitHudProps) {
  const [popoverOpen, setPopoverOpen] = useState(false);

  const unitText = speedUnitLabel(unitSystem);
  const presets =
    unitSystem === 'IMPERIAL'
      ? [25, 35, 45, 55, 65, 75]
      : [40, 50, 60, 80, 100, 120];
  const overDelta =
    activeLimit !== null && currentSpeed > activeLimit
      ? currentSpeed - activeLimit
      : 0;

  return (
    <div className="absolute top-3 left-3 sm:top-4 sm:left-4 z-20 flex flex-col items-start gap-2 select-none">
      <div className="flex items-center gap-2.5">
        {/* Current Speed Readout — highlights red when exceeding limit */}
        <button
          type="button"
          onClick={onOpenCluster}
          aria-label={
            isOverLimit
              ? `Current speed ${currentSpeed} ${unitText}, over speed limit of ${activeLimit}`
              : `Current speed ${currentSpeed} ${unitText}`
          }
          className={`px-4 py-2.5 rounded-2xl border backdrop-blur-md shadow-lg flex flex-col justify-center transition-colors duration-150 ${
            isOverLimit
              ? 'bg-red-600 text-white border-red-300 shadow-[0_0_24px_rgba(239,68,68,0.55)]'
              : 'bg-slate-950/90 dark:bg-[#0D1015]/92 text-white border-white/15 hover:bg-slate-900'
          }`}
        >
          <div className="flex items-baseline gap-1.5">
            <span className="font-display text-3xl sm:text-4xl font-bold leading-none tabular-nums">
              {currentSpeed}
            </span>
            <span
              className={`text-xs font-semibold ${
                isOverLimit ? 'text-red-100' : 'text-orange-400'
              }`}
            >
              {unitText}
            </span>
          </div>

          {isOverLimit && (
            <div className="mt-1 flex items-center gap-1 text-[11px] font-bold tracking-tight text-white">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span className="font-mono-tabular">OVER +{overDelta}</span>
            </div>
          )}
        </button>

        {/* Road Speed Limit Sign */}
        <button
          type="button"
          onClick={() => setPopoverOpen((p) => !p)}
          aria-label="Configure speed limit warning"
          title="Speed Limit"
          className={`relative w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white text-slate-950 border-[5px] shadow-lg flex flex-col items-center justify-center transition-transform active:scale-95 ${
            isOverLimit
              ? 'border-red-600 ring-4 ring-red-500/50'
              : activeLimit !== null
                ? 'border-red-600'
                : 'border-slate-400'
          }`}
        >
          <span className="font-display text-2xl sm:text-3xl font-bold leading-none tabular-nums">
            {activeLimit !== null ? activeLimit : '--'}
          </span>
          <span className="text-[9px] font-bold uppercase tracking-tight text-slate-600 leading-none mt-0.5">
            {limitSource === 'roads-api'
              ? 'ROAD'
              : limitSource === 'manual'
                ? 'LIMIT'
                : 'SET'}
          </span>
        </button>
      </div>

      {/* Inline Speed Limit Configuration Popover */}
      {popoverOpen && (
        <div className="w-[300px] sm:w-[320px] p-4 rounded-2xl border border-slate-200 dark:border-white/15 bg-white/95 dark:bg-[#141922]/95 text-slate-900 dark:text-slate-100 backdrop-blur-md shadow-2xl space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-sm font-bold">Speed Limit Warning</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {limitSource === 'roads-api'
                  ? `Roads API posted limit (${roadStatus.roadLimit} ${roadStatus.units})`
                  : limitSource === 'manual'
                    ? `Manual rider alert (${manualLimit} ${unitText})`
                    : 'No active speed limit'}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setPopoverOpen(false)}
              aria-label="Close speed limit panel"
              className="min-h-[36px] min-w-[36px] rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-200/70 dark:hover:bg-white/10"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Roads API Status */}
          <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-between gap-2 text-xs">
            <span className="text-slate-600 dark:text-slate-300 leading-snug">
              {roadStatus.isLoading
                ? 'Checking road speed limit...'
                : roadStatus.roadLimit !== null
                  ? `Road limit detected: ${roadStatus.roadLimit} ${roadStatus.units}`
                  : roadStatus.reason === 'SPEED_LIMIT_LICENSE_REQUIRED' ||
                      roadStatus.reason === 'ROADS_API_UNAVAILABLE'
                    ? 'Roads Speed Limits requires an Asset Tracking license. Use a manual alert limit below.'
                    : roadStatus.statusMessage ||
                      'No posted limit returned for this segment.'}
            </span>
            <button
              type="button"
              onClick={onRefreshRoadLimit}
              disabled={roadStatus.isLoading}
              aria-label="Refresh road speed limit"
              className="min-h-[36px] min-w-[36px] rounded-lg bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 flex items-center justify-center shrink-0 hover:bg-slate-50 dark:hover:bg-white/15"
            >
              <RefreshCw
                className={`w-4 h-4 ${roadStatus.isLoading ? 'animate-spin' : ''}`}
              />
            </button>
          </div>

          {/* Quick Presets */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Manual Alert Threshold ({unitText})
              </span>
              {manualLimit !== null && (
                <button
                  type="button"
                  onClick={() => onSetManualLimit(null)}
                  className="text-xs font-semibold text-orange-600 dark:text-orange-400 hover:underline"
                >
                  Use Road Auto
                </button>
              )}
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {presets.map((val) => {
                const selected = manualLimit === val;
                return (
                  <button
                    key={val}
                    type="button"
                    onClick={() => onSetManualLimit(selected ? null : val)}
                    className={`min-h-[42px] rounded-lg border text-xs font-mono-tabular font-bold transition-colors ${
                      selected
                        ? 'bg-red-600 text-white border-red-600'
                        : 'bg-slate-50 dark:bg-white/5 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10'
                    }`}
                  >
                    {val}
                  </button>
                );
              })}
            </div>
          </div>

          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
            Speed limit data is advisory and may not reflect temporary zones. Always obey posted road signage.
          </p>
        </div>
      )}
    </div>
  );
}
