import {useEffect, useRef, useState} from 'react';
import {
  AlertTriangle,
  Check,
  Clock,
  Compass,
  Flag,
  FolderOpen,
  Fuel,
  Gauge,
  Pause,
  Play,
  RotateCcw,
  Route as RouteIcon,
  Share2,
  SkipBack,
  SkipForward,
  Volume2,
  X,
} from 'lucide-react';
import {
  bearingToCardinal,
  convertSpeed,
  estimateFuelLiters,
  formatDistance,
  formatEfficiency,
  formatElapsed,
  formatFuelVolume,
  speedUnitLabel,
} from '../lib/geoUtils';
import {playHelmetChime} from '../lib/speechAndAudio';
import {TripTimeline} from './TripTimeline';
import {RideHistoryPanel} from './RideHistoryPanel';
import type {
  BikeFuelConfig,
  ComputedRouteData,
  RideHistoryEntry,
  RidePlace,
  RiderTelemetry,
  TripSummary,
  UnitSystem,
} from '../types/ride';

interface InstrumentClusterProps {
  telemetry: RiderTelemetry;
  unitSystem: UnitSystem;
  isSimulating: boolean;
  activeLimit: number | null;
  limitSource: 'roads-api' | 'manual' | null;
  isOverLimit: boolean;
  tripSummary: TripSummary | null;
  hasActiveRide: boolean;
  route: ComputedRouteData | null;
  destination: RidePlace | null;
  waypoints: RidePlace[];
  activeStepIndex: number;
  remainingDistanceMeters: number;
  remainingDurationMillis: number;
  onSelectStep: (idx: number) => void;
  onOpenNavigate: () => void;
  onResetTrip: () => void;
  onEndTrip: () => void;
  onDismissSummary: () => void;
  onStartNewRide: () => void;
  onRequestGps: () => void;
  onOpenSettings: () => void;
  bikeFuelConfig: BikeFuelConfig;
  rideHistory: RideHistoryEntry[];
  onRideAgain: (place: RidePlace) => void;
  onDeleteHistoryEntry: (id: string) => void;
  onClearHistory: () => void;
}

interface LocalTrack {
  name: string;
  url: string;
}

export function InstrumentCluster({
  telemetry,
  unitSystem,
  isSimulating,
  activeLimit,
  limitSource,
  isOverLimit,
  tripSummary,
  hasActiveRide,
  route,
  destination,
  waypoints,
  activeStepIndex,
  remainingDistanceMeters,
  remainingDurationMillis,
  onSelectStep,
  onOpenNavigate,
  onResetTrip,
  onEndTrip,
  onDismissSummary,
  onStartNewRide,
  onRequestGps,
  onOpenSettings,
  bikeFuelConfig,
  rideHistory,
  onRideAgain,
  onDeleteHistoryEntry,
  onClearHistory,
}: InstrumentClusterProps) {
  const [elapsedMs, setElapsedMs] = useState(0);
  const [copiedShare, setCopiedShare] = useState(false);

  const tripFuelLiters = estimateFuelLiters(
    telemetry.tripDistanceMeters,
    bikeFuelConfig.efficiencyKmPerLiter
  );
  const remainingFuelLiters = Math.max(
    0,
    bikeFuelConfig.tankCapacityLiters - tripFuelLiters
  );
  const remainingFuelPct =
    bikeFuelConfig.tankCapacityLiters > 0
      ? Math.round(
          (remainingFuelLiters / bikeFuelConfig.tankCapacityLiters) * 100
        )
      : 0;
  const remainingRangeMeters =
    remainingFuelLiters * bikeFuelConfig.efficiencyKmPerLiter * 1000;
  const routeFuelLiters = route
    ? estimateFuelLiters(
        route.distanceMeters,
        bikeFuelConfig.efficiencyKmPerLiter
      )
    : 0;
  const isLowFuel = remainingFuelPct <= 20;

  // Local device audio player state
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [tracks, setTracks] = useState<LocalTrack[]>([]);
  const [trackIndex, setTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (!telemetry.tripStartMs) {
      setElapsedMs(0);
      return;
    }
    if (tripSummary) {
      setElapsedMs(tripSummary.durationMs);
      return;
    }
    const tick = () => {
      setElapsedMs(Date.now() - telemetry.tripStartMs!);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [telemetry.tripStartMs, tripSummary]);

  useEffect(() => {
    return () => {
      tracks.forEach((t) => URL.revokeObjectURL(t.url));
    };
  }, [tracks]);

  const speedValue = convertSpeed(telemetry.speedMps, unitSystem);
  const maxSpeedValue = convertSpeed(telemetry.maxSpeedMps, unitSystem);
  const maxGauge = unitSystem === 'IMPERIAL' ? 120 : 180;
  const gaugeProgress = Math.min(1, speedValue / maxGauge);

  // SVG gauge arc math
  const radius = 84;
  const circumference = 2 * Math.PI * radius;
  const arcFraction = 0.72;
  const arcLength = circumference * arcFraction;
  const dashOffset = arcLength * (1 - gaugeProgress);

  const handleShareLocation = async () => {
    const url = `https://maps.google.com/?q=${telemetry.position.lat.toFixed(6)},${telemetry.position.lng.toFixed(6)}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 2500);
    } catch {
      setCopiedShare(false);
    }
  };

  const handleFilesSelected = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const loaded: LocalTrack[] = Array.from(files).map((f) => ({
      name: f.name.replace(/\.[^/.]+$/, ''),
      url: URL.createObjectURL(f),
    }));
    setTracks((prev) => {
      prev.forEach((t) => URL.revokeObjectURL(t.url));
      return loaded;
    });
    setTrackIndex(0);
    setIsPlaying(true);
  };

  useEffect(() => {
    const el = audioRef.current;
    if (!el || tracks.length === 0) return;
    el.src = tracks[trackIndex]?.url ?? '';
    if (isPlaying) {
      void el.play().catch(() => setIsPlaying(false));
    } else {
      el.pause();
    }
  }, [tracks, trackIndex, isPlaying]);

  const togglePlay = () => {
    if (tracks.length === 0) {
      fileInputRef.current?.click();
      return;
    }
    setIsPlaying((prev) => !prev);
  };

  const currentTrack = tracks[trackIndex];

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#11151B] text-slate-900 dark:text-slate-100 overflow-y-auto cockpit-scroll">
      <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-white/10 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Rider Dash
          </h2>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {isSimulating
              ? 'Simulated ride telemetry'
              : telemetry.gpsActive
                ? `Live GPS (±${Math.round(telemetry.accuracyMeters ?? 10)} m)`
                : 'GPS standby'}
          </div>
        </div>

        {!telemetry.gpsActive && !isSimulating && (
          <button
            type="button"
            onClick={onRequestGps}
            className="min-h-[44px] px-3.5 rounded-xl bg-orange-600 text-white text-xs font-semibold hover:bg-orange-500 transition-colors"
          >
            Start GPS
          </button>
        )}
      </div>

      {/* Post-Ride Trip Summary Card */}
      {tripSummary && (
        <section
          aria-label="Trip Summary"
          className={`p-4 sm:p-5 border-b border-slate-200 dark:border-white/10 ${
            tripSummary.status === 'arrived'
              ? 'bg-emerald-500/10 dark:bg-emerald-950/30'
              : 'bg-orange-500/10 dark:bg-orange-950/25'
          }`}
        >
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-start gap-2.5 min-w-0">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  tripSummary.status === 'arrived'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-orange-600 text-white'
                }`}
              >
                <Flag className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-slate-900 dark:text-white">
                  Trip Summary
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-300 truncate">
                  {tripSummary.status === 'arrived'
                    ? 'Arrived'
                    : 'Ride Ended'}
                  {tripSummary.destinationName
                    ? ` · ${tripSummary.destinationName}`
                    : ''}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onDismissSummary}
              aria-label="Dismiss trip summary"
              className="min-h-[36px] min-w-[36px] rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-200/70 dark:hover:bg-white/10 shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2.5 rounded-xl bg-white dark:bg-[#161B23] border border-slate-200 dark:border-white/10">
              <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1">
                <Clock className="w-3.5 h-3.5 text-orange-500" />
                <span>Duration</span>
              </div>
              <div className="font-mono-tabular text-sm font-bold mt-1 text-slate-900 dark:text-white">
                {formatElapsed(tripSummary.durationMs)}
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-white dark:bg-[#161B23] border border-slate-200 dark:border-white/10">
              <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1">
                <RouteIcon className="w-3.5 h-3.5 text-emerald-500" />
                <span>Distance</span>
              </div>
              <div className="font-mono-tabular text-sm font-bold mt-1 text-slate-900 dark:text-white">
                {formatDistance(tripSummary.distanceMeters, unitSystem)}
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-white dark:bg-[#161B23] border border-slate-200 dark:border-white/10">
              <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1">
                <Gauge className="w-3.5 h-3.5 text-sky-500" />
                <span>Max Speed</span>
              </div>
              <div className="font-mono-tabular text-sm font-bold mt-1 text-slate-900 dark:text-white">
                {convertSpeed(tripSummary.maxSpeedMps, unitSystem)}{' '}
                {speedUnitLabel(unitSystem)}
              </div>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between gap-2">
            <div className="text-xs text-slate-600 dark:text-slate-300 font-mono-tabular flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>
                Avg:{' '}
                {tripSummary.durationMs > 1000
                  ? convertSpeed(
                      tripSummary.distanceMeters / (tripSummary.durationMs / 1000),
                      unitSystem
                    )
                  : 0}{' '}
                {speedUnitLabel(unitSystem)}
              </span>
              <span>
                Fuel:{' '}
                {formatFuelVolume(
                  estimateFuelLiters(
                    tripSummary.distanceMeters,
                    bikeFuelConfig.efficiencyKmPerLiter
                  ),
                  unitSystem
                )}
              </span>
            </div>

            <button
              type="button"
              onClick={onStartNewRide}
              className="min-h-[40px] px-3.5 rounded-xl bg-orange-600 text-white text-xs font-semibold hover:bg-orange-500 transition-colors shrink-0"
            >
              Plan New Ride
            </button>
          </div>
        </section>
      )}

      {/* Digital Motorcycle TFT Speedometer */}
      <div
        className={`p-5 flex flex-col items-center border-b border-slate-200 dark:border-white/10 transition-colors ${
          isOverLimit
            ? 'bg-red-500/10 dark:bg-red-950/35'
            : 'bg-slate-50/70 dark:bg-[#0D1015]'
        }`}
      >
        <div className="relative w-52 h-44 flex items-center justify-center">
          <svg
            viewBox="0 0 210 210"
            className="w-52 h-52 -rotate-[220deg]"
            aria-hidden="true"
          >
            <circle
              cx="105"
              cy="105"
              r={radius}
              fill="none"
              stroke="currentColor"
              className="text-slate-200 dark:text-white/10"
              strokeWidth="14"
              strokeDasharray={`${arcLength} ${circumference}`}
              strokeLinecap="round"
            />
            <circle
              cx="105"
              cy="105"
              r={radius}
              fill="none"
              stroke={isOverLimit ? '#EF4444' : '#F97316'}
              strokeWidth="14"
              strokeDasharray={`${arcLength} ${circumference}`}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
              className="transition-[stroke-dashoffset,stroke] duration-150"
            />
          </svg>

          <div className="absolute inset-0 flex flex-col items-center justify-center pt-3">
            <span
              className={`font-display text-6xl font-bold leading-none tabular-nums transition-colors ${
                isOverLimit
                  ? 'text-red-600 dark:text-red-500'
                  : 'text-slate-900 dark:text-white'
              }`}
            >
              {speedValue}
            </span>
            <span
              className={`text-xs font-semibold mt-1 ${
                isOverLimit
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {speedUnitLabel(unitSystem)}
            </span>
          </div>
        </div>

        {/* Speed Limit Warning Banner & Sign */}
        {isOverLimit && activeLimit !== null ? (
          <div className="w-full mb-3 px-3.5 py-2.5 rounded-xl bg-red-600 text-white flex items-center justify-between gap-2 shadow-md">
            <div className="flex items-center gap-2 text-xs font-bold">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>
                Speed Limit Exceeded (+{speedValue - activeLimit}{' '}
                {speedUnitLabel(unitSystem)})
              </span>
            </div>
            <span className="font-mono-tabular text-xs font-bold shrink-0">
              Limit {activeLimit}
            </span>
          </div>
        ) : (
          <button
            type="button"
            onClick={onOpenSettings}
            className="mb-3 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#161B23] text-xs font-medium text-slate-600 dark:text-slate-300 flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-white/10"
          >
            <span>
              {activeLimit !== null
                ? `Speed Limit: ${activeLimit} ${speedUnitLabel(unitSystem)} (${
                    limitSource === 'roads-api' ? 'Roads API' : 'Manual'
                  })`
                : 'No speed limit active · Tap to set'}
            </span>
          </button>
        )}

        {/* Heading & Peak */}
        <div className="w-full grid grid-cols-3 gap-2 pt-2 text-center">
          <div className="p-2.5 rounded-xl bg-white dark:bg-[#161B23] border border-slate-200 dark:border-white/10">
            <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1">
              <Compass className="w-3.5 h-3.5 text-orange-500" />
              <span>Heading</span>
            </div>
            <div className="font-mono-tabular text-sm font-bold mt-0.5">
              {Math.round(telemetry.headingDeg)}°{' '}
              {bearingToCardinal(telemetry.headingDeg)}
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-white dark:bg-[#161B23] border border-slate-200 dark:border-white/10">
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              Trip
            </div>
            <div className="font-mono-tabular text-sm font-bold mt-0.5">
              {formatDistance(telemetry.tripDistanceMeters, unitSystem)}
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-white dark:bg-[#161B23] border border-slate-200 dark:border-white/10">
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              Peak
            </div>
            <div className="font-mono-tabular text-sm font-bold mt-0.5">
              {maxSpeedValue} {speedUnitLabel(unitSystem)}
            </div>
          </div>
        </div>

        <div className="w-full mt-3 flex items-center justify-between gap-2">
          <div className="text-xs text-slate-500 dark:text-slate-400 font-mono-tabular">
            Ride Time: {formatElapsed(elapsedMs)}
          </div>
          <div className="flex items-center gap-1.5">
            {!tripSummary && (telemetry.tripStartMs !== null || hasActiveRide) && (
              <button
                type="button"
                onClick={onEndTrip}
                className="min-h-[40px] px-3 rounded-lg text-xs font-semibold bg-red-600/10 text-red-600 dark:text-red-400 hover:bg-red-600/20 flex items-center gap-1.5"
              >
                <Flag className="w-3.5 h-3.5" />
                <span>End Trip</span>
              </button>
            )}
            <button
              type="button"
              onClick={onResetTrip}
              className="min-h-[40px] px-3 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-white/10 flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Trip</span>
            </button>
          </div>
        </div>
      </div>

      {/* Route Segment Trip Timeline */}
      <TripTimeline
        route={route}
        destination={destination}
        waypoints={waypoints}
        activeStepIndex={activeStepIndex}
        tripDistanceMeters={telemetry.tripDistanceMeters}
        remainingDistanceMeters={remainingDistanceMeters}
        remainingDurationMillis={remainingDurationMillis}
        unitSystem={unitSystem}
        tripSummary={tripSummary}
        onSelectStep={onSelectStep}
        onOpenNavigate={onOpenNavigate}
      />

      {/* Live Fuel Consumption & Tank Range */}
      <section
        aria-label="Fuel Consumption Telemetry"
        className="p-4 sm:p-5 border-b border-slate-200 dark:border-white/10 space-y-2.5"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Fuel
              className={`w-4 h-4 shrink-0 ${
                isLowFuel ? 'text-red-500' : 'text-orange-500'
              }`}
            />
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Fuel Estimate
            </span>
          </div>
          <button
            type="button"
            onClick={onOpenSettings}
            className="text-xs font-semibold text-orange-600 dark:text-orange-400 hover:underline font-mono-tabular"
          >
            {formatEfficiency(bikeFuelConfig.efficiencyKmPerLiter, unitSystem)} · Setup
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#161B23] border border-slate-200 dark:border-white/10">
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              Trip Used
            </div>
            <div className="font-mono-tabular text-sm font-bold mt-0.5 text-slate-900 dark:text-white">
              {formatFuelVolume(tripFuelLiters, unitSystem)}
            </div>
          </div>

          <div
            className={`p-2.5 rounded-xl border ${
              isLowFuel
                ? 'bg-red-500/10 border-red-500/30'
                : 'bg-slate-50 dark:bg-[#161B23] border-slate-200 dark:border-white/10'
            }`}
          >
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              Tank Left
            </div>
            <div
              className={`font-mono-tabular text-sm font-bold mt-0.5 ${
                isLowFuel
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-slate-900 dark:text-white'
              }`}
            >
              {remainingFuelPct}%
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#161B23] border border-slate-200 dark:border-white/10">
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              {route ? 'Route Est.' : 'Est. Range'}
            </div>
            <div className="font-mono-tabular text-sm font-bold mt-0.5 text-slate-900 dark:text-white">
              {route
                ? formatFuelVolume(routeFuelLiters, unitSystem)
                : formatDistance(remainingRangeMeters, unitSystem)}
            </div>
          </div>
        </div>
      </section>

      {/* Glove-Friendly Helmet Audio Deck */}
      <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-white/10 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Helmet Audio Player
          </span>
          <button
            type="button"
            onClick={() => playHelmetChime('turn')}
            className="min-h-[36px] px-2.5 rounded-lg text-xs font-semibold text-orange-600 dark:text-orange-400 hover:bg-orange-500/10 flex items-center gap-1"
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span>Test Chime</span>
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          multiple
          className="hidden"
          onChange={(e) => handleFilesSelected(e.target.files)}
        />
        <audio
          ref={audioRef}
          onEnded={() => {
            if (tracks.length > 0) {
              setTrackIndex((i) => (i + 1) % tracks.length);
            }
          }}
        />

        <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#161B23] border border-slate-200 dark:border-white/10">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate">
                {currentTrack ? currentTrack.name : 'No audio tracks loaded'}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {tracks.length > 0
                  ? `Track ${trackIndex + 1} of ${tracks.length}`
                  : 'Load local MP3 or audio files for your ride'}
              </div>
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Load local audio files"
              className="min-h-[44px] min-w-[44px] px-3 rounded-lg bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/15 text-xs font-semibold flex items-center gap-1.5 shrink-0"
            >
              <FolderOpen className="w-4 h-4" />
              <span>Files</span>
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() =>
                tracks.length > 0 &&
                setTrackIndex((i) => (i - 1 + tracks.length) % tracks.length)
              }
              disabled={tracks.length === 0}
              aria-label="Previous track"
              className="min-h-[48px] rounded-xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-center disabled:opacity-40"
            >
              <SkipBack className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={togglePlay}
              aria-label={isPlaying ? 'Pause audio' : 'Play audio'}
              className="min-h-[48px] rounded-xl bg-orange-600 text-white hover:bg-orange-500 flex items-center justify-center"
            >
              {isPlaying ? (
                <Pause className="w-5 h-5" />
              ) : (
                <Play className="w-5 h-5" />
              )}
            </button>
            <button
              type="button"
              onClick={() =>
                tracks.length > 0 &&
                setTrackIndex((i) => (i + 1) % tracks.length)
              }
              disabled={tracks.length === 0}
              aria-label="Next track"
              className="min-h-[48px] rounded-xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-center disabled:opacity-40"
            >
              <SkipForward className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Recorded Ride History */}
      <RideHistoryPanel
        history={rideHistory}
        unitSystem={unitSystem}
        onRideAgain={onRideAgain}
        onDeleteEntry={onDeleteHistoryEntry}
        onClearHistory={onClearHistory}
      />

      {/* Coordinates & Quick Share */}
      <div className="p-4 sm:p-5 space-y-2.5">
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>Position</span>
          <span className="font-mono-tabular">
            {telemetry.position.lat.toFixed(5)}, {telemetry.position.lng.toFixed(5)}
          </span>
        </div>
        <button
          type="button"
          onClick={() => void handleShareLocation()}
          className="w-full min-h-[48px] px-4 rounded-xl border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
        >
          {copiedShare ? (
            <>
              <Check className="w-4 h-4 text-emerald-500" />
              <span>Location Link Copied</span>
            </>
          ) : (
            <>
              <Share2 className="w-4 h-4 text-orange-500" />
              <span>Copy Rider Location Link</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
