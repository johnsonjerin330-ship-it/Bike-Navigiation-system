import {useCallback, useState} from 'react';
import {useMapsLibrary} from '@vis.gl/react-google-maps';
import {haversineMeters} from '../lib/geoUtils';
import {ATTRIBUTION_ID, checkAndDispatchQuotaError} from '../lib/mapsConfig';
import type {LatLng, NearbyPlaceItem, NearbyStopCategory} from '../types/ride';

export function useNearbyRiderStops() {
  const placesLib = useMapsLibrary('places');
  const [stops, setStops] = useState<NearbyPlaceItem[]>([]);
  const [activeCategory, setActiveCategory] =
    useState<NearbyStopCategory | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearStops = useCallback(() => {
    setStops([]);
    setActiveCategory(null);
    setError(null);
  }, []);

  const searchCategory = useCallback(
    async (category: NearbyStopCategory, center: LatLng, radiusMeters = 8000) => {
      if (!placesLib) {
        setError('Places library is still loading.');
        return;
      }

      setActiveCategory(category);
      setIsLoading(true);
      setError(null);

      try {
        const {Place, SearchNearbyRankPreference} = placesLib;
        const clampedRadius = Math.min(Math.max(radiusMeters, 500), 50000);

        const request: google.maps.places.SearchNearbyRequest = {
          fields: [
            'id',
            'displayName',
            'location',
            'formattedAddress',
            'businessStatus',
            'googleMapsURI',
            'rating',
            'primaryType',
          ],
          locationRestriction: {
            center,
            radius: clampedRadius,
          },
          includedPrimaryTypes: [category],
          maxResultCount: 10,
          rankPreference: SearchNearbyRankPreference.DISTANCE,
          internalUsageAttributionIds: [ATTRIBUTION_ID],
        };

        const {places} = await Place.searchNearby(request);

        const mapped: NearbyPlaceItem[] = (places || [])
          .filter((p) => Boolean(p.location))
          .map((p, idx) => {
            const loc = {
              lat: p.location!.lat(),
              lng: p.location!.lng(),
            };
            return {
              id: p.id || `${category}-${idx}`,
              name: p.displayName || 'Nearby Stop',
              address: p.formattedAddress || '',
              location: loc,
              distanceMeters: haversineMeters(center, loc),
              googleMapsURI: p.googleMapsURI ?? undefined,
              businessStatus: p.businessStatus
                ? String(p.businessStatus)
                : undefined,
              rating: p.rating ?? undefined,
              primaryType: p.primaryType ?? undefined,
            };
          })
          .sort((a, b) => a.distanceMeters - b.distanceMeters);

        setStops(mapped);
      } catch (err) {
        const isQuota = checkAndDispatchQuotaError(err);
        setError(
          isQuota
            ? 'Google Maps quota reached while searching nearby stops.'
            : 'Unable to find nearby stops right now.'
        );
        setStops([]);
      } finally {
        setIsLoading(false);
      }
    },
    [placesLib]
  );

  return {
    stops,
    activeCategory,
    isLoading,
    error,
    searchCategory,
    clearStops,
  };
}
