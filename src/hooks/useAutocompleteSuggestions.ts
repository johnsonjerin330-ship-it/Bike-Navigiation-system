import {useCallback, useEffect, useRef, useState} from 'react';
import {useMapsLibrary} from '@vis.gl/react-google-maps';
import {checkAndDispatchQuotaError} from '../lib/mapsConfig';
import type {LatLng, RidePlace} from '../types/ride';

export interface AutocompletePredictionItem {
  id: string;
  mainText: string;
  secondaryText: string;
  fullText: string;
  raw: google.maps.places.AutocompleteSuggestion;
}

export function useAutocompleteSuggestions(
  input: string,
  biasCenter?: LatLng
) {
  const placesLib = useMapsLibrary('places');
  const sessionTokenRef =
    useRef<google.maps.places.AutocompleteSessionToken | null>(null);

  const [predictions, setPredictions] = useState<AutocompletePredictionItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const trimmed = input.trim();
    if (!placesLib || trimmed.length < 2) {
      setPredictions([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      const {AutocompleteSessionToken, AutocompleteSuggestion} = placesLib;
      if (!sessionTokenRef.current) {
        sessionTokenRef.current = new AutocompleteSessionToken();
      }

      setIsLoading(true);
      setError(null);

      try {
        const request: google.maps.places.AutocompleteRequest = {
          input: trimmed,
          sessionToken: sessionTokenRef.current,
          ...(biasCenter
            ? {
                locationBias: {
                  center: biasCenter,
                  radius: 50000,
                },
              }
            : {}),
        };

        const res =
          await AutocompleteSuggestion.fetchAutocompleteSuggestions(request);

        if (cancelled) return;

        const mapped: AutocompletePredictionItem[] = (res.suggestions || [])
          .filter((s) => Boolean(s.placePrediction))
          .map((s, idx) => {
            const pred = s.placePrediction!;
            return {
              id: pred.placeId || `pred-${idx}`,
              mainText: pred.mainText?.text || pred.text?.text || 'Destination',
              secondaryText: pred.secondaryText?.text || '',
              fullText: pred.text?.text || '',
              raw: s,
            };
          });

        setPredictions(mapped);
      } catch (err) {
        if (cancelled) return;
        checkAndDispatchQuotaError(err);
        setError('Unable to fetch place suggestions right now.');
        setPredictions([]);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }, 240);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [placesLib, input, biasCenter?.lat, biasCenter?.lng]);

  const resetSession = useCallback(() => {
    sessionTokenRef.current = null;
    setPredictions([]);
  }, []);

  const selectPrediction = useCallback(
    async (item: AutocompletePredictionItem): Promise<RidePlace | null> => {
      if (!placesLib || !item.raw.placePrediction) return null;
      try {
        const place = item.raw.placePrediction.toPlace();
        await place.fetchFields({
          fields: [
            'id',
            'displayName',
            'formattedAddress',
            'location',
            'googleMapsURI',
            'rating',
          ],
        });

        resetSession();

        if (!place.location) {
          setError('Selected place has no map coordinates.');
          return null;
        }

        return {
          id: place.id || item.id,
          name: place.displayName || item.mainText,
          address: place.formattedAddress || item.secondaryText,
          location: {
            lat: place.location.lat(),
            lng: place.location.lng(),
          },
          googleMapsURI: place.googleMapsURI ?? undefined,
          rating: place.rating ?? undefined,
        };
      } catch (err) {
        checkAndDispatchQuotaError(err);
        setError('Unable to load place details.');
        return null;
      }
    },
    [placesLib, resetSession]
  );

  return {
    predictions,
    isLoading,
    error,
    selectPrediction,
    resetSession,
  };
}
