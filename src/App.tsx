import {useCallback, useEffect, useRef, useState} from 'react';
import {APIProvider} from '@vis.gl/react-google-maps';
import {AlertTriangle, Navigation, Volume2, X} from 'lucide-react';
import {InstrumentCluster} from './components/InstrumentCluster';
import {MotoMapCanvas} from './components/MotoMapCanvas';
import {NavigationPanel} from './components/NavigationPanel';
import {RiderStopsDrawer} from './components/RiderStopsDrawer';
import {SettingsModal} from './components/SettingsModal';
import {SpeedLimitHud} from './components/SpeedLimitHud';
import {SystemDock} from './components/SystemDock';
import {useNearbyRiderStops} from './hooks/useNearbyRiderStops';
import {useRideNavigation} from './hooks/useRideNavigation';
import {useRoadSpeedLimit} from './hooks/useRoadSpeedLimit';
import {
  computeBearing,
  convertSpeed,
  estimateFuelLiters,
  haversineMeters,
  samplePointAlongPath,
} from './lib/geoUtils';
import {DEFAULT_RIDER_CENTER, MAPS_API_KEY} from './lib/mapsConfig';
import {
  playHelmetChime,
  speakHelmetInstruction,
  stopHelmetSpeech,
} from './lib/speechAndAudio';
import type {
  BikeFuelConfig,
  CockpitView,
  LatLng,
  NearbyPlaceItem,
  NearbyStopCategory,
  RideHistoryEntry,
  RidePlace,
  RiderTelemetry,
  RouteModifierOptions,
  TravelModeChoice,
  TripSummary,
  UnitSystem,
} from './types/ride';

const MOTORIDE_HISTORY_KEY = 'motoride_ride_history_v1';
const MAX_HISTORY_ENTRIES = 50;

function isValidRidePlace(value: unknown): value is RidePlace {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  const loc = v.location as Record<string, unknown> | undefined;
  return (
    typeof v.id === 'string' &&
    typeof v.name === 'string' &&
    typeof v.address === 'string' &&
    Boolean(loc) &&
    typeof loc?.lat === 'number' &&
    typeof loc?.lng === 'number'
  );
}

function loadRideHistory(): RideHistoryEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(MOTORIDE_HISTORY_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is RideHistoryEntry => {
        if (!item || typeof item !== 'object') return false;
        const r = item as Record<string, unknown>;
        return (
          typeof r.id === 'string' &&
          (r.status === 'arrived' || r.status === 'ended') &&
          typeof r.durationMs === 'number' &&
          Number.isFinite(r.durationMs) &&
          typeof r.distanceMeters === 'number' &&
          Number.isFinite(r.distanceMeters) &&
          typeof r.maxSpeedMps === 'number' &&
          Number.isFinite(r.maxSpeedMps) &&
          typeof r.fuelUsedLiters === 'number' &&
          Number.isFinite(r.fuelUsedLiters) &&
          (r.travelMode === 'TWO_WHEELER' || r.travelMode === 'DRIVING') &&
          typeof r.endedAt === 'number' &&
          Number.isFinite(r.endedAt) &&
          (r.destinationName === null || typeof r.destinationName === 'string') &&
          (r.destination === null || isValidRidePlace(r.destination))
        );
      })
      .slice(0, MAX_HISTORY_ENTRIES);
  } catch {
    return [];
  }
}

function saveRideHistory(entries: RideHistoryEntry[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      MOTORIDE_HISTORY_KEY,
      JSON.stringify(entries.slice(0, MAX_HISTORY_ENTRIES))
    );
  } catch {
    // Ignore storage quota / privacy mode errors
  }
}

function MotoCockpitShell() {
  const [activeView, setActiveView] = useState<CockpitView>('navigate');
  const [isDark, setIsDark] = useState(true);
  const [unitSystem, setUnitSystem] = useState<UnitSystem>('METRIC');
  const [travelMode, setTravelMode] = useState<TravelModeChoice>('TWO_WHEELER');
  const [modifiers, setModifiers] = useState<RouteModifierOptions>({
    avoidHighways: false,
    avoidTolls: false,
    avoidFerries: false,
  });
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [showTraffic, setShowTraffic] = useState(true);
  const [followRider, setFollowRider] = useState(true);

  // Wake Lock API for keeping handlebar screen awake
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const [wakeLockEnabled, setWakeLockEnabled] = useState(false);
  const wakeLockSupported =
    typeof navigator !== 'undefined' && 'wakeLock' in navigator;

  // Navigation destination & waypoints
  const [destination, setDestination] = useState<RidePlace | null>(null);
  const [waypoints, setWaypoints] = useState<RidePlace[]>([]);
  const [selectedStop, setSelectedStop] = useState<NearbyPlaceItem | null>(null);

  // Active turn-by-turn state
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const lastSpokenStepRef = useRef<number>(-1);

  // Live Rider Telemetry
  const [telemetry, setTelemetry] = useState<RiderTelemetry>({
    position: DEFAULT_RIDER_CENTER,
    speedMps: 0,
    headingDeg: 0,
    accuracyMeters: null,
    altitudeMeters: null,
    gpsActive: false,
    gpsPermissionState: 'idle',
    gpsError: null,
    tripDistanceMeters: 0,
    tripStartMs: null,
    maxSpeedMps: 0,
  });

  const gpsWatchIdRef = useRef<number | null>(null);
  const lastGpsPosRef = useRef<LatLng | null>(null);

  // Simulation state (for testing ride progression on desktop or stationary device)
  const [isSimulating, setIsSimulating] = useState(false);
  const [simSpeedMps, setSimSpeedMps] = useState(19.5);
  const simSpeedMpsRef = useRef(19.5);
  const simMetersRef = useRef(0);
  const simStartOriginRef = useRef<LatLng>(DEFAULT_RIDER_CENTER);

  // Speed limit warning settings & cooldown tracking
  const [speedLimitAlertsEnabled, setSpeedLimitAlertsEnabled] = useState(true);
  const [manualLimit, setManualLimit] = useState<number | null>(null);
  const lastOverLimitAlertAtRef = useRef<number>(0);

  // Motorcycle fuel efficiency & tank settings (canonical km/L & Liters)
  const [bikeFuelConfig, setBikeFuelConfig] = useState<BikeFuelConfig>({
    efficiencyKmPerLiter: 22,
    tankCapacityLiters: 15,
  });

  // Completed / ended trip summary & persisted ride history
  const [tripSummary, setTripSummary] = useState<TripSummary | null>(null);
  const [rideHistory, setRideHistory] = useState<RideHistoryEntry[]>(loadRideHistory);
  const telemetryRef = useRef(telemetry);
  const bikeFuelConfigRef = useRef(bikeFuelConfig);
  const travelModeRef = useRef(travelMode);
  const destinationRef = useRef(destination);

  useEffect(() => {
    telemetryRef.current = telemetry;
  }, [telemetry]);

  useEffect(() => {
    bikeFuelConfigRef.current = bikeFuelConfig;
  }, [bikeFuelConfig]);

  useEffect(() => {
    travelModeRef.current = travelMode;
  }, [travelMode]);

  useEffect(() => {
    destinationRef.current = destination;
  }, [destination]);

  useEffect(() => {
    simSpeedMpsRef.current = simSpeedMps;
  }, [simSpeedMps]);

  const {
    route,
    isComputing: isComputingRoute,
    error: routeError,
    computeRideRoute,
    clearRoute,
  } = useRideNavigation();

  const {
    stops: nearbyStops,
    activeCategory: activeStopCategory,
    isLoading: isLoadingStops,
    error: stopsError,
    searchCategory,
    clearStops,
  } = useNearbyRiderStops();

  const roadSpeedLimitStatus = useRoadSpeedLimit(
    telemetry.position,
    unitSystem,
    speedLimitAlertsEnabled
  );

  // Sync Tailwind dark class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [isDark]);

  // Screen Wake Lock toggle handler
  const handleToggleWakeLock = useCallback(async () => {
    if (!wakeLockSupported) return;
    if (wakeLockEnabled && wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
      } catch {
        // Ignore release error
      }
      wakeLockRef.current = null;
      setWakeLockEnabled(false);
      return;
    }

    try {
      const sentinel = await navigator.wakeLock.request('screen');
      wakeLockRef.current = sentinel;
      setWakeLockEnabled(true);
      sentinel.addEventListener('release', () => {
        setWakeLockEnabled(false);
        wakeLockRef.current = null;
      });
    } catch {
      setWakeLockEnabled(false);
    }
  }, [wakeLockEnabled, wakeLockSupported]);

  // Explicit rider-triggered GPS tracking
  const handleRequestGps = useCallback(() => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setTelemetry((prev) => ({
        ...prev,
        gpsPermissionState: 'unavailable',
        gpsError: 'Geolocation is not supported by this browser.',
      }));
      return;
    }

    if (gpsWatchIdRef.current !== null) {
      navigator.geolocation.clearWatch(gpsWatchIdRef.current);
    }

    setTelemetry((prev) => ({
      ...prev,
      gpsPermissionState: 'requesting',
      gpsError: null,
    }));

    gpsWatchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const nextPos: LatLng = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        setTelemetry((prev) => {
          const prevPos = lastGpsPosRef.current;
          let addedDist = 0;
          let nextHeading =
            typeof pos.coords.heading === 'number' && !Number.isNaN(pos.coords.heading)
              ? pos.coords.heading
              : prev.headingDeg;

          if (prevPos) {
            const delta = haversineMeters(prevPos, nextPos);
            if (delta >= 3 && delta < 500) {
              addedDist = delta;
              if (
                typeof pos.coords.heading !== 'number' ||
                Number.isNaN(pos.coords.heading)
              ) {
                nextHeading = computeBearing(prevPos, nextPos);
              }
            }
          }

          lastGpsPosRef.current = nextPos;
          const speed =
            typeof pos.coords.speed === 'number' && !Number.isNaN(pos.coords.speed)
              ? Math.max(0, pos.coords.speed)
              : 0;

          return {
            ...prev,
            position: nextPos,
            speedMps: speed,
            headingDeg: nextHeading,
            accuracyMeters: pos.coords.accuracy ?? null,
            altitudeMeters: pos.coords.altitude ?? null,
            gpsActive: true,
            gpsPermissionState: 'active',
            gpsError: null,
            tripDistanceMeters: prev.tripDistanceMeters + addedDist,
            tripStartMs: prev.tripStartMs ?? Date.now(),
            maxSpeedMps: Math.max(prev.maxSpeedMps, speed),
          };
        });
      },
      (err) => {
        setTelemetry((prev) => ({
          ...prev,
          gpsActive: false,
          gpsPermissionState: err.code === 1 ? 'denied' : 'unavailable',
          gpsError:
            err.code === 1
              ? 'Location permission denied. You can still search places and simulate rides.'
              : 'Unable to acquire GPS fix.',
        }));
      },
      {
        enableHighAccuracy: true,
        maximumAge: 1000,
        timeout: 10000,
      }
    );
  }, []);

  useEffect(() => {
    return () => {
      if (gpsWatchIdRef.current !== null && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(gpsWatchIdRef.current);
      }
      stopHelmetSpeech();
    };
  }, []);

  // Trigger route calculation whenever destination, waypoints, travelMode, or modifiers change
  const triggerRouteCalculation = useCallback(
    async (
      originPos: LatLng,
      dest: RidePlace,
      wps: RidePlace[],
      mode: TravelModeChoice,
      mods: RouteModifierOptions
    ) => {
      setActiveStepIndex(0);
      lastSpokenStepRef.current = -1;
      const computed = await computeRideRoute(originPos, dest, wps, mode, mods);
      if (computed && computed.steps.length > 0 && voiceEnabled) {
        lastSpokenStepRef.current = 0;
        speakHelmetInstruction(
          `Route ready. ${computed.steps[0].instructions}`,
          voiceEnabled
        );
      }
    },
    [computeRideRoute, voiceEnabled]
  );

  const finalizeTripSummary = useCallback(
    (
      status: 'arrived' | 'ended',
      destPlace?: RidePlace | null,
      override?: {
        distanceMeters: number;
        maxSpeedMps: number;
        tripStartMs: number | null;
      }
    ) => {
      const snap = override ?? {
        distanceMeters: telemetryRef.current.tripDistanceMeters,
        maxSpeedMps: telemetryRef.current.maxSpeedMps,
        tripStartMs: telemetryRef.current.tripStartMs,
      };
      const endedAt = Date.now();
      const durationMs = snap.tripStartMs
        ? Math.max(0, endedAt - snap.tripStartMs)
        : 0;
      const destName = destPlace?.name ?? null;
      setTripSummary({
        destinationName: destName,
        status,
        durationMs,
        distanceMeters: snap.distanceMeters,
        maxSpeedMps: snap.maxSpeedMps,
        endedAt,
      });

      if (durationMs >= 2000 || snap.distanceMeters >= 5) {
        const fuelUsedLiters = estimateFuelLiters(
          snap.distanceMeters,
          bikeFuelConfigRef.current.efficiencyKmPerLiter
        );
        const entry: RideHistoryEntry = {
          id: `${endedAt}-${Math.random().toString(36).slice(2, 8)}`,
          destination: destPlace ?? null,
          destinationName: destName,
          status,
          durationMs,
          distanceMeters: snap.distanceMeters,
          maxSpeedMps: snap.maxSpeedMps,
          fuelUsedLiters,
          travelMode: travelModeRef.current,
          endedAt,
        };
        setRideHistory((prev) => {
          const next = [entry, ...prev].slice(0, MAX_HISTORY_ENTRIES);
          saveRideHistory(next);
          return next;
        });
      }
    },
    []
  );

  const handleDeleteRideHistoryEntry = useCallback((id: string) => {
    setRideHistory((prev) => {
      const next = prev.filter((item) => item.id !== id);
      saveRideHistory(next);
      return next;
    });
  }, []);

  const handleClearRideHistory = useCallback(() => {
    setRideHistory([]);
    saveRideHistory([]);
  }, []);

  const handleSelectDestination = useCallback(
    (place: RidePlace) => {
      setIsSimulating(false);
      simMetersRef.current = 0;
      setTripSummary(null);
      setTelemetry((prev) => ({
        ...prev,
        speedMps: prev.gpsActive ? prev.speedMps : 0,
        tripDistanceMeters: 0,
        maxSpeedMps: 0,
        tripStartMs: prev.gpsActive ? Date.now() : null,
      }));
      setDestination(place);
      setWaypoints([]);
      setFollowRider(false);
      setActiveView('navigate');
      void triggerRouteCalculation(
        telemetry.position,
        place,
        [],
        travelMode,
        modifiers
      );
    },
    [telemetry.position, travelMode, modifiers, triggerRouteCalculation]
  );

  const handleAddWaypoint = useCallback(
    (place: RidePlace) => {
      if (!destination) {
        handleSelectDestination(place);
        return;
      }
      const exists = waypoints.some((w) => w.id === place.id);
      if (exists) return;
      const nextWaypoints = [...waypoints, place];
      setWaypoints(nextWaypoints);
      setActiveView('navigate');
      void triggerRouteCalculation(
        telemetry.position,
        destination,
        nextWaypoints,
        travelMode,
        modifiers
      );
    },
    [
      destination,
      waypoints,
      telemetry.position,
      travelMode,
      modifiers,
      triggerRouteCalculation,
      handleSelectDestination,
    ]
  );

  const handleRemoveWaypoint = useCallback(
    (id: string) => {
      if (!destination) return;
      const nextWaypoints = waypoints.filter((w) => w.id !== id);
      setWaypoints(nextWaypoints);
      void triggerRouteCalculation(
        telemetry.position,
        destination,
        nextWaypoints,
        travelMode,
        modifiers
      );
    },
    [destination, waypoints, telemetry.position, travelMode, modifiers, triggerRouteCalculation]
  );

  const handleToggleModifier = useCallback(
    (key: keyof RouteModifierOptions) => {
      setModifiers((prev) => {
        const next = {...prev, [key]: !prev[key]};
        if (destination) {
          void triggerRouteCalculation(
            telemetry.position,
            destination,
            waypoints,
            travelMode,
            next
          );
        }
        return next;
      });
    },
    [destination, waypoints, telemetry.position, travelMode, triggerRouteCalculation]
  );

  const handleChangeTravelMode = useCallback(
    (mode: TravelModeChoice) => {
      setTravelMode(mode);
      if (destination) {
        void triggerRouteCalculation(
          telemetry.position,
          destination,
          waypoints,
          mode,
          modifiers
        );
      }
    },
    [destination, waypoints, telemetry.position, modifiers, triggerRouteCalculation]
  );

  const handleEndRide = useCallback(() => {
    finalizeTripSummary('ended', destination);
    setIsSimulating(false);
    simMetersRef.current = 0;
    setTelemetry((prev) => ({
      ...prev,
      speedMps: prev.gpsActive ? prev.speedMps : 0,
    }));
    setDestination(null);
    setWaypoints([]);
    setActiveStepIndex(0);
    lastSpokenStepRef.current = -1;
    clearRoute();
    stopHelmetSpeech();
    setFollowRider(true);
    setActiveView('cluster');
  }, [clearRoute, destination, finalizeTripSummary]);

  const handleQuickCategory = useCallback(
    (category: NearbyStopCategory) => {
      setActiveView('stops');
      setSelectedStop(null);
      void searchCategory(category, telemetry.position, 10000);
    },
    [searchCategory, telemetry.position]
  );

  const handleFocusStop = useCallback(
    (stop: NearbyPlaceItem) => {
      setFollowRider(false);
      setSelectedStop(stop);
    },
    []
  );

  // Match real GPS position to closest upcoming step when navigating without simulator
  useEffect(() => {
    if (!route || route.steps.length === 0 || isSimulating) return;
    let bestIdx = activeStepIndex;
    let bestDist = Infinity;
    for (let i = activeStepIndex; i < route.steps.length; i++) {
      const d = haversineMeters(telemetry.position, route.steps[i].endLocation);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
      if (d < 45 && i + 1 < route.steps.length) {
        bestIdx = i + 1;
        break;
      }
    }
    if (bestIdx !== activeStepIndex) {
      setActiveStepIndex(bestIdx);
      if (voiceEnabled && lastSpokenStepRef.current !== bestIdx) {
        lastSpokenStepRef.current = bestIdx;
        speakHelmetInstruction(route.steps[bestIdx].instructions, voiceEnabled);
      }
    }
  }, [
    route,
    isSimulating,
    telemetry.position.lat,
    telemetry.position.lng,
    activeStepIndex,
    voiceEnabled,
  ]);

  // Ride Simulator loop along computed Google Maps route polyline
  useEffect(() => {
    if (!isSimulating || !route || route.path.length < 2) return;

    setFollowRider(true);
    const interval = setInterval(() => {
      const currentSimSpeedMps = simSpeedMpsRef.current;
      const stepDelta = currentSimSpeedMps * 0.25;
      simMetersRef.current += stepDelta;

      const sample = samplePointAlongPath(route.path, simMetersRef.current);
      const prevSnap = telemetryRef.current;
      const nextDistance =
        prevSnap.tripDistanceMeters + (sample.finished ? 0 : stepDelta);
      const nextStartMs = prevSnap.tripStartMs ?? Date.now();
      const nextMaxSpeed = Math.max(prevSnap.maxSpeedMps, currentSimSpeedMps);

      setTelemetry((prev) => ({
        ...prev,
        position: sample.position,
        headingDeg: sample.bearing,
        speedMps: sample.finished ? 0 : currentSimSpeedMps,
        tripDistanceMeters: prev.tripDistanceMeters + (sample.finished ? 0 : stepDelta),
        tripStartMs: prev.tripStartMs ?? nextStartMs,
        maxSpeedMps: Math.max(prev.maxSpeedMps, currentSimSpeedMps),
      }));

      // Advance active navigation step based on proximity along route
      if (route.steps.length > 0) {
        setActiveStepIndex((currIdx) => {
          const currentStep = route.steps[currIdx];
          if (!currentStep) return currIdx;
          const distToEnd = haversineMeters(
            sample.position,
            currentStep.endLocation
          );
          if (distToEnd < 65 && currIdx + 1 < route.steps.length) {
            const nextIdx = currIdx + 1;
            if (voiceEnabled && lastSpokenStepRef.current !== nextIdx) {
              lastSpokenStepRef.current = nextIdx;
              speakHelmetInstruction(
                route.steps[nextIdx].instructions,
                voiceEnabled
              );
            }
            return nextIdx;
          }
          return currIdx;
        });
      }

      if (sample.finished) {
        setIsSimulating(false);
        const finishedDest = destinationRef.current;
        finalizeTripSummary('arrived', finishedDest, {
          distanceMeters: nextDistance,
          maxSpeedMps: nextMaxSpeed,
          tripStartMs: nextStartMs,
        });
        setActiveView('cluster');
        if (voiceEnabled) {
          speakHelmetInstruction(
            `You have arrived at ${finishedDest?.name || 'your destination'}.`,
            voiceEnabled
          );
        }
      }
    }, 250);

    return () => clearInterval(interval);
  }, [isSimulating, route, voiceEnabled, finalizeTripSummary]);

  const handleAdjustSimSpeed = useCallback((deltaMps: number) => {
    setSimSpeedMps((prev) => {
      const next = Math.min(45, Math.max(4, prev + deltaMps));
      simSpeedMpsRef.current = next;
      return next;
    });
  }, []);

  const handleChangeUnits = useCallback((nextUnits: UnitSystem) => {
    setUnitSystem((prevUnits) => {
      if (prevUnits !== nextUnits) {
        setManualLimit((prevLimit) =>
          prevLimit === null
            ? null
            : Math.max(
                10,
                Math.round(
                  prevLimit * (nextUnits === 'IMPERIAL' ? 0.621371 : 1.60934)
                )
              )
        );
      }
      return nextUnits;
    });
  }, []);

  const handleToggleSimulation = useCallback(() => {
    if (!route || route.path.length < 2) return;
    if (!isSimulating) {
      if (simMetersRef.current >= (route.distanceMeters || 0)) {
        simMetersRef.current = 0;
        setActiveStepIndex(0);
        setTripSummary(null);
        setTelemetry((prev) => ({
          ...prev,
          tripDistanceMeters: 0,
          maxSpeedMps: 0,
          tripStartMs: Date.now(),
        }));
      } else if (tripSummary) {
        setTripSummary(null);
      }
      if (simMetersRef.current === 0) {
        simStartOriginRef.current = telemetry.position;
      }
      setIsSimulating(true);
      setFollowRider(true);
    } else {
      setIsSimulating(false);
      setTelemetry((prev) => ({...prev, speedMps: 0}));
    }
  }, [isSimulating, route, telemetry.position, tripSummary]);

  const handleSelectStep = useCallback(
    (idx: number) => {
      if (!route || !route.steps[idx]) return;
      setActiveStepIndex(idx);
      if (voiceEnabled) {
        speakHelmetInstruction(route.steps[idx].instructions, voiceEnabled);
      }
    },
    [route, voiceEnabled]
  );

  // Remaining distance & duration estimate based on active step
  const remainingDistanceMeters = route
    ? route.steps
        .slice(activeStepIndex)
        .reduce((sum, s) => sum + s.distanceMeters, 0) || route.distanceMeters
    : 0;
  const remainingDurationMillis = route
    ? route.steps
        .slice(activeStepIndex)
        .reduce((sum, s) => sum + s.staticDurationMillis, 0) ||
      route.durationMillis
    : 0;

  const liveSpeed = convertSpeed(telemetry.speedMps, unitSystem);
  const activeLimit = speedLimitAlertsEnabled
    ? (manualLimit ?? roadSpeedLimitStatus.roadLimit)
    : null;
  const limitSource: 'roads-api' | 'manual' | null =
    !speedLimitAlertsEnabled
      ? null
      : manualLimit !== null
        ? 'manual'
        : roadSpeedLimitStatus.roadLimit !== null
          ? 'roads-api'
          : null;
  const isOverLimit =
    speedLimitAlertsEnabled && activeLimit !== null && liveSpeed > activeLimit;

  // Helmet chime alert when crossing over speed limit (with 15s cooldown)
  useEffect(() => {
    if (!isOverLimit) {
      lastOverLimitAlertAtRef.current = 0;
      return;
    }
    if (!voiceEnabled) return;
    const now = Date.now();
    if (now - lastOverLimitAlertAtRef.current >= 15000) {
      lastOverLimitAlertAtRef.current = now;
      playHelmetChime('alert');
    }
  }, [isOverLimit, voiceEnabled]);

  return (
    <div className="h-full w-full flex flex-col md:flex-row overflow-hidden bg-slate-100 dark:bg-[#090B0E] text-slate-900 dark:text-slate-100">
      <SystemDock
        activeView={activeView}
        onSelectView={setActiveView}
        isDark={isDark}
        onToggleTheme={() => setIsDark((d) => !d)}
        voiceEnabled={voiceEnabled}
        onToggleVoice={() => {
          setVoiceEnabled((v) => {
            if (v) stopHelmetSpeech();
            return !v;
          });
        }}
        hasActiveRoute={Boolean(route)}
      />

      {/* Main Split Cockpit Area */}
      <main className="flex-1 min-w-0 min-h-0 flex flex-col-reverse md:flex-row pb-16 md:pb-0">
        {/* Left/Bottom Cockpit Instrument & Navigation Panel */}
        <section
          aria-label="Rider Cockpit Controls"
          className="w-full md:w-[390px] lg:w-[420px] h-[46%] md:h-full shrink-0 border-t md:border-t-0 md:border-r border-slate-200 dark:border-white/10 overflow-hidden z-20"
        >
          {activeView === 'navigate' && (
            <NavigationPanel
              riderPosition={telemetry.position}
              gpsPermissionState={telemetry.gpsPermissionState}
              gpsError={telemetry.gpsError}
              onRequestGps={handleRequestGps}
              destination={destination}
              waypoints={waypoints}
              route={route}
              isComputingRoute={isComputingRoute}
              routeError={routeError}
              activeStepIndex={activeStepIndex}
              remainingDistanceMeters={remainingDistanceMeters}
              remainingDurationMillis={remainingDurationMillis}
              unitSystem={unitSystem}
              travelMode={travelMode}
              modifiers={modifiers}
              isSimulating={isSimulating}
              simSpeedMps={simSpeedMps}
              onAdjustSimSpeed={handleAdjustSimSpeed}
              onSelectDestination={handleSelectDestination}
              onRemoveWaypoint={handleRemoveWaypoint}
              onToggleModifier={handleToggleModifier}
              onChangeTravelMode={handleChangeTravelMode}
              onEndRide={handleEndRide}
              onToggleSimulation={handleToggleSimulation}
              onSelectStep={handleSelectStep}
              onQuickCategory={handleQuickCategory}
              rideHistory={rideHistory}
              onOpenHistory={() => setActiveView('cluster')}
            />
          )}

          {activeView === 'stops' && (
            <RiderStopsDrawer
              stops={nearbyStops}
              activeCategory={activeStopCategory}
              isLoading={isLoadingStops}
              error={stopsError}
              unitSystem={unitSystem}
              hasActiveRoute={Boolean(destination)}
              onSelectCategory={(cat) =>
                void searchCategory(cat, telemetry.position, 10000)
              }
              onFocusStop={handleFocusStop}
              onRideToStop={handleSelectDestination}
              onAddWaypoint={handleAddWaypoint}
            />
          )}

          {activeView === 'cluster' && (
            <InstrumentCluster
              telemetry={telemetry}
              unitSystem={unitSystem}
              isSimulating={isSimulating}
              activeLimit={activeLimit}
              limitSource={limitSource}
              isOverLimit={isOverLimit}
              tripSummary={tripSummary}
              hasActiveRide={Boolean(route)}
              route={route}
              destination={destination}
              waypoints={waypoints}
              activeStepIndex={activeStepIndex}
              remainingDistanceMeters={remainingDistanceMeters}
              remainingDurationMillis={remainingDurationMillis}
              onSelectStep={handleSelectStep}
              onOpenNavigate={() => setActiveView('navigate')}
              onResetTrip={() => {
                setTripSummary(null);
                setTelemetry((prev) => ({
                  ...prev,
                  tripDistanceMeters: 0,
                  maxSpeedMps: 0,
                  tripStartMs: prev.gpsActive || isSimulating ? Date.now() : null,
                }));
              }}
              onEndTrip={() => {
                if (route || destination) {
                  handleEndRide();
                } else {
                  finalizeTripSummary('ended', null);
                }
              }}
              onDismissSummary={() => setTripSummary(null)}
              onStartNewRide={() => {
                setTripSummary(null);
                setTelemetry((prev) => ({
                  ...prev,
                  tripDistanceMeters: 0,
                  maxSpeedMps: 0,
                  tripStartMs: prev.gpsActive ? Date.now() : null,
                }));
                setActiveView('navigate');
              }}
              onRequestGps={handleRequestGps}
              onOpenSettings={() => setActiveView('settings')}
              bikeFuelConfig={bikeFuelConfig}
              rideHistory={rideHistory}
              onRideAgain={handleSelectDestination}
              onDeleteHistoryEntry={handleDeleteRideHistoryEntry}
              onClearHistory={handleClearRideHistory}
            />
          )}

          {activeView === 'settings' && (
            <SettingsModal
              isDark={isDark}
              onToggleTheme={() => setIsDark((d) => !d)}
              unitSystem={unitSystem}
              onChangeUnits={handleChangeUnits}
              travelMode={travelMode}
              onChangeTravelMode={handleChangeTravelMode}
              voiceEnabled={voiceEnabled}
              onToggleVoice={() => {
                setVoiceEnabled((v) => {
                  if (v) stopHelmetSpeech();
                  return !v;
                });
              }}
              showTraffic={showTraffic}
              onToggleTraffic={() => setShowTraffic((t) => !t)}
              wakeLockEnabled={wakeLockEnabled}
              wakeLockSupported={wakeLockSupported}
              onToggleWakeLock={() => void handleToggleWakeLock()}
              speedLimitAlertsEnabled={speedLimitAlertsEnabled}
              onToggleSpeedLimitAlerts={() =>
                setSpeedLimitAlertsEnabled((prev) => !prev)
              }
              manualLimit={manualLimit}
              onSetManualLimit={setManualLimit}
              roadStatus={roadSpeedLimitStatus}
              bikeFuelConfig={bikeFuelConfig}
              onChangeBikeFuelConfig={setBikeFuelConfig}
              tripDistanceMeters={telemetry.tripDistanceMeters}
              activeRouteDistanceMeters={route?.distanceMeters ?? 0}
            />
          )}
        </section>

        {/* Primary Google Maps Viewport */}
        <section
          aria-label="Live Navigation Map"
          className="relative flex-1 min-w-0 min-h-0 h-[54%] md:h-full"
        >
          <MotoMapCanvas
            riderPosition={telemetry.position}
            riderHeadingDeg={telemetry.headingDeg}
            isDark={isDark}
            showTraffic={showTraffic}
            onToggleTraffic={() => setShowTraffic((t) => !t)}
            followRider={followRider}
            onSetFollowRider={setFollowRider}
            route={route}
            destination={destination}
            waypoints={waypoints}
            nearbyStops={nearbyStops}
            selectedStop={selectedStop}
            onSelectStop={setSelectedStop}
            onRideToStop={handleSelectDestination}
            onAddWaypoint={handleAddWaypoint}
            unitSystem={unitSystem}
          />

          {/* Corner Speed Readout & Road Speed Limit Sign (highlights red over limit) */}
          <SpeedLimitHud
            currentSpeed={liveSpeed}
            unitSystem={unitSystem}
            activeLimit={activeLimit}
            limitSource={limitSource}
            isOverLimit={isOverLimit}
            roadStatus={roadSpeedLimitStatus}
            manualLimit={manualLimit}
            onSetManualLimit={(limit) => {
              if (limit !== null && !speedLimitAlertsEnabled) {
                setSpeedLimitAlertsEnabled(true);
              }
              setManualLimit(limit);
            }}
            onRefreshRoadLimit={() => {
              if (!speedLimitAlertsEnabled) {
                setSpeedLimitAlertsEnabled(true);
              }
              roadSpeedLimitStatus.refreshNow();
            }}
            onOpenCluster={() => setActiveView('cluster')}
          />

          {/* Compact Next-Turn Floating Pill when user switches to Dash or Stops mid-ride */}
          {route && activeView !== 'navigate' && (
            <button
              type="button"
              onClick={() => setActiveView('navigate')}
              className="absolute top-3 right-3 sm:top-4 sm:right-4 z-20 max-w-[260px] px-3.5 py-2.5 rounded-2xl bg-orange-600 text-white shadow-lg flex items-center gap-2.5 text-left hover:bg-orange-500 transition-colors"
            >
              <Navigation className="w-5 h-5 shrink-0" />
              <span className="text-xs font-semibold truncate">
                {route.steps[activeStepIndex]?.instructions || 'Active Route'}
              </span>
            </button>
          )}

          {/* Active Nearby Stops Clear Button */}
          {nearbyStops.length > 0 && (
            <button
              type="button"
              onClick={() => {
                clearStops();
                setSelectedStop(null);
              }}
              className="absolute bottom-3 left-3 sm:bottom-5 sm:left-4 z-20 min-h-[44px] px-3.5 rounded-xl bg-white/95 dark:bg-[#141922]/95 text-slate-900 dark:text-white border border-slate-200 dark:border-white/15 shadow-lg text-xs font-semibold flex items-center gap-1.5"
            >
              <X className="w-4 h-4 text-orange-500" />
              <span>Clear {nearbyStops.length} Stops</span>
            </button>
          )}

          {/* Voice Indicator Button on Mobile Top Right when not navigating */}
          {(!route || activeView === 'navigate') && (
            <button
              type="button"
              onClick={() => setVoiceEnabled((v) => !v)}
              aria-label="Toggle voice prompts"
              className="md:hidden absolute top-3 right-3 z-20 min-h-[44px] min-w-[44px] rounded-xl bg-slate-950/85 text-white border border-white/15 backdrop-blur-md flex items-center justify-center"
            >
              <Volume2
                className={`w-5 h-5 ${
                  voiceEnabled ? 'text-orange-400' : 'text-slate-500'
                }`}
              />
            </button>
          )}
        </section>
      </main>
    </div>
  );
}

export default function App() {
  const [quotaExceeded, setQuotaExceeded] = useState(false);

  useEffect(() => {
    const handler = () => setQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handler);
    return () => window.removeEventListener('gmp-quota-exceeded', handler);
  }, []);

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-slate-950">
      {quotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm shrink-0">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}

      {!MAPS_API_KEY ? (
        <div className="flex-1 flex items-center justify-center p-6 bg-[#090B0E] text-slate-100">
          <div className="max-w-md w-full p-6 rounded-2xl border border-white/10 bg-[#11151B] space-y-3">
            <div className="flex items-center gap-2.5 text-orange-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h1 className="font-display text-2xl font-bold text-white">
                Google Maps Key Needed
              </h1>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">
              The Google Maps Platform API key is not present in the runtime environment yet. Enable Google Maps in the AI Studio settings panel or configure <code className="font-mono text-xs bg-white/10 px-1.5 py-0.5 rounded">VITE_GOOGLE_MAPS_API_KEY</code> and reload.
            </p>
          </div>
        </div>
      ) : (
        <APIProvider
          apiKey={MAPS_API_KEY}
          libraries={['places', 'routes', 'marker', 'geometry']}
        >
          <div className="flex-1 min-h-0">
            <MotoCockpitShell />
          </div>
        </APIProvider>
      )}
    </div>
  );
}
