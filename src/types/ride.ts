export interface LatLng {
  lat: number;
  lng: number;
}

export type UnitSystem = 'METRIC' | 'IMPERIAL';

export type CockpitView = 'navigate' | 'stops' | 'cluster' | 'settings';

export type TravelModeChoice = 'TWO_WHEELER' | 'DRIVING';

export interface RouteModifierOptions {
  avoidHighways: boolean;
  avoidTolls: boolean;
  avoidFerries: boolean;
}

export interface RidePlace {
  id: string;
  name: string;
  address: string;
  location: LatLng;
  googleMapsURI?: string;
  category?: string;
  rating?: number;
}

export interface NavStep {
  index: number;
  instructions: string;
  maneuver: string;
  distanceMeters: number;
  staticDurationMillis: number;
  startLocation: LatLng;
  endLocation: LatLng;
}

export interface ComputedRouteData {
  distanceMeters: number;
  durationMillis: number;
  localizedDistance?: string;
  localizedDuration?: string;
  description?: string;
  travelModeUsed: TravelModeChoice;
  fallbackFromTwoWheeler: boolean;
  path: LatLng[];
  steps: NavStep[];
  viewport?: google.maps.LatLngBounds | null;
}

export type NearbyStopCategory =
  | 'gas_station'
  | 'cafe'
  | 'restaurant'
  | 'park'
  | 'car_repair';

export interface NearbyPlaceItem {
  id: string;
  name: string;
  address: string;
  location: LatLng;
  distanceMeters: number;
  googleMapsURI?: string;
  businessStatus?: string;
  rating?: number;
  primaryType?: string;
}

export interface RiderTelemetry {
  position: LatLng;
  speedMps: number;
  headingDeg: number;
  accuracyMeters: number | null;
  altitudeMeters: number | null;
  gpsActive: boolean;
  gpsPermissionState: 'idle' | 'requesting' | 'active' | 'denied' | 'unavailable';
  gpsError: string | null;
  tripDistanceMeters: number;
  tripStartMs: number | null;
  maxSpeedMps: number;
}

export interface SpeedLimitStatus {
  roadLimit: number | null;
  units: 'KPH' | 'MPH';
  placeId: string | null;
  apiAvailable: boolean;
  reason: string | null;
  statusMessage: string | null;
  isLoading: boolean;
  lastUpdatedAt: number | null;
}

export interface TripSummary {
  destinationName: string | null;
  status: 'arrived' | 'ended';
  durationMs: number;
  distanceMeters: number;
  maxSpeedMps: number;
  endedAt: number;
}

export interface BikeFuelConfig {
  efficiencyKmPerLiter: number;
  tankCapacityLiters: number;
}

export interface RideHistoryEntry {
  id: string;
  destination: RidePlace | null;
  destinationName: string | null;
  status: 'arrived' | 'ended';
  durationMs: number;
  distanceMeters: number;
  maxSpeedMps: number;
  fuelUsedLiters: number;
  travelMode: TravelModeChoice;
  endedAt: number;
}




