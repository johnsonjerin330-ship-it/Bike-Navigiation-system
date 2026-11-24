import {useState} from 'react';
import {
  Bike,
  Car,
  CheckCircle2,
  Clock,
  Flag,
  Fuel,
  Gauge,
  History,
  Navigation,
  Route as RouteIcon,
  Trash2,
} from 'lucide-react';
import {
  convertSpeed,
  formatDistance,
  formatElapsed,
  formatFuelVolume,
  speedUnitLabel,
} from '../lib/geoUtils';
import type {RideHistoryEntry, RidePlace, UnitSystem} from '../types/ride';

interface RideHistoryPanelProps {
  history: RideHistoryEntry[];
  unitSystem: UnitSystem;
  onRideAgain: (place: RidePlace) => void;
  onDeleteEntry: (id: string) => void;
  onClearHistory: () => void;
}

function formatRideTimestamp(timestampMs: number): string {
  const date = new Date(timestampMs);
  const now = new Date();
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate();

  const timeStr = date.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });

  if (isToday) return `Today · ${timeStr}`;
  if (isYesterday) return `Yesterday · ${timeStr}`;
  const dateStr = date.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
  });
  return `${dateStr} · ${timeStr}`;
}

export function RideHistoryPanel({
  history,
  unitSystem,
  onRideAgain,
  onDeleteEntry,
  onClearHistory,
}: RideHistoryPanelProps) {
  const [confirmClear, setConfirmClear] = useState(false);

  const totalDistanceMeters = history.reduce(
    (sum, item) => sum + item.distanceMeters,
    0
  );
  const totalDurationMs = history.reduce(
    (sum, item) => sum + item.durationMs,
    0
  );

  return (
    <section
      aria-label="Ride History"
      className="p-4 sm:p-5 border-b border-slate-200 dark:border-white/10 space-y-3"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-orange-500 shrink-0" />
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Ride History
          </span>
          {history.length > 0 && (
            <span className="font-mono-tabular text-[11px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300">
              {history.length}
            </span>
          )}
        </div>

        {history.length > 0 && (
          <div className="flex items-center gap-1.5">
            {confirmClear ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    onClearHistory();
                    setConfirmClear(false);
                  }}
                  className="min-h-[36px] px-2.5 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-500 transition-colors"
                >
                  Confirm Clear
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClear(false)}
                  className="min-h-[36px] px-2.5 rounded-lg bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-white/15 transition-colors"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmClear(true)}
                className="min-h-[36px] px-2.5 rounded-lg text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10 transition-colors"
              >
                Clear History
              </button>
            )}
          </div>
        )}
      </div>

      {history.length === 0 ? (
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#161B23] border border-slate-200 dark:border-white/10 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          No completed rides recorded yet. Finish or simulate a ride to log
          distance, duration, peak speed, and estimated fuel usage.
        </div>
      ) : (
        <>
          {/* Aggregate Totals */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2 rounded-xl bg-slate-50 dark:bg-[#161B23] border border-slate-200 dark:border-white/10">
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                Rides
              </div>
              <div className="font-mono-tabular text-sm font-bold mt-0.5 text-slate-900 dark:text-white">
                {history.length}
              </div>
            </div>
            <div className="p-2 rounded-xl bg-slate-50 dark:bg-[#161B23] border border-slate-200 dark:border-white/10">
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                Total Dist
              </div>
              <div className="font-mono-tabular text-sm font-bold mt-0.5 text-slate-900 dark:text-white">
                {formatDistance(totalDistanceMeters, unitSystem)}
              </div>
            </div>
            <div className="p-2 rounded-xl bg-slate-50 dark:bg-[#161B23] border border-slate-200 dark:border-white/10">
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                Total Time
              </div>
              <div className="font-mono-tabular text-sm font-bold mt-0.5 text-slate-900 dark:text-white">
                {formatElapsed(totalDurationMs)}
              </div>
            </div>
          </div>

          {/* Recorded Rides List */}
          <div className="space-y-2.5 max-h-[340px] overflow-y-auto cockpit-scroll pr-0.5">
            {history.map((entry) => {
              const isArrived = entry.status === 'arrived';
              return (
                <div
                  key={entry.id}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-[#161B23] border border-slate-200 dark:border-white/10 space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                          isArrived
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                            : 'bg-orange-500/15 text-orange-600 dark:text-orange-400'
                        }`}
                      >
                        {isArrived ? (
                          <CheckCircle2 className="w-4 h-4" />
                        ) : (
                          <Flag className="w-4 h-4" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
                          {entry.destinationName || 'Free Ride'}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          <span
                            className={`font-semibold ${
                              isArrived
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-orange-600 dark:text-orange-400'
                            }`}
                          >
                            {isArrived ? 'Arrived' : 'Ended'}
                          </span>
                          <span>·</span>
                          <span>{formatRideTimestamp(entry.endedAt)}</span>
                          <span>·</span>
                          <span className="inline-flex items-center gap-1">
                            {entry.travelMode === 'TWO_WHEELER' ? (
                              <>
                                <Bike className="w-3 h-3" />
                                <span>2-Wheeler</span>
                              </>
                            ) : (
                              <>
                                <Car className="w-3 h-3" />
                                <span>Road</span>
                              </>
                            )}
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onDeleteEntry(entry.id)}
                      aria-label={`Delete ride ${entry.destinationName || 'Free Ride'}`}
                      className="min-h-[36px] min-w-[36px] rounded-lg flex items-center justify-center text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10 shrink-0 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-4 gap-1.5 text-center">
                    <div className="py-1.5 px-1 rounded-lg bg-white dark:bg-[#11151B] border border-slate-200/80 dark:border-white/5">
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center justify-center gap-0.5">
                        <Clock className="w-3 h-3 text-orange-500" />
                        <span>Time</span>
                      </div>
                      <div className="font-mono-tabular text-xs font-bold mt-0.5 text-slate-900 dark:text-white">
                        {formatElapsed(entry.durationMs)}
                      </div>
                    </div>

                    <div className="py-1.5 px-1 rounded-lg bg-white dark:bg-[#11151B] border border-slate-200/80 dark:border-white/5">
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center justify-center gap-0.5">
                        <RouteIcon className="w-3 h-3 text-emerald-500" />
                        <span>Dist</span>
                      </div>
                      <div className="font-mono-tabular text-xs font-bold mt-0.5 text-slate-900 dark:text-white">
                        {formatDistance(entry.distanceMeters, unitSystem)}
                      </div>
                    </div>

                    <div className="py-1.5 px-1 rounded-lg bg-white dark:bg-[#11151B] border border-slate-200/80 dark:border-white/5">
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center justify-center gap-0.5">
                        <Gauge className="w-3 h-3 text-sky-500" />
                        <span>Max</span>
                      </div>
                      <div className="font-mono-tabular text-xs font-bold mt-0.5 text-slate-900 dark:text-white">
                        {convertSpeed(entry.maxSpeedMps, unitSystem)}{' '}
                        {speedUnitLabel(unitSystem)}
                      </div>
                    </div>

                    <div className="py-1.5 px-1 rounded-lg bg-white dark:bg-[#11151B] border border-slate-200/80 dark:border-white/5">
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center justify-center gap-0.5">
                        <Fuel className="w-3 h-3 text-amber-500" />
                        <span>Fuel</span>
                      </div>
                      <div className="font-mono-tabular text-xs font-bold mt-0.5 text-slate-900 dark:text-white">
                        {formatFuelVolume(entry.fuelUsedLiters, unitSystem)}
                      </div>
                    </div>
                  </div>

                  {entry.destination && (
                    <button
                      type="button"
                      onClick={() => onRideAgain(entry.destination!)}
                      className="w-full min-h-[44px] px-3 rounded-xl bg-orange-600/10 hover:bg-orange-600/20 text-orange-600 dark:text-orange-400 text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
                    >
                      <Navigation className="w-3.5 h-3.5" />
                      <span>Ride Again</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
