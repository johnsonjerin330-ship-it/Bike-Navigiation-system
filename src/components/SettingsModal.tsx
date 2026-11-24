import {useEffect, useState} from 'react';
import {
  Activity,
  AlertTriangle,
  Bike,
  Car,
  Fuel,
  Moon,
  Smartphone,
  Sun,
  Volume2,
} from 'lucide-react';
import {
  estimateFuelLiters,
  formatDistance,
  formatEfficiency,
  formatFuelVolume,
  gallonsToLiters,
  kmPerLiterToMpg,
  litersToGallons,
  mpgToKmPerLiter,
  speedUnitLabel,
} from '../lib/geoUtils';
import type {
  BikeFuelConfig,
  SpeedLimitStatus,
  TravelModeChoice,
  UnitSystem,
} from '../types/ride';

interface SettingsModalProps {
  isDark: boolean;
  onToggleTheme: () => void;
  unitSystem: UnitSystem;
  onChangeUnits: (units: UnitSystem) => void;
  travelMode: TravelModeChoice;
  onChangeTravelMode: (mode: TravelModeChoice) => void;
  voiceEnabled: boolean;
  onToggleVoice: () => void;
  showTraffic: boolean;
  onToggleTraffic: () => void;
  wakeLockEnabled: boolean;
  wakeLockSupported: boolean;
  onToggleWakeLock: () => void;
  speedLimitAlertsEnabled: boolean;
  onToggleSpeedLimitAlerts: () => void;
  manualLimit: number | null;
  onSetManualLimit: (limit: number | null) => void;
  roadStatus: SpeedLimitStatus;
  bikeFuelConfig: BikeFuelConfig;
  onChangeBikeFuelConfig: (next: BikeFuelConfig) => void;
  tripDistanceMeters: number;
  activeRouteDistanceMeters: number;
}

export function SettingsModal({
  isDark,
  onToggleTheme,
  unitSystem,
  onChangeUnits,
  travelMode,
  onChangeTravelMode,
  voiceEnabled,
  onToggleVoice,
  showTraffic,
  onToggleTraffic,
  wakeLockEnabled,
  wakeLockSupported,
  onToggleWakeLock,
  speedLimitAlertsEnabled,
  onToggleSpeedLimitAlerts,
  manualLimit,
  onSetManualLimit,
  roadStatus,
  bikeFuelConfig,
  onChangeBikeFuelConfig,
  tripDistanceMeters,
  activeRouteDistanceMeters,
}: SettingsModalProps) {
  const unitText = speedUnitLabel(unitSystem);
  const presets =
    unitSystem === 'IMPERIAL'
      ? [25, 35, 45, 55, 65, 75]
      : [40, 50, 60, 80, 100, 120];

  const isImperial = unitSystem === 'IMPERIAL';
  const distanceUnit = isImperial ? 'mi' : 'km';
  const efficiencyUnit = isImperial ? 'mpg' : 'km/L';

  const [calcDistanceInput, setCalcDistanceInput] = useState<string>(() =>
    isImperial ? '60' : '100'
  );

  // Keep custom calculator distance sensible when toggling units
  useEffect(() => {
    setCalcDistanceInput((prev) => {
      const n = Number(prev);
      if (!Number.isFinite(n) || n <= 0) return isImperial ? '60' : '100';
      const converted = isImperial ? n * 0.621371 : n / 0.621371;
      return String(Math.max(1, Math.round(converted)));
    });
  }, [isImperial]);

  const displayedEfficiency = isImperial
    ? Math.round(kmPerLiterToMpg(bikeFuelConfig.efficiencyKmPerLiter))
    : Number(bikeFuelConfig.efficiencyKmPerLiter.toFixed(1));

  const displayedTank = isImperial
    ? Number(litersToGallons(bikeFuelConfig.tankCapacityLiters).toFixed(1))
    : Number(bikeFuelConfig.tankCapacityLiters.toFixed(1));

  const efficiencyPresets = [
    {label: 'Sport', kmPerL: 15},
    {label: 'Cruiser', kmPerL: 20},
    {label: 'Tourer', kmPerL: 25},
    {label: 'Commuter', kmPerL: 35},
  ];

  const tankPresetsLiters = [12, 15, 18, 22];

  const adjustEfficiency = (deltaDisplay: number) => {
    if (isImperial) {
      const nextMpg = Math.min(180, Math.max(12, displayedEfficiency + deltaDisplay));
      onChangeBikeFuelConfig({
        ...bikeFuelConfig,
        efficiencyKmPerLiter: mpgToKmPerLiter(nextMpg),
      });
    } else {
      const nextKmL = Math.min(80, Math.max(5, bikeFuelConfig.efficiencyKmPerLiter + deltaDisplay));
      onChangeBikeFuelConfig({
        ...bikeFuelConfig,
        efficiencyKmPerLiter: Number(nextKmL.toFixed(1)),
      });
    }
  };

  const handleEfficiencyInputChange = (raw: string) => {
    const val = Number(raw);
    if (!Number.isFinite(val) || val <= 0) return;
    if (isImperial) {
      const clampedMpg = Math.min(180, Math.max(10, val));
      onChangeBikeFuelConfig({
        ...bikeFuelConfig,
        efficiencyKmPerLiter: mpgToKmPerLiter(clampedMpg),
      });
    } else {
      const clampedKmL = Math.min(80, Math.max(5, val));
      onChangeBikeFuelConfig({
        ...bikeFuelConfig,
        efficiencyKmPerLiter: clampedKmL,
      });
    }
  };

  const adjustTank = (deltaDisplay: number) => {
    if (isImperial) {
      const nextGal = Math.min(10, Math.max(1, displayedTank + deltaDisplay));
      onChangeBikeFuelConfig({
        ...bikeFuelConfig,
        tankCapacityLiters: Number(gallonsToLiters(nextGal).toFixed(2)),
      });
    } else {
      const nextL = Math.min(35, Math.max(4, bikeFuelConfig.tankCapacityLiters + deltaDisplay));
      onChangeBikeFuelConfig({
        ...bikeFuelConfig,
        tankCapacityLiters: Number(nextL.toFixed(1)),
      });
    }
  };

  const parsedCalcDist = Math.max(0, Number(calcDistanceInput) || 0);
  const calcMeters = isImperial
    ? parsedCalcDist * 1609.344
    : parsedCalcDist * 1000;
  const calcFuelLiters = estimateFuelLiters(
    calcMeters,
    bikeFuelConfig.efficiencyKmPerLiter
  );
  const calcTankPct =
    bikeFuelConfig.tankCapacityLiters > 0
      ? Math.round((calcFuelLiters / bikeFuelConfig.tankCapacityLiters) * 100)
      : 0;
  const needsRefuel = calcFuelLiters > bikeFuelConfig.tankCapacityLiters;

  const tripFuelLiters = estimateFuelLiters(
    tripDistanceMeters,
    bikeFuelConfig.efficiencyKmPerLiter
  );
  const routeFuelLiters = estimateFuelLiters(
    activeRouteDistanceMeters,
    bikeFuelConfig.efficiencyKmPerLiter
  );
  const fullRangeMeters =
    bikeFuelConfig.tankCapacityLiters *
    bikeFuelConfig.efficiencyKmPerLiter *
    1000;

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#11151B] text-slate-900 dark:text-slate-100 overflow-y-auto cockpit-scroll">
      <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-white/10">
        <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Cockpit Setup
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Configure display contrast, units, speed limit warnings, and helmet voice prompts
        </p>
      </div>

      <div className="p-4 sm:p-5 space-y-5">
        {/* Display Theme */}
        <div>
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">
            Display Contrast
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => !isDark && onToggleTheme()}
              className={`min-h-[52px] px-3 rounded-xl border text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${
                isDark
                  ? 'bg-orange-600 text-white border-orange-600'
                  : 'bg-slate-50 dark:bg-white/5 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-white/10'
              }`}
            >
              <Moon className="w-4 h-4" />
              <span>Night Cockpit</span>
            </button>
            <button
              type="button"
              onClick={() => isDark && onToggleTheme()}
              className={`min-h-[52px] px-3 rounded-xl border text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${
                !isDark
                  ? 'bg-orange-600 text-white border-orange-600'
                  : 'bg-slate-50 dark:bg-white/5 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-white/10'
              }`}
            >
              <Sun className="w-4 h-4" />
              <span>Daylight</span>
            </button>
          </div>
        </div>

        {/* Speed & Distance Units */}
        <div>
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">
            Speed & Distance Units
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => onChangeUnits('METRIC')}
              className={`min-h-[52px] px-3 rounded-xl border text-sm font-semibold transition-colors ${
                unitSystem === 'METRIC'
                  ? 'bg-orange-600 text-white border-orange-600'
                  : 'bg-slate-50 dark:bg-white/5 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-white/10'
              }`}
            >
              Metric (km/h)
            </button>
            <button
              type="button"
              onClick={() => onChangeUnits('IMPERIAL')}
              className={`min-h-[52px] px-3 rounded-xl border text-sm font-semibold transition-colors ${
                unitSystem === 'IMPERIAL'
                  ? 'bg-orange-600 text-white border-orange-600'
                  : 'bg-slate-50 dark:bg-white/5 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-white/10'
              }`}
            >
              Imperial (mph)
            </button>
          </div>
        </div>

        {/* Speed Limit Alert Threshold */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Speed Limit Override ({unitText})
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
          <div className="grid grid-cols-3 gap-2">
            {presets.map((val) => {
              const selected = manualLimit === val;
              return (
                <button
                  key={val}
                  type="button"
                  onClick={() => onSetManualLimit(selected ? null : val)}
                  className={`min-h-[44px] rounded-xl border text-xs font-mono-tabular font-bold transition-colors ${
                    selected
                      ? 'bg-red-600 text-white border-red-600'
                      : 'bg-slate-50 dark:bg-white/5 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-white/10'
                  }`}
                >
                  {val} {unitText}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">
            {roadStatus.roadLimit !== null
              ? `Active road limit from Roads API: ${roadStatus.roadLimit} ${roadStatus.units}.`
              : 'When road speed limit data is unavailable on your key or road segment, choose a manual alert threshold above.'}
          </p>
        </div>

        {/* Default Travel Mode */}
        <div>
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">
            Routing Vehicle Profile
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => onChangeTravelMode('TWO_WHEELER')}
              className={`min-h-[52px] px-3 rounded-xl border text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${
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
              className={`min-h-[52px] px-3 rounded-xl border text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${
                travelMode === 'DRIVING'
                  ? 'bg-orange-600 text-white border-orange-600'
                  : 'bg-slate-50 dark:bg-white/5 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-white/10'
              }`}
            >
              <Car className="w-4 h-4" />
              <span>Standard Road</span>
            </button>
          </div>
        </div>

        {/* Bike Fuel Efficiency & Consumption Calculator */}
        <div className="p-4 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50/80 dark:bg-[#161B23] space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Fuel className="w-4 h-4 text-orange-500 shrink-0" />
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Fuel Efficiency & Calculator
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Full-tank range:{' '}
                  <span className="font-mono-tabular font-semibold text-slate-700 dark:text-slate-200">
                    {formatDistance(fullRangeMeters, unitSystem)}
                  </span>
                </p>
              </div>
            </div>
            <span className="font-mono-tabular text-xs font-bold text-orange-600 dark:text-orange-400">
              {formatEfficiency(bikeFuelConfig.efficiencyKmPerLiter, unitSystem)}
            </span>
          </div>

          {/* Bike Efficiency Presets + Stepper */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">
              Bike Fuel Efficiency ({efficiencyUnit})
            </span>

            <div className="grid grid-cols-4 gap-1.5">
              {efficiencyPresets.map((preset) => {
                const isSelected =
                  Math.abs(bikeFuelConfig.efficiencyKmPerLiter - preset.kmPerL) < 0.6;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() =>
                      onChangeBikeFuelConfig({
                        ...bikeFuelConfig,
                        efficiencyKmPerLiter: preset.kmPerL,
                      })
                    }
                    className={`min-h-[44px] px-1.5 rounded-xl border text-[11px] font-semibold flex flex-col items-center justify-center transition-colors ${
                      isSelected
                        ? 'bg-orange-600 text-white border-orange-600'
                        : 'bg-white dark:bg-white/5 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-white/10'
                    }`}
                  >
                    <span>{preset.label}</span>
                    <span className="font-mono-tabular text-[10px] opacity-85">
                      {isImperial
                        ? `${Math.round(kmPerLiterToMpg(preset.kmPerL))} mpg`
                        : `${preset.kmPerL} km/L`}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => adjustEfficiency(isImperial ? -2 : -1)}
                aria-label="Decrease bike fuel efficiency"
                className="min-h-[44px] min-w-[48px] rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 font-bold text-base hover:bg-slate-100 dark:hover:bg-white/10"
              >
                -
              </button>
              <div className="flex-1 relative">
                <input
                  type="number"
                  min={isImperial ? 10 : 5}
                  max={isImperial ? 180 : 80}
                  step={isImperial ? 1 : 0.5}
                  value={displayedEfficiency}
                  onChange={(e) => handleEfficiencyInputChange(e.target.value)}
                  aria-label={`Bike fuel efficiency in ${efficiencyUnit}`}
                  className="w-full min-h-[44px] px-3 pr-14 rounded-xl border border-slate-200 dark:border-white/15 bg-white dark:bg-[#0D1015] font-mono-tabular text-sm font-bold text-center"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">
                  {efficiencyUnit}
                </span>
              </div>
              <button
                type="button"
                onClick={() => adjustEfficiency(isImperial ? 2 : 1)}
                aria-label="Increase bike fuel efficiency"
                className="min-h-[44px] min-w-[48px] rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 font-bold text-base hover:bg-slate-100 dark:hover:bg-white/10"
              >
                +
              </button>
            </div>
          </div>

          {/* Tank Capacity */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Tank Capacity ({isImperial ? 'gal' : 'L'})
              </span>
              <span className="font-mono-tabular text-xs font-bold text-slate-800 dark:text-slate-200">
                {displayedTank} {isImperial ? 'gal' : 'L'}
              </span>
            </div>
            <div className="grid grid-cols-6 gap-1.5">
              <button
                type="button"
                onClick={() => adjustTank(isImperial ? -0.2 : -1)}
                aria-label="Decrease tank capacity"
                className="min-h-[40px] rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 font-bold text-sm"
              >
                -
              </button>
              {tankPresetsLiters.map((liters) => {
                const selected =
                  Math.abs(bikeFuelConfig.tankCapacityLiters - liters) < 0.4;
                return (
                  <button
                    key={liters}
                    type="button"
                    onClick={() =>
                      onChangeBikeFuelConfig({
                        ...bikeFuelConfig,
                        tankCapacityLiters: liters,
                      })
                    }
                    className={`min-h-[40px] rounded-xl border text-xs font-mono-tabular font-bold transition-colors ${
                      selected
                        ? 'bg-orange-600 text-white border-orange-600'
                        : 'bg-white dark:bg-white/5 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-white/10'
                    }`}
                  >
                    {isImperial
                      ? litersToGallons(liters).toFixed(1)
                      : liters}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => adjustTank(isImperial ? 0.2 : 1)}
                aria-label="Increase tank capacity"
                className="min-h-[40px] rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 font-bold text-sm"
              >
                +
              </button>
            </div>
          </div>

          {/* Live Trip & Interactive Distance Fuel Calculator */}
          <div className="pt-3 border-t border-slate-200 dark:border-white/10 space-y-2.5">
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2.5 rounded-xl bg-white dark:bg-[#0D1015] border border-slate-200 dark:border-white/10">
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  Current Trip ({formatDistance(tripDistanceMeters, unitSystem)})
                </div>
                <div className="font-mono-tabular text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                  {formatFuelVolume(tripFuelLiters, unitSystem)}
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-white dark:bg-[#0D1015] border border-slate-200 dark:border-white/10">
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  {activeRouteDistanceMeters > 0
                    ? `Active Route (${formatDistance(activeRouteDistanceMeters, unitSystem)})`
                    : 'Active Route'}
                </div>
                <div className="font-mono-tabular text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                  {activeRouteDistanceMeters > 0
                    ? formatFuelVolume(routeFuelLiters, unitSystem)
                    : '--'}
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Estimate Fuel for Distance ({distanceUnit})
                </span>
                <div className="flex items-center gap-1.5">
                  {activeRouteDistanceMeters > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const d = isImperial
                          ? activeRouteDistanceMeters / 1609.344
                          : activeRouteDistanceMeters / 1000;
                        setCalcDistanceInput(d.toFixed(1));
                      }}
                      className="text-[11px] font-semibold text-orange-600 dark:text-orange-400 hover:underline"
                    >
                      Use Route
                    </button>
                  )}
                  {tripDistanceMeters > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const d = isImperial
                          ? tripDistanceMeters / 1609.344
                          : tripDistanceMeters / 1000;
                        setCalcDistanceInput(d.toFixed(1));
                      }}
                      className="text-[11px] font-semibold text-orange-600 dark:text-orange-400 hover:underline"
                    >
                      Use Trip
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={calcDistanceInput}
                    onChange={(e) => setCalcDistanceInput(e.target.value)}
                    aria-label={`Distance in ${distanceUnit} for fuel calculation`}
                    className="w-full min-h-[44px] px-3 pr-10 rounded-xl border border-slate-200 dark:border-white/15 bg-white dark:bg-[#0D1015] font-mono-tabular text-sm font-bold"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">
                    {distanceUnit}
                  </span>
                </div>
                <div
                  className={`min-h-[44px] px-3.5 rounded-xl border flex flex-col justify-center text-right shrink-0 ${
                    needsRefuel
                      ? 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400'
                      : 'bg-emerald-500/10 border-emerald-500/25 text-emerald-700 dark:text-emerald-300'
                  }`}
                >
                  <span className="font-mono-tabular text-sm font-bold leading-tight">
                    {formatFuelVolume(calcFuelLiters, unitSystem)}
                  </span>
                  <span className="text-[10px] font-semibold leading-tight">
                    {needsRefuel
                      ? `${calcTankPct}% · Refuel needed`
                      : `${calcTankPct}% of tank`}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Toggles */}
        <div className="space-y-2.5 pt-2 border-t border-slate-200 dark:border-white/10">
          <button
            type="button"
            onClick={onToggleSpeedLimitAlerts}
            className="w-full min-h-[56px] px-4 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#161B23] flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3 text-left">
              <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
              <div>
                <div className="text-sm font-semibold">Speed Limit Warnings</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Highlight speed in red and alert when over limit
                </div>
              </div>
            </div>
            <span
              className={`px-2.5 py-1 rounded-md text-xs font-semibold ${
                speedLimitAlertsEnabled
                  ? 'bg-orange-600 text-white'
                  : 'bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-400'
              }`}
            >
              {speedLimitAlertsEnabled ? 'On' : 'Off'}
            </span>
          </button>

          <button
            type="button"
            onClick={onToggleVoice}
            className="w-full min-h-[56px] px-4 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#161B23] flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3 text-left">
              <Volume2 className="w-5 h-5 text-orange-500 shrink-0" />
              <div>
                <div className="text-sm font-semibold">Helmet Voice Prompts</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Spoken turn-by-turn alerts and audio chimes
                </div>
              </div>
            </div>
            <span
              className={`px-2.5 py-1 rounded-md text-xs font-semibold ${
                voiceEnabled
                  ? 'bg-orange-600 text-white'
                  : 'bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-400'
              }`}
            >
              {voiceEnabled ? 'On' : 'Off'}
            </span>
          </button>

          <button
            type="button"
            onClick={onToggleTraffic}
            className="w-full min-h-[56px] px-4 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#161B23] flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3 text-left">
              <Activity className="w-5 h-5 text-orange-500 shrink-0" />
              <div>
                <div className="text-sm font-semibold">Live Traffic Overlay</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Color-coded congestion along roads
                </div>
              </div>
            </div>
            <span
              className={`px-2.5 py-1 rounded-md text-xs font-semibold ${
                showTraffic
                  ? 'bg-orange-600 text-white'
                  : 'bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-400'
              }`}
            >
              {showTraffic ? 'On' : 'Off'}
            </span>
          </button>

          {wakeLockSupported && (
            <button
              type="button"
              onClick={onToggleWakeLock}
              className="w-full min-h-[56px] px-4 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#161B23] flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 text-left">
                <Smartphone className="w-5 h-5 text-orange-500 shrink-0" />
                <div>
                  <div className="text-sm font-semibold">Keep Screen Awake</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Prevent display sleep while mounted on handlebars
                  </div>
                </div>
              </div>
              <span
                className={`px-2.5 py-1 rounded-md text-xs font-semibold ${
                  wakeLockEnabled
                    ? 'bg-orange-600 text-white'
                    : 'bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-400'
                }`}
              >
                {wakeLockEnabled ? 'On' : 'Off'}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
