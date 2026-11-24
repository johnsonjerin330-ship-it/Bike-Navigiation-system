import {useCallback, useState} from 'react';
import {useMapsLibrary} from '@vis.gl/react-google-maps';
import {ATTRIBUTION_ID, checkAndDispatchQuotaError} from '../lib/mapsConfig';
import type {
  ComputedRouteData,
  LatLng,
  NavStep,
  RidePlace,
  RouteModifierOptions,
  TravelModeChoice,
} from '../types/ride';

function extractLatLng(pt: unknown): LatLng | null {
  if (!pt || typeof pt !== 'object') return null;
  const candidate = pt as {
    lat?: number | (() => number);
    lng?: number | (() => number);
  };
  const lat =
    typeof candidate.lat === 'function' ? candidate.lat() : candidate.lat;
  const lng =
    typeof candidate.lng === 'function' ? candidate.lng() : candidate.lng;
  if (typeof lat === 'number' && typeof lng === 'number') {
    return {lat, lng};
  }
  return null;
}

export function useRideNavigation() {
  const routesLib = useMapsLibrary('routes');
  const [route, setRoute] = useState<ComputedRouteData | null>(null);
  const [isComputing, setIsComputing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearRoute = useCallback(() => {
    setRoute(null);
    setError(null);
  }, []);

  const computeRideRoute = useCallback(
    async (
      origin: LatLng,
      destination: RidePlace,
      waypoints: RidePlace[],
      travelMode: TravelModeChoice,
      modifiers: RouteModifierOptions
    ): Promise<ComputedRouteData | null> => {
      if (!routesLib) {
        setError('Maps Routes library is still initializing.');
        return null;
      }

      setIsComputing(true);
      setError(null);

      const runCompute = async (mode: TravelModeChoice) => {
        const sdkTravelModeMap = (
          routesLib as unknown as {
            TravelMode?: Record<string, google.maps.TravelMode>;
          }
        ).TravelMode;
        const sdkMode =
          sdkTravelModeMap?.[mode] ??
          (mode as unknown as google.maps.TravelMode);

        const sdkRoutingPrefMap = (
          routesLib as unknown as {
            RoutingPreference?: Record<string, google.maps.routes.RoutingPreference>;
          }
        ).RoutingPreference;

        const request: google.maps.routes.ComputeRoutesRequest = {
          origin: {lat: origin.lat, lng: origin.lng},
          destination: {
            lat: destination.location.lat,
            lng: destination.location.lng,
          },
          ...(waypoints.length > 0
            ? {
                intermediates: waypoints.map((wp) => ({
                  location: {lat: wp.location.lat, lng: wp.location.lng},
                })),
              }
            : {}),
          travelMode: sdkMode,
          routingPreference:
            sdkRoutingPrefMap?.TRAFFIC_AWARE ??
            ('TRAFFIC_AWARE' as google.maps.routes.RoutingPreference),
          routeModifiers: {
            avoidHighways: modifiers.avoidHighways,
            avoidTolls: modifiers.avoidTolls,
            avoidFerries: modifiers.avoidFerries,
          },
          fields: [
            'path',
            'distanceMeters',
            'durationMillis',
            'viewport',
            'legs',
            'localizedValues',
            'description',
          ],
          internalUsageAttributionIds: [ATTRIBUTION_ID],
        };

        return routesLib.Route.computeRoutes(request);
      };

      try {
        let usedMode: TravelModeChoice = travelMode;
        let fallbackFromTwoWheeler = false;
        let response: {routes?: google.maps.routes.Route[]} | null = null;

        try {
          response = await runCompute(travelMode);
        } catch (primaryErr) {
          if (travelMode === 'TWO_WHEELER') {
            // Two-wheeler routing is regional; fall back to standard road routing seamlessly
            response = await runCompute('DRIVING');
            usedMode = 'DRIVING';
            fallbackFromTwoWheeler = true;
          } else {
            throw primaryErr;
          }
        }

        if (
          (!response?.routes || response.routes.length === 0) &&
          travelMode === 'TWO_WHEELER'
        ) {
          response = await runCompute('DRIVING');
          usedMode = 'DRIVING';
          fallbackFromTwoWheeler = true;
        }

        const primaryRoute = response?.routes?.[0];
        if (!primaryRoute) {
          setError('No drivable route found between these points.');
          setRoute(null);
          return null;
        }

        const path: LatLng[] = (primaryRoute.path || [])
          .map((pt) => extractLatLng(pt))
          .filter((p): p is LatLng => p !== null);

        const steps: NavStep[] = [];
        let stepCounter = 0;
        for (const leg of primaryRoute.legs || []) {
          for (const s of leg.steps || []) {
            const start = extractLatLng(s.startLocation) ?? origin;
            const end = extractLatLng(s.endLocation) ?? destination.location;
            steps.push({
              index: stepCounter++,
              instructions:
                (s.instructions || '').trim() || 'Continue on current road',
              maneuver: String(s.maneuver || 'STRAIGHT'),
              distanceMeters: s.distanceMeters ?? 0,
              staticDurationMillis: s.staticDurationMillis ?? 0,
              startLocation: start,
              endLocation: end,
            });
          }
        }

        const computed: ComputedRouteData = {
          distanceMeters: primaryRoute.distanceMeters ?? 0,
          durationMillis: primaryRoute.durationMillis ?? 0,
          localizedDistance: primaryRoute.localizedValues?.distance ?? undefined,
          localizedDuration: primaryRoute.localizedValues?.duration ?? undefined,
          description: primaryRoute.description ?? undefined,
          travelModeUsed: usedMode,
          fallbackFromTwoWheeler,
          path,
          steps,
          viewport: primaryRoute.viewport ?? null,
        };

        setRoute(computed);
        return computed;
      } catch (err) {
        const isQuota = checkAndDispatchQuotaError(err);
        if (!isQuota) {
          setError(
            'Unable to load route data. Please verify your destination or network connection.'
          );
        } else {
          setError('Maps API quota reached while calculating route.');
        }
        setRoute(null);
        return null;
      } finally {
        setIsComputing(false);
      }
    },
    [routesLib]
  );

  return {
    route,
    isComputing,
    error,
    computeRideRoute,
    clearRoute,
  };
}
