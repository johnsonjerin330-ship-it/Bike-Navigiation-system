import {useState} from 'react';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Flag,
  MapPin,
  Navigation,
  Route as RouteIcon,
} from 'lucide-react';
import {formatDistance, formatDuration} from '../lib/geoUtils';
import type {
  ComputedRouteData,
  RidePlace,
  TripSummary,
  UnitSystem,
} from '../types/ride';

interface TripTimelineProps {
  route: ComputedRouteData | null;
  destination: RidePlace | null;
  waypoints: RidePlace[];
  activeStepIndex: number;
  tripDistanceMeters: number;
  remainingDistanceMeters: number;
  remainingDurationMillis: number;
  unitSystem: UnitSystem;
  tripSummary: TripSummary | null;
  onSelectStep?: (idx: number) => void;
  onOpenNavigate: () => void;
}

export function TripTimeline({
  route,
  destination,
  waypoints,
  activeStepIndex,
  tripDistanceMeters,
  remainingDistanceMeters,
  remainingDurationMillis,
  unitSystem,
  tripSummary,
  onSelectStep,
  onOpenNavigate,
}: TripTimelineProps) {
  const [expanded, setExpanded] = useState(false);

  // Active Route Timeline Visualization
  if (route && route.steps.length > 0) {
    const steps = route.steps;
    const totalRouteMeters =
      route.distanceMeters > 0
        ? route.distanceMeters
        : steps.reduce((sum, s) => sum + s.distanceMeters, 0);

    const stepCompletedMeters = Math.max(
      0,
      totalRouteMeters - remainingDistanceMeters
    );
    const completedMeters = Math.min(
      totalRouteMeters,
      Math.max(stepCompletedMeters, tripDistanceMeters)
    );
    const remainingMeters = Math.max(0, totalRouteMeters - completedMeters);
    const completionPct =
      totalRouteMeters > 0
        ? Math.min(100, Math.round((completedMeters / totalRouteMeters) * 100))
        : 0;

    // Show a focused window around the active step unless expanded
    const visibleSteps = expanded
      ? steps
      : steps.slice(Math.max(0, activeStepIndex - 1), activeStepIndex + 4);

    return (
      <section
        aria-label="Trip Timeline"
        className="p-4 sm:p-5 border-b border-slate-200 dark:border-white/10 space-y-3.5"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <RouteIcon className="w-4 h-4 text-orange-500 shrink-0" />
            <div className="min-w-0">
              <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Trip Timeline
              </h3>
              <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
                {destination?.name || 'Active Route'}
                {waypoints.length > 0 ? ` · ${waypoints.length} stop${waypoints.length > 1 ? 's' : ''}` : ''}
              </div>
            </div>
          </div>

          <span className="font-mono-tabular text-xs font-bold text-orange-600 dark:text-orange-400 shrink-0">
            {completionPct}%
          </span>
        </div>

        {/* Graphical Segmented Progress Bar (Completed vs Remaining Segments) */}
        <div className="space-y-2">
          <div
            role="progressbar"
            aria-valuenow={completionPct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Route progress: ${completionPct}% completed`}
            className="w-full h-3.5 rounded-full bg-slate-200 dark:bg-white/10 p-0.5 flex items-center gap-0.5 overflow-hidden"
          >
            {steps.map((step) => {
              const isCompleted = step.index < activeStepIndex;
              const isCurrent = step.index === activeStepIndex;
              const weight = Math.max(step.distanceMeters, 40);

              return (
                <div
                  key={step.index}
                  style={{flexGrow: weight, flexBasis: 0}}
                  title={`${step.instructions} (${formatDistance(step.distanceMeters, unitSystem)})`}
                  className={`h-full rounded-sm transition-colors ${
                    isCompleted
                      ? 'bg-emerald-500'
                      : isCurrent
                        ? 'bg-orange-500'
                        : 'bg-slate-300 dark:bg-white/20'
                  }`}
                />
              );
            })}
          </div>

          {/* Completed vs Remaining Distance Readout */}
          <div className="grid grid-cols-2 gap-2">
            <div className="px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                Completed
              </span>
              <span className="font-mono-tabular text-xs font-bold text-emerald-700 dark:text-emerald-200">
                {formatDistance(completedMeters, unitSystem)}
              </span>
            </div>

            <div className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                Remaining
              </span>
              <span className="font-mono-tabular text-xs font-bold text-slate-900 dark:text-white">
                {formatDistance(remainingMeters, unitSystem)} ·{' '}
                {formatDuration(remainingDurationMillis)}
              </span>
            </div>
          </div>
        </div>

        {/* Vertical Route Segment Timeline */}
        <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/80 dark:bg-[#161B23] p-3 space-y-1">
          {visibleSteps.map((step, idx) => {
            const isCompleted = step.index < activeStepIndex;
            const isCurrent = step.index === activeStepIndex;
            const isLastVisible = idx === visibleSteps.length - 1;
            const isFinalStep = step.index === steps.length - 1;

            return (
              <button
                key={step.index}
                type="button"
                onClick={() => onSelectStep?.(step.index)}
                className={`w-full text-left flex items-stretch gap-3 rounded-lg px-2 py-1.5 transition-colors ${
                  isCurrent
                    ? 'bg-orange-500/12 dark:bg-orange-500/15'
                    : 'hover:bg-slate-200/60 dark:hover:bg-white/5'
                }`}
              >
                {/* Vertical Track & Node */}
                <div className="flex flex-col items-center w-5 shrink-0 pt-0.5">
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                      isCompleted
                        ? 'bg-emerald-500 text-white'
                        : isCurrent
                          ? 'bg-orange-600 text-white ring-4 ring-orange-500/25'
                          : isFinalStep
                            ? 'bg-slate-700 text-white dark:bg-white/20'
                            : 'bg-slate-300 dark:bg-white/15 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {isCompleted ? (
                      <Check className="w-3 h-3" strokeWidth={3} />
                    ) : isCurrent ? (
                      <Navigation className="w-3 h-3" />
                    ) : isFinalStep ? (
                      <Flag className="w-3 h-3" />
                    ) : (
                      <span className="text-[10px] font-bold font-mono-tabular">
                        {step.index + 1}
                      </span>
                    )}
                  </div>

                  {!isLastVisible && (
                    <div
                      className={`w-0.5 flex-1 min-h-[14px] mt-1 rounded-full ${
                        isCompleted
                          ? 'bg-emerald-500/70'
                          : isCurrent
                            ? 'bg-orange-500/50'
                            : 'bg-slate-300 dark:bg-white/15'
                      }`}
                    />
                  )}
                </div>

                {/* Segment Details */}
                <div className="min-w-0 flex-1 pb-1">
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className={`text-xs leading-snug ${
                        isCompleted
                          ? 'text-slate-500 dark:text-slate-400 line-through'
                          : isCurrent
                            ? 'font-bold text-slate-900 dark:text-white'
                            : 'font-medium text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      {step.instructions}
                    </span>
                    <span className="font-mono-tabular text-[11px] font-semibold text-slate-500 dark:text-slate-400 shrink-0">
                      {formatDistance(step.distanceMeters, unitSystem)}
                    </span>
                  </div>
                  <div className="text-[10px] font-semibold uppercase tracking-wide mt-0.5">
                    {isCompleted ? (
                      <span className="text-emerald-600 dark:text-emerald-400">
                        Completed
                      </span>
                    ) : isCurrent ? (
                      <span className="text-orange-600 dark:text-orange-400">
                        Active Segment ({step.index + 1} of {steps.length})
                      </span>
                    ) : (
                      <span className="text-slate-400 dark:text-slate-500">
                        Upcoming
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}

          {steps.length > 4 && (
            <button
              type="button"
              onClick={() => setExpanded((prev) => !prev)}
              className="w-full min-h-[36px] mt-1 pt-1.5 border-t border-slate-200 dark:border-white/10 text-xs font-semibold text-orange-600 dark:text-orange-400 flex items-center justify-center gap-1 hover:underline"
            >
              {expanded ? (
                <>
                  <ChevronUp className="w-4 h-4" />
                  <span>Show Active Window</span>
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4" />
                  <span>View All {steps.length} Segments</span>
                </>
              )}
            </button>
          )}
        </div>
      </section>
    );
  }

  // Completed Trip Fallback Timeline (after Ride Ends)
  if (tripSummary) {
    return (
      <section
        aria-label="Trip Timeline"
        className="p-4 sm:p-5 border-b border-slate-200 dark:border-white/10 space-y-2.5"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Trip Timeline
          </span>
          <span className="font-mono-tabular text-xs font-bold text-emerald-600 dark:text-emerald-400">
            {tripSummary.status === 'arrived' ? '100% Arrived' : 'Ended'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
            <MapPin className="w-3.5 h-3.5" />
          </div>
          <div className="flex-1 h-2.5 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden">
            <div
              className={`h-full rounded-full ${
                tripSummary.status === 'arrived'
                  ? 'w-full bg-emerald-500'
                  : 'w-3/4 bg-orange-500'
              }`}
            />
          </div>
          <div
            className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
              tripSummary.status === 'arrived'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-300 dark:bg-white/15 text-slate-600 dark:text-slate-300'
            }`}
          >
            <Flag className="w-3.5 h-3.5" />
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>
            Covered:{' '}
            <strong className="font-mono-tabular text-slate-800 dark:text-slate-200">
              {formatDistance(tripSummary.distanceMeters, unitSystem)}
            </strong>
          </span>
          <span className="truncate max-w-[180px]">
            {tripSummary.destinationName || 'Free Ride'}
          </span>
        </div>
      </section>
    );
  }

  // Idle State (No Active Route)
  return (
    <section
      aria-label="Trip Timeline"
      className="p-4 sm:p-5 border-b border-slate-200 dark:border-white/10 space-y-2.5"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <RouteIcon className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Trip Timeline
          </span>
        </div>
        <button
          type="button"
          onClick={onOpenNavigate}
          className="text-xs font-semibold text-orange-600 dark:text-orange-400 hover:underline"
        >
          Set Destination
        </button>
      </div>

      <div className="w-full h-2.5 rounded-full bg-slate-200 dark:bg-white/10" />

      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        <span>
          Completed:{' '}
          <strong className="font-mono-tabular text-slate-700 dark:text-slate-300">
            {formatDistance(tripDistanceMeters, unitSystem)}
          </strong>
        </span>
        <span>No active route segments</span>
      </div>
    </section>
  );
}
