import {useCallback, useEffect, useRef, useState} from 'react';
import {
  AdvancedMarker,
  InfoWindow,
  Map as GoogleMapView,
  Pin,
  useMap,
} from '@vis.gl/react-google-maps';
import {
  Activity,
  Crosshair,
  ExternalLink,
  Layers,
  Minus,
  Navigation,
  Plus,
} from 'lucide-react';
import {formatDistance} from '../lib/geoUtils';
import {ATTRIBUTION_ID} from '../lib/mapsConfig';
import type {
  ComputedRouteData,
  LatLng,
  NearbyPlaceItem,
  RidePlace,
  UnitSystem,
} from '../types/ride';

interface MotoMapCanvasProps {
  riderPosition: LatLng;
  riderHeadingDeg: number;
  isDark: boolean;
  showTraffic: boolean;
  onToggleTraffic: () => void;
  followRider: boolean;
  onSetFollowRider: (follow: boolean) => void;
  route: ComputedRouteData | null;
  destination: RidePlace | null;
  waypoints: RidePlace[];
  nearbyStops: NearbyPlaceItem[];
  selectedStop: NearbyPlaceItem | null;
  onSelectStop: (stop: NearbyPlaceItem | null) => void;
  onRideToStop: (place: RidePlace) => void;
  onAddWaypoint: (place: RidePlace) => void;
  unitSystem: UnitSystem;
}

function RouteAndTrafficOverlay({
  route,
  showTraffic,
  riderPosition,
  followRider,
  mapTypeId,
}: {
  route: ComputedRouteData | null;
  showTraffic: boolean;
  riderPosition: LatLng;
  followRider: boolean;
  mapTypeId: 'roadmap' | 'hybrid';
}) {
  const map = useMap();
  const polylinesRef = useRef<google.maps.Polyline[]>([]);
  const trafficLayerRef = useRef<google.maps.TrafficLayer | null>(null);
  const lastFittedRouteRef = useRef<ComputedRouteData | null>(null);

  // Sync mapTypeId
  useEffect(() => {
    if (!map) return;
    map.setMapTypeId(mapTypeId);
  }, [map, mapTypeId]);

  // Manage live TrafficLayer
  useEffect(() => {
    if (!map) return;
    if (!trafficLayerRef.current) {
      trafficLayerRef.current = new google.maps.TrafficLayer();
    }
    trafficLayerRef.current.setMap(showTraffic ? map : null);
    return () => {
      trafficLayerRef.current?.setMap(null);
    };
  }, [map, showTraffic]);

  // Draw crisp double-layered motorcycle route polyline
  useEffect(() => {
    polylinesRef.current.forEach((p) => p.setMap(null));
    polylinesRef.current = [];

    if (!map || !route || route.path.length === 0) return;

    const casing = new google.maps.Polyline({
      path: route.path,
      geodesic: true,
      strokeColor: '#0F172A',
      strokeOpacity: 0.75,
      strokeWeight: 10,
      zIndex: 10,
      map,
    });

    const core = new google.maps.Polyline({
      path: route.path,
      geodesic: true,
      strokeColor: '#F97316',
      strokeOpacity: 1,
      strokeWeight: 6,
      zIndex: 11,
      map,
    });

    polylinesRef.current = [casing, core];

    if (route.viewport && lastFittedRouteRef.current !== route) {
      lastFittedRouteRef.current = route;
      map.fitBounds(route.viewport, {
        top: 48,
        right: 48,
        bottom: 48,
        left: 48,
      });
    }

    return () => {
      polylinesRef.current.forEach((p) => p.setMap(null));
      polylinesRef.current = [];
    };
  }, [map, route]);

  // Follow rider camera smoothly when locked
  useEffect(() => {
    if (!map || !followRider) return;
    map.panTo(riderPosition);
  }, [map, followRider, riderPosition.lat, riderPosition.lng]);

  return null;
}

function MapZoomAndRecenterControls({
  riderPosition,
  followRider,
  onSetFollowRider,
  showTraffic,
  onToggleTraffic,
  mapTypeId,
  onToggleMapType,
}: {
  riderPosition: LatLng;
  followRider: boolean;
  onSetFollowRider: (follow: boolean) => void;
  showTraffic: boolean;
  onToggleTraffic: () => void;
  mapTypeId: 'roadmap' | 'hybrid';
  onToggleMapType: () => void;
}) {
  const map = useMap();

  const handleZoomIn = useCallback(() => {
    if (!map) return;
    const z = map.getZoom() ?? 14;
    map.setZoom(Math.min(z + 1, 21));
  }, [map]);

  const handleZoomOut = useCallback(() => {
    if (!map) return;
    const z = map.getZoom() ?? 14;
    map.setZoom(Math.max(z - 1, 3));
  }, [map]);

  const handleRecenter = useCallback(() => {
    if (!map) return;
    onSetFollowRider(true);
    map.panTo(riderPosition);
    if ((map.getZoom() ?? 0) < 15) {
      map.setZoom(16);
    }
  }, [map, riderPosition, onSetFollowRider]);

  return (
    <div className="absolute right-3 sm:right-4 bottom-20 md:bottom-6 z-20 flex flex-col gap-2.5 select-none">
      <button
        type="button"
        onClick={onToggleTraffic}
        aria-label={showTraffic ? 'Hide live traffic' : 'Show live traffic'}
        title="Live Traffic"
        className={`min-h-[48px] min-w-[48px] rounded-xl border shadow-lg backdrop-blur-md flex items-center justify-center transition-colors ${
          showTraffic
            ? 'bg-orange-600 text-white border-orange-500'
            : 'bg-white/90 dark:bg-[#141922]/90 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-white/15 hover:bg-white dark:hover:bg-[#1C222D]'
        }`}
      >
        <Activity className="w-5 h-5" />
      </button>

      <button
        type="button"
        onClick={onToggleMapType}
        aria-label="Toggle satellite view"
        title={mapTypeId === 'hybrid' ? 'Road Map' : 'Satellite Map'}
        className={`min-h-[48px] min-w-[48px] rounded-xl border shadow-lg backdrop-blur-md flex items-center justify-center transition-colors ${
          mapTypeId === 'hybrid'
            ? 'bg-orange-600 text-white border-orange-500'
            : 'bg-white/90 dark:bg-[#141922]/90 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-white/15 hover:bg-white dark:hover:bg-[#1C222D]'
        }`}
      >
        <Layers className="w-5 h-5" />
      </button>

      <div className="flex flex-col rounded-xl border border-slate-200 dark:border-white/15 bg-white/90 dark:bg-[#141922]/90 backdrop-blur-md shadow-lg overflow-hidden">
        <button
          type="button"
          onClick={handleZoomIn}
          aria-label="Zoom in"
          className="min-h-[48px] min-w-[48px] flex items-center justify-center text-slate-800 dark:text-white hover:bg-slate-100 dark:hover:bg-white/10 border-b border-slate-200 dark:border-white/10"
        >
          <Plus className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={handleZoomOut}
          aria-label="Zoom out"
          className="min-h-[48px] min-w-[48px] flex items-center justify-center text-slate-800 dark:text-white hover:bg-slate-100 dark:hover:bg-white/10"
        >
          <Minus className="w-5 h-5" />
        </button>
      </div>

      <button
        type="button"
        onClick={handleRecenter}
        aria-label="Recenter on motorcycle"
        title="Recenter"
        className={`min-h-[52px] min-w-[48px] rounded-xl border shadow-lg backdrop-blur-md flex items-center justify-center transition-colors ${
          followRider
            ? 'bg-orange-600 text-white border-orange-500'
            : 'bg-white/90 dark:bg-[#141922]/90 text-slate-800 dark:text-white border-slate-200 dark:border-white/15 hover:bg-white dark:hover:bg-[#1C222D]'
        }`}
      >
        <Crosshair className="w-5 h-5" />
      </button>
    </div>
  );
}

export function MotoMapCanvas({
  riderPosition,
  riderHeadingDeg,
  isDark,
  showTraffic,
  onToggleTraffic,
  followRider,
  onSetFollowRider,
  route,
  destination,
  waypoints,
  nearbyStops,
  selectedStop,
  onSelectStop,
  onRideToStop,
  onAddWaypoint,
  unitSystem,
}: MotoMapCanvasProps) {
  const [mapTypeId, setMapTypeId] = useState<'roadmap' | 'hybrid'>('roadmap');
  const [selectedAnchor, setSelectedAnchor] =
    useState<google.maps.marker.AdvancedMarkerElement | null>(null);

  return (
    <div className="relative w-full h-full min-h-[280px]">
      <GoogleMapView
        key={isDark ? 'moto-map-dark' : 'moto-map-light'}
        mapId="DEMO_MAP_ID"
        colorScheme={isDark ? 'DARK' : 'LIGHT'}
        defaultCenter={riderPosition}
        defaultZoom={15}
        gestureHandling="greedy"
        disableDefaultUI={true}
        clickableIcons={false}
        onDragstart={() => onSetFollowRider(false)}
        internalUsageAttributionIds={[ATTRIBUTION_ID]}
        style={{width: '100%', height: '100%'}}
      >
        <RouteAndTrafficOverlay
          route={route}
          showTraffic={showTraffic}
          riderPosition={riderPosition}
          followRider={followRider}
          mapTypeId={mapTypeId}
        />

        {/* Motorcycle Rider Marker */}
        <AdvancedMarker position={riderPosition} zIndex={50}>
          <div
            className="relative flex items-center justify-center w-12 h-12"
            aria-label="Motorcycle position"
          >
            <div className="absolute inset-1 rounded-full bg-orange-500/25 border border-orange-400/50" />
            <div
              className="w-8 h-8 flex items-center justify-center transition-transform duration-150"
              style={{transform: `rotate(${riderHeadingDeg}deg)`}}
            >
              <svg
                viewBox="0 0 32 32"
                className="w-8 h-8 drop-shadow-[0_2px_6px_rgba(0,0,0,0.65)]"
                aria-hidden="true"
              >
                <path
                  d="M16 2L27 28L16 22.5L5 28L16 2Z"
                  fill="#F97316"
                  stroke="#FFFFFF"
                  strokeWidth="2.2"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>
        </AdvancedMarker>

        {/* Waypoint Markers */}
        {waypoints.map((wp, idx) => (
          <AdvancedMarker key={wp.id} position={wp.location} zIndex={35}>
            <Pin
              background="#0F172A"
              borderColor="#F97316"
              glyphColor="#FFFFFF"
              glyphText={String(idx + 1)}
            />
          </AdvancedMarker>
        ))}

        {/* Destination Marker */}
        {destination && (
          <AdvancedMarker position={destination.location} zIndex={40}>
            <Pin
              background="#EA580C"
              borderColor="#FFFFFF"
              glyphColor="#FFFFFF"
            />
          </AdvancedMarker>
        )}

        {/* Nearby Rider Stops Markers */}
        {nearbyStops.map((stop) => (
          <AdvancedMarker
            key={stop.id}
            position={stop.location}
            zIndex={selectedStop?.id === stop.id ? 45 : 25}
            onClick={(e) => {
              onSelectStop(stop);
              setSelectedAnchor(
                (e as unknown as {target?: google.maps.marker.AdvancedMarkerElement})
                  .target ?? null
              );
            }}
          >
            <Pin
              background={selectedStop?.id === stop.id ? '#EA580C' : '#1E293B'}
              borderColor="#FFFFFF"
              glyphColor="#F8FAFC"
              scale={selectedStop?.id === stop.id ? 1.15 : 0.9}
            />
          </AdvancedMarker>
        ))}

        {selectedStop && (
          <InfoWindow
            position={selectedStop.location}
            anchor={selectedAnchor ?? undefined}
            onCloseClick={() => {
              onSelectStop(null);
              setSelectedAnchor(null);
            }}
          >
            <div className="min-w-[200px] max-w-[260px] p-1 text-slate-900">
              <div className="font-semibold text-sm leading-snug">
                {selectedStop.name}
              </div>
              {selectedStop.address && (
                <div className="text-xs text-slate-600 mt-0.5">
                  {selectedStop.address}
                </div>
              )}
              <div className="text-xs font-medium text-orange-600 mt-1 font-mono tabular-nums">
                {formatDistance(selectedStop.distanceMeters, unitSystem)} away
              </div>
              <div className="mt-2.5 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onRideToStop({
                      id: selectedStop.id,
                      name: selectedStop.name,
                      address: selectedStop.address,
                      location: selectedStop.location,
                      googleMapsURI: selectedStop.googleMapsURI,
                    });
                    onSelectStop(null);
                  }}
                  className="flex-1 px-2.5 py-1.5 rounded-md bg-orange-600 text-white text-xs font-semibold flex items-center justify-center gap-1"
                >
                  <Navigation className="w-3.5 h-3.5" />
                  <span>Ride</span>
                </button>
                {route && (
                  <button
                    type="button"
                    onClick={() => {
                      onAddWaypoint({
                        id: selectedStop.id,
                        name: selectedStop.name,
                        address: selectedStop.address,
                        location: selectedStop.location,
                        googleMapsURI: selectedStop.googleMapsURI,
                      });
                      onSelectStop(null);
                    }}
                    className="px-2.5 py-1.5 rounded-md bg-slate-200 text-slate-900 text-xs font-semibold"
                  >
                    + Stop
                  </button>
                )}
              </div>
              {selectedStop.googleMapsURI && (
                <a
                  href={selectedStop.googleMapsURI}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-[11px] text-slate-500 hover:underline"
                >
                  <span>Open in Google Maps</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </InfoWindow>
        )}
      </GoogleMapView>

      <MapZoomAndRecenterControls
        riderPosition={riderPosition}
        followRider={followRider}
        onSetFollowRider={onSetFollowRider}
        showTraffic={showTraffic}
        onToggleTraffic={onToggleTraffic}
        mapTypeId={mapTypeId}
        onToggleMapType={() =>
          setMapTypeId((prev) => (prev === 'roadmap' ? 'hybrid' : 'roadmap'))
        }
      />
    </div>
  );
}
