import {useCallback, useEffect, useRef, useState} from 'react';
import {haversineMeters} from '../lib/geoUtils';
import type {LatLng, SpeedLimitStatus, UnitSystem} from '../types/ride';

interface SpeedLimitApiResponse {
  available?: boolean;
  speedLimit?: number | null;
  units?: 'KPH' | 'MPH';
  placeId?: string | null;
  reason?: string;
  message?: string;
}

export function useRoadSpeedLimit(
  position: LatLng,
  unitSystem: UnitSystem,
  enabled: boolean
) {
  const apiUnits: 'KPH' | 'MPH' = unitSystem === 'IMPERIAL' ? 'MPH' : 'KPH';

  const [status, setStatus] = useState<SpeedLimitStatus>({
    roadLimit: null,
    units: apiUnits,
    placeId: null,
    apiAvailable: true,
    reason: null,
    statusMessage: null,
    isLoading: false,
    lastUpdatedAt: null,
  });

  const lastQueryPosRef = useRef<LatLng | null>(null);
  const lastQueryTimeRef = useRef<number>(0);
  const lastQueryUnitsRef = useRef<'KPH' | 'MPH' | null>(null);
  const licenseBlockedRef = useRef<boolean>(false);

  const fetchSpeedLimit = useCallback(
    async (coords: LatLng, units: 'KPH' | 'MPH', force = false) => {
      if (!enabled) return;
      if (licenseBlockedRef.current && !force) return;

      lastQueryPosRef.current = coords;
      lastQueryTimeRef.current = Date.now();
      lastQueryUnitsRef.current = units;

      setStatus((prev) => ({...prev, isLoading: true}));

      try {
        const res = await fetch(
          `/api/speed-limit?lat=${encodeURIComponent(coords.lat)}&lng=${encodeURIComponent(coords.lng)}&units=${units}`
        );

        if (res.status === 429) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
          setStatus((prev) => ({
            ...prev,
            isLoading: false,
            apiAvailable: false,
            reason: 'RESOURCE_EXHAUSTED',
            statusMessage: 'Google Maps Roads API quota reached.',
          }));
          return;
        }

        const data = (await res.json()) as SpeedLimitApiResponse;

        if (data.reason === 'RESOURCE_EXHAUSTED') {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        }

        const isLicenseRestricted =
          data.reason === 'SPEED_LIMIT_LICENSE_REQUIRED' ||
          data.reason === 'ROADS_API_UNAVAILABLE' ||
          data.reason === 'MISSING_API_KEY';

        if (isLicenseRestricted) {
          licenseBlockedRef.current = true;
        } else {
          licenseBlockedRef.current = false;
        }

        setStatus({
          roadLimit:
            typeof data.speedLimit === 'number' ? data.speedLimit : null,
          units: data.units === 'MPH' ? 'MPH' : units,
          placeId: data.placeId ?? null,
          apiAvailable: Boolean(data.available),
          reason: data.reason ?? null,
          statusMessage: data.message ?? null,
          isLoading: false,
          lastUpdatedAt: Date.now(),
        });
      } catch {
        setStatus((prev) => ({
          ...prev,
          isLoading: false,
          apiAvailable: false,
          reason: 'NETWORK_ERROR',
          statusMessage: 'Unable to reach speed limit service.',
        }));
      }
    },
    [enabled]
  );

  useEffect(() => {
    if (!enabled) return;

    const now = Date.now();
    const prevPos = lastQueryPosRef.current;
    const unitsChanged = lastQueryUnitsRef.current !== apiUnits;
    const movedEnough = prevPos ? haversineMeters(prevPos, position) >= 75 : true;
    const intervalElapsed = now - lastQueryTimeRef.current >= 6000;

    if (unitsChanged || (movedEnough && intervalElapsed)) {
      void fetchSpeedLimit(position, apiUnits, unitsChanged);
    }
  }, [
    enabled,
    position.lat,
    position.lng,
    apiUnits,
    fetchSpeedLimit,
  ]);

  const refreshNow = useCallback(() => {
    licenseBlockedRef.current = false;
    void fetchSpeedLimit(position, apiUnits, true);
  }, [fetchSpeedLimit, position, apiUnits]);

  return {
    ...status,
    refreshNow,
  };
}
