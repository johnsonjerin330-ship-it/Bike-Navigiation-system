import {useState} from 'react';
import {
  ArrowUp,
  Bike,
  Car,
  ChevronDown,
  ChevronUp,
  Coffee,
  CornerUpLeft,
  CornerUpRight,
  Flag,
  Fuel,
  History,
  Loader2,
  MapPin,
  Merge,
  Navigation,
  Pause,
  Play,
  RotateCw,
  Route as RouteIcon,
  Search,
  Trees,
  Utensils,
  X,
} from 'lucide-react';
import {
  useAutocompleteSuggestions,
  type AutocompletePredictionItem,
} from '../hooks/useAutocompleteSuggestions';
import {
  convertSpeed,
  formatDistance,
  formatDuration,
  formatEtaClock,
  speedUnitLabel,
} from '../lib/geoUtils';
import type {
  ComputedRouteData,
  LatLng,
  NearbyStopCategory,
  NavStep,
  RideHistoryEntry,
  RidePlace,
  RouteModifierOptions,
  TravelModeChoice,
  UnitSystem,
} from '../types/ride';

interface NavigationPanelProps {
  riderPosition: LatLng;
  gpsPermissionState: 'idle' | 'requesting' | 'active' | 'denied' | 'unavailable';
  gpsError: string | null;
  onRequestGps: () => void;
  destination: RidePlace | null;
  waypoints: RidePlace[];
  route: ComputedRouteData | null;
  isComputingRoute: boolean;
  routeError: string | null;
  activeStepIndex: number;
  remainingDistanceMeters: number;
  remainingDurationMillis: number;
  unitSystem: UnitSystem;
  travelMode: TravelModeChoice;
  modifiers: RouteModifierOptions;
  isSimulating: boolean;
  simSpeedMps: number;
  onAdjustSimSpeed: (deltaMps: number) => void;
  onSelectDestination: (place: RidePlace) => void;
  onRemoveWaypoint: (id: string) => void;
  onToggleModifier: (key: keyof RouteModifierOptions) => void;
  onChangeTravelMode: (mode: TravelModeChoice) => void;
  onEndRide: () => void;
  onToggleSimulation: () => void;
  onSelectStep: (idx: number) => void;
  onQuickCategory: (category: NearbyStopCategory) => void;
  rideHistory: RideHistoryEntry[];
  onOpenHistory: () => void;
}

function getManeuverIcon(maneuver: string, instructions: string) {
  const m = maneuver.toUpperCase();
  const text = instructions.toLowerCase();
  if (m.includes('LEFT') || text.includes('turn left')) {
    return CornerUpLeft;
  }
  if (m.includes('RIGHT') || text.includes('turn right')) {
    return CornerUpRight;
  }
  if (m.includes('ROUNDABOUT')) {
    return RotateCw;
  }
  if (m.includes('MERGE') || m.includes('RAMP')) {
    return Merge;
  }
  if (m.includes('ARRIVE') || text.includes('destination')) {
    return Flag;
  }
  return ArrowUp;
}

export function NavigationPanel({
  riderPosition,
  gpsPermissionState,
  gpsError,
  onRequestGps,
  destination,
  waypoints,
  route,
  isComputingRoute,
  routeError,
  activeStepIndex,
  remainingDistanceMeters,
  remainingDurationMillis,
  unitSystem,
  travelMode,
  modifiers,
  isSimulating,
  simSpeedMps,
  onAdjustSimSpeed,
  onSelectDestination,
  onRemoveWaypoint,
  onToggleModifier,
  onChangeTravelMode,
  onEndRide,
  onToggleSimulation,
  onSelectStep,
  onQuickCategory,
  rideHistory,
  onOpenHistory,
}: NavigationPanelProps) {
  const [query, setQuery] = useState('');
  const [showAllSteps, setShowAllSteps] = useState(false);

  const {
    predictions,
    isLoading: isSearching,
    error: searchError,
    selectPrediction,
    resetSession,
  } = useAutocompleteSuggestions(query, riderPosition);

  const handlePickPrediction = async (item: AutocompletePredictionItem) => {
    const place = await selectPrediction(item);
    if (place) {
      setQuery('');
      onSelectDestination(place);
    }
  };

  const currentStep: NavStep | undefined =
    route?.steps[Math.min(activeStepIndex, Math.max(0, (route?.steps.length ?? 1) - 1))];
  const nextStep: NavStep | undefined =
    route && activeStepIndex + 1 < route.steps.length
      ? route.steps[activeStepIndex + 1]
      : undefined;

  // Active Navigation View
  if (route && destination) {
    const ManeuverIcon = currentStep
      ? getManeuverIcon(currentStep.maneuver, currentStep.instructions)
      : Navigation;

    return (
      <div className="flex flex-col h-full bg-white dark:bg-[#11151B] text-slate-900 dark:text-slate-100">
        {/* Top Turn-by-Turn Maneuver HUD */}
        <div className="p-4 sm:p-5 bg-slate-900 dark:bg-[#161B23] text-white border-b border-slate-800 dark:border-white/10">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl bg-orange-600 flex items-center justify-center shrink-0 shadow-md">
              <ManeuverIcon className="w-9 h-9 text-white" strokeWidth={2.4} />
            </div>

            <div className="min-w-0 flex-1">
              <div className="font-display text-4xl font-bold leading-none tracking-tight tabular-nums text-orange-400">
                {currentStep
                  ? formatDistance(currentStep.distanceMeters, unitSystem)
                  : formatDistance(remainingDistanceMeters, unitSystem)}
              </div>
              <p className="mt-1.5 text-base sm:text-lg font-semibold leading-snug text-white">
                {currentStep?.instructions || `Proceed toward ${destination.name}`}
              </p>
            </div>
          </div>

          {nextStep && (
            <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between gap-2 text-xs sm:text-sm text-slate-300">
              <span className="truncate">
                Then: {nextStep.instructions}
              </span>
              <span className="font-mono-tabular shrink-0 text-slate-400">
                {formatDistance(nextStep.distanceMeters, unitSystem)}
              </span>
            </div>
          )}
        </div>

        {/* Route Notices (Two-Wheeler Beta / Fallback) */}
        {(route.travelModeUsed === 'TWO_WHEELER' ||
          route.fallbackFromTwoWheeler) && (
          <div className="px-4 py-2 text-xs bg-amber-500/10 text-amber-800 dark:text-amber-300 border-b border-amber-500/20">
            {route.fallbackFromTwoWheeler
              ? 'Two-wheeler routing is unavailable in this region; using standard road route.'
              : 'Two-wheel routes are in beta; verify road signage and local restrictions.'}
          </div>
        )}

        {/* ETA & Remaining Telemetry */}
        <div className="px-4 py-3.5 border-b border-slate-200 dark:border-white/10 flex items-center justify-between gap-4">
          <div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Arrival
            </div>
            <div className="font-mono-tabular text-xl font-bold text-slate-900 dark:text-white">
              {formatEtaClock(remainingDurationMillis)}
            </div>
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Remaining
            </div>
            <div className="font-mono-tabular text-base font-semibold text-slate-800 dark:text-slate-200">
              {formatDuration(remainingDurationMillis)} ·{' '}
              {formatDistance(remainingDistanceMeters, unitSystem)}
            </div>
          </div>
          <div className="text-right min-w-0">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Destination
            </div>
            <div className="text-sm font-semibold truncate max-w-[130px] text-slate-900 dark:text-white">
              {destination.name}
            </div>
          </div>
        </div>

        {/* Waypoints + Route Modifiers */}
        <div className="px-4 py-3 border-b border-slate-200 dark:border-white/10 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onToggleModifier('avoidHighways')}
            className={`min-h-[44px] px-3 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap ${
              modifiers.avoidHighways
                ? 'bg-orange-600 text-white border-orange-600'
                : 'bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-white/10'
            }`}
          >
            Avoid Highways
          </button>
          <button
            type="button"
            onClick={() => onToggleModifier('avoidTolls')}
            className={`min-h-[44px] px-3 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap ${
              modifiers.avoidTolls
                ? 'bg-orange-600 text-white border-orange-600'
                : 'bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-white/10'
            }`}
          >
            Avoid Tolls
          </button>
          <button
            type="button"
            onClick={() =>
              onChangeTravelMode(
                travelMode === 'TWO_WHEELER' ? 'DRIVING' : 'TWO_WHEELER'
              )
            }
            className="min-h-[44px] px-3 rounded-lg text-xs font-semibold border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-200 flex items-center gap-1.5 whitespace-nowrap"
          >
            {travelMode === 'TWO_WHEELER' ? (
              <>
                <Bike className="w-4 h-4 text-orange-500" />
                <span>2-Wheeler</span>
              </>
            ) : (
              <>
                <Car className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                <span>Road</span>
              </>
            )}
          </button>
        </div>

        {waypoints.length > 0 && (
          <div className="px-4 py-2.5 border-b border-slate-200 dark:border-white/10 space-y-1.5">
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Stops along ride
            </div>
            {waypoints.map((wp, idx) => (
              <div
                key={wp.id}
                className="flex items-center justify-between gap-2 text-sm py-1"
              >
                <span className="truncate font-medium">
                  {idx + 1}. {wp.name}
                </span>
                <button
                  type="button"
                  onClick={() => onRemoveWaypoint(wp.id)}
                  aria-label={`Remove stop ${wp.name}`}
                  className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-500 hover:text-red-500 hover:bg-red-500/10"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Turn-by-Turn Steps List (Expandable) */}
        <div className="flex-1 min-h-0 flex flex-col">
          <button
            type="button"
            onClick={() => setShowAllSteps((prev) => !prev)}
            className="w-full min-h-[48px] px-4 flex items-center justify-between text-sm font-semibold text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5"
          >
            <span>
              Route Steps ({route.steps.length})
            </span>
            {showAllSteps ? (
              <ChevronUp className="w-5 h-5" />
            ) : (
              <ChevronDown className="w-5 h-5" />
            )}
          </button>

          {showAllSteps ? (
            <div className="flex-1 overflow-y-auto cockpit-scroll divide-y divide-slate-100 dark:divide-white/5">
              {route.steps.map((step) => {
                const Icon = getManeuverIcon(step.maneuver, step.instructions);
                const isCurrent = step.index === activeStepIndex;
                return (
                  <button
                    key={step.index}
                    type="button"
                    onClick={() => onSelectStep(step.index)}
                    className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors ${
                      isCurrent
                        ? 'bg-orange-500/10 dark:bg-orange-500/15'
                        : 'hover:bg-slate-50 dark:hover:bg-white/5'
                    }`}
                  >
                    <Icon
                      className={`w-5 h-5 mt-0.5 shrink-0 ${
                        isCurrent
                          ? 'text-orange-600 dark:text-orange-400'
                          : 'text-slate-400'
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                        {step.instructions}
                      </div>
                      <div className="text-xs font-mono-tabular text-slate-500 dark:text-slate-400 mt-0.5">
                        {formatDistance(step.distanceMeters, unitSystem)}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex-1 p-4 flex flex-col justify-center gap-3">
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Quick Rider Stops
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onQuickCategory('gas_station')}
                  className="min-h-[48px] px-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 flex items-center gap-2.5 text-sm font-semibold"
                >
                  <Fuel className="w-5 h-5 text-orange-500 shrink-0" />
                  <span>Fuel</span>
                </button>
                <button
                  type="button"
                  onClick={() => onQuickCategory('cafe')}
                  className="min-h-[48px] px-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 flex items-center gap-2.5 text-sm font-semibold"
                >
                  <Coffee className="w-5 h-5 text-amber-500 shrink-0" />
                  <span>Coffee</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Glove-Friendly Action Bar */}
        <div className="p-3 sm:p-4 border-t border-slate-200 dark:border-white/10 space-y-2.5 bg-slate-50 dark:bg-[#0D1015]">
          {isSimulating && (
            <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-white dark:bg-[#161B23] border border-slate-200 dark:border-white/10">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Sim Pace
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onAdjustSimSpeed(-4)}
                  className="min-h-[38px] min-w-[44px] px-2.5 rounded-lg bg-slate-100 dark:bg-white/10 text-xs font-bold hover:bg-slate-200 dark:hover:bg-white/15"
                >
                  -
                </button>
                <span className="font-mono-tabular text-sm font-bold min-w-[74px] text-center">
                  {convertSpeed(simSpeedMps, unitSystem)} {speedUnitLabel(unitSystem)}
                </span>
                <button
                  type="button"
                  onClick={() => onAdjustSimSpeed(4)}
                  className="min-h-[38px] min-w-[44px] px-2.5 rounded-lg bg-slate-100 dark:bg-white/10 text-xs font-bold hover:bg-slate-200 dark:hover:bg-white/15"
                >
                  +
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={onToggleSimulation}
              className={`min-h-[52px] px-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-colors ${
                isSimulating
                  ? 'bg-amber-600 text-white hover:bg-amber-500'
                  : 'bg-slate-200 dark:bg-white/10 text-slate-900 dark:text-white hover:bg-slate-300 dark:hover:bg-white/15'
              }`}
            >
              {isSimulating ? (
                <>
                  <Pause className="w-5 h-5" />
                  <span>Pause Sim</span>
                </>
              ) : (
                <>
                  <Play className="w-5 h-5" />
                  <span>Simulate Ride</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onEndRide}
              className="min-h-[52px] px-4 rounded-xl font-semibold text-sm bg-red-600 text-white hover:bg-red-500 flex items-center justify-center gap-2 transition-colors"
            >
              <X className="w-5 h-5" />
              <span>End Ride</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Idle / Ride Planning View
  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#11151B] text-slate-900 dark:text-slate-100">
      <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-white/10">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Ride Navigation
          </h1>
          {gpsPermissionState !== 'active' && (
            <button
              type="button"
              onClick={onRequestGps}
              className="min-h-[40px] px-3 rounded-lg bg-orange-600/10 text-orange-600 dark:text-orange-400 text-xs font-semibold hover:bg-orange-600/20 transition-colors whitespace-nowrap"
            >
              {gpsPermissionState === 'requesting' ? 'Locating...' : 'Enable GPS'}
            </button>
          )}
        </div>

        {/* Glove-friendly Place Autocomplete Input */}
        <div className="relative">
          <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Where are you riding?"
            aria-label="Search destination"
            className="w-full min-h-[52px] pl-11 pr-11 rounded-xl border border-slate-300 dark:border-white/15 bg-slate-50 dark:bg-[#181D25] text-base font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                resetSession();
              }}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {(isSearching || isComputingRoute) && (
          <div className="mt-2.5 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin text-orange-500" />
            <span>
              {isComputingRoute
                ? 'Computing motorcycle route...'
                : 'Searching places...'}
            </span>
          </div>
        )}

        {(searchError || routeError || gpsError) && (
          <div className="mt-2.5 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-700 dark:text-red-300">
            {routeError || searchError || gpsError}
          </div>
        )}
      </div>

      {/* Predictions List or Quick Rider Actions */}
      <div className="flex-1 overflow-y-auto cockpit-scroll p-4 space-y-5">
        {predictions.length > 0 ? (
          <div className="divide-y divide-slate-200 dark:divide-white/10 rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden">
            {predictions.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => void handlePickPrediction(item)}
                className="w-full min-h-[56px] px-4 py-3 text-left flex items-start gap-3 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
              >
                <MapPin className="w-5 h-5 text-orange-500 mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                    {item.mainText}
                  </div>
                  {item.secondaryText && (
                    <div className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                      {item.secondaryText}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <>
            {/* Quick Rider Stops */}
            <div>
              <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2.5">
                Quick Rider Stops
              </h2>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => onQuickCategory('gas_station')}
                  className="min-h-[56px] px-3.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 flex items-center gap-3 text-sm font-semibold transition-colors"
                >
                  <Fuel className="w-5 h-5 text-orange-500 shrink-0" />
                  <span>Fuel Stations</span>
                </button>
                <button
                  type="button"
                  onClick={() => onQuickCategory('cafe')}
                  className="min-h-[56px] px-3.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 flex items-center gap-3 text-sm font-semibold transition-colors"
                >
                  <Coffee className="w-5 h-5 text-amber-500 shrink-0" />
                  <span>Coffee Stops</span>
                </button>
                <button
                  type="button"
                  onClick={() => onQuickCategory('restaurant')}
                  className="min-h-[56px] px-3.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 flex items-center gap-3 text-sm font-semibold transition-colors"
                >
                  <Utensils className="w-5 h-5 text-emerald-500 shrink-0" />
                  <span>Food & Diner</span>
                </button>
                <button
                  type="button"
                  onClick={() => onQuickCategory('park')}
                  className="min-h-[56px] px-3.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 flex items-center gap-3 text-sm font-semibold transition-colors"
                >
                  <Trees className="w-5 h-5 text-sky-500 shrink-0" />
                  <span>Scenic Overlooks</span>
                </button>
              </div>
            </div>

            {/* Ride Routing Preferences */}
            <div>
              <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2.5">
                Routing Preferences
              </h2>
              <div className="grid grid-cols-2 gap-2 mb-2.5">
                <button
                  type="button"
                  onClick={() => onChangeTravelMode('TWO_WHEELER')}
                  className={`min-h-[48px] px-3 rounded-xl border text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${
                    travelMode === 'TWO_WHEELER'
                      ? 'bg-orange-600 text-white border-orange-600'
                      : 'bg-slate-50 dark:bg-white/5 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-white/10'
                  }`}
                >
                  <Bike className="w-4 h-4" />
                  <span>Two-Wheeler</span>
                </button>
                <button
                  type="button"
                  onClick={() => onChangeTravelMode('DRIVING')}
                  className={`min-h-[48px] px-3 rounded-xl border text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${
                    travelMode === 'DRIVING'
                      ? 'bg-orange-600 text-white border-orange-600'
                      : 'bg-slate-50 dark:bg-white/5 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-white/10'
                  }`}
                >
                  <Car className="w-4 h-4" />
                  <span>Standard Road</span>
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onToggleModifier('avoidHighways')}
                  className={`min-h-[44px] px-3.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                    modifiers.avoidHighways
                      ? 'bg-orange-600 text-white border-orange-600'
                      : 'bg-slate-50 dark:bg-white/5 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-white/10'
                  }`}
                >
                  <RouteIcon className="w-4 h-4" />
                  <span>Backroads (No Highways)</span>
                </button>
                <button
                  type="button"
                  onClick={() => onToggleModifier('avoidTolls')}
                  className={`min-h-[44px] px-3.5 rounded-xl border text-xs font-semibold transition-colors ${
                    modifiers.avoidTolls
                      ? 'bg-orange-600 text-white border-orange-600'
                      : 'bg-slate-50 dark:bg-white/5 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-white/10'
                  }`}
                >
                  Avoid Tolls
                </button>
                <button
                  type="button"
                  onClick={() => onToggleModifier('avoidFerries')}
                  className={`min-h-[44px] px-3.5 rounded-xl border text-xs font-semibold transition-colors ${
                    modifiers.avoidFerries
                      ? 'bg-orange-600 text-white border-orange-600'
                      : 'bg-slate-50 dark:bg-white/5 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-white/10'
                  }`}
                >
                  Avoid Ferries
                </button>
              </div>
            </div>

            {/* Recent Rides & History Access */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Recent Rides
                </h2>
                <button
                  type="button"
                  onClick={onOpenHistory}
                  className="text-xs font-semibold text-orange-600 dark:text-orange-400 hover:underline flex items-center gap-1"
                >
                  <History className="w-3.5 h-3.5" />
                  <span>
                    {rideHistory.length > 0
                      ? `Ride History (${rideHistory.length})`
                      : 'Ride History'}
                  </span>
                </button>
              </div>

              {rideHistory.filter((item) => item.destination !== null).length > 0 ? (
                <div className="space-y-2">
                  {rideHistory
                    .filter((item) => item.destination !== null)
                    .slice(0, 2)
                    .map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => onSelectDestination(item.destination!)}
                        className="w-full min-h-[48px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 flex items-center justify-between gap-2 text-left transition-colors"
                      >
                        <div className="min-w-0 flex items-center gap-2.5">
                          <MapPin className="w-4 h-4 text-orange-500 shrink-0" />
                          <span className="text-sm font-semibold truncate text-slate-900 dark:text-white">
                            {item.destinationName}
                          </span>
                        </div>
                        <span className="font-mono-tabular text-xs text-slate-500 dark:text-slate-400 shrink-0">
                          {formatDistance(item.distanceMeters, unitSystem)}
                        </span>
                      </button>
                    ))}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={onOpenHistory}
                  className="w-full min-h-[44px] px-3.5 rounded-xl border border-dashed border-slate-300 dark:border-white/15 bg-slate-50/70 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center justify-center gap-2 transition-colors"
                >
                  <History className="w-4 h-4 text-orange-500" />
                  <span>Open Rider Dash to view logged ride history</span>
                </button>
              )}
            </div>

            <div className="pt-2 border-t border-slate-200 dark:border-white/10 text-xs text-slate-500 dark:text-slate-400">
              Search any destination above or tap a Quick Rider Stop to load nearby fuel, coffee, and scenic stops on Google Maps.
            </div>
          </>
        )}
      </div>
    </div>
  );
}
