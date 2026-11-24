import type {LatLng, UnitSystem} from '../types/ride';

const EARTH_RADIUS_M = 6371000;

export function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function toDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

export function haversineMeters(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * EARTH_RADIUS_M * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function computeBearing(from: LatLng, to: LatLng): number {
  const lat1 = toRad(from.lat);
  const lat2 = toRad(to.lat);
  const dLng = toRad(to.lng - from.lng);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

export function bearingToCardinal(deg: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const idx = Math.round((((deg % 360) + 360) % 360) / 45) % 8;
  return dirs[idx];
}

export function formatDistance(meters: number, unitSystem: UnitSystem): string {
  if (unitSystem === 'IMPERIAL') {
    const feet = meters * 3.28084;
    if (feet < 1000) {
      return `${Math.round(feet / 10) * 10} ft`;
    }
    const miles = meters / 1609.344;
    return miles >= 10 ? `${miles.toFixed(0)} mi` : `${miles.toFixed(1)} mi`;
  }
  if (meters < 1000) {
    return `${Math.round(meters / 10) * 10} m`;
  }
  const km = meters / 1000;
  return km >= 10 ? `${km.toFixed(0)} km` : `${km.toFixed(1)} km`;
}

export function formatDuration(ms: number): string {
  const totalMins = Math.max(1, Math.round(ms / 60000));
  if (totalMins < 60) {
    return `${totalMins} min`;
  }
  const hrs = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  return mins === 0 ? `${hrs} hr` : `${hrs}h ${mins}m`;
}

export function formatEtaClock(durationMs: number): string {
  const arrival = new Date(Date.now() + durationMs);
  return arrival.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
}

export function convertSpeed(mps: number, unitSystem: UnitSystem): number {
  const safeMps = Math.max(0, mps);
  return unitSystem === 'IMPERIAL'
    ? Math.round(safeMps * 2.23694)
    : Math.round(safeMps * 3.6);
}

export function speedUnitLabel(unitSystem: UnitSystem): string {
  return unitSystem === 'IMPERIAL' ? 'mph' : 'km/h';
}

export function formatElapsed(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return hrs > 0 ? `${hrs}:${pad(mins)}:${pad(secs)}` : `${pad(mins)}:${pad(secs)}`;
}

const KM_PER_LITER_TO_MPG = 2.35214583;
const LITERS_TO_GALLONS = 0.264172052;

export function kmPerLiterToMpg(kmPerLiter: number): number {
  return Math.max(0, kmPerLiter) * KM_PER_LITER_TO_MPG;
}

export function mpgToKmPerLiter(mpg: number): number {
  return Math.max(0, mpg) / KM_PER_LITER_TO_MPG;
}

export function litersToGallons(liters: number): number {
  return Math.max(0, liters) * LITERS_TO_GALLONS;
}

export function gallonsToLiters(gallons: number): number {
  return Math.max(0, gallons) / LITERS_TO_GALLONS;
}

export function estimateFuelLiters(
  distanceMeters: number,
  efficiencyKmPerLiter: number
): number {
  const safeMeters = Math.max(0, distanceMeters);
  const safeEfficiency = Math.max(1, efficiencyKmPerLiter);
  return safeMeters / 1000 / safeEfficiency;
}

export function formatFuelVolume(
  liters: number,
  unitSystem: UnitSystem
): string {
  const safeLiters = Math.max(0, liters);
  if (unitSystem === 'IMPERIAL') {
    const gal = litersToGallons(safeLiters);
    return `${gal.toFixed(2)} gal`;
  }
  return `${safeLiters.toFixed(2)} L`;
}

export function formatEfficiency(
  kmPerLiter: number,
  unitSystem: UnitSystem
): string {
  const safe = Math.max(1, kmPerLiter);
  if (unitSystem === 'IMPERIAL') {
    return `${Math.round(kmPerLiterToMpg(safe))} mpg`;
  }
  return `${safe.toFixed(1)} km/L`;
}

export interface PathProgressResult {
  position: LatLng;
  bearing: number;
  traveledMeters: number;
  totalMeters: number;
  finished: boolean;
}

export function getTotalPathMeters(path: LatLng[]): number {
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    total += haversineMeters(path[i - 1], path[i]);
  }
  return total;
}

export function samplePointAlongPath(
  path: LatLng[],
  targetMeters: number
): PathProgressResult {
  if (path.length === 0) {
    return {
      position: {lat: 0, lng: 0},
      bearing: 0,
      traveledMeters: 0,
      totalMeters: 0,
      finished: true,
    };
  }
  if (path.length === 1) {
    return {
      position: path[0],
      bearing: 0,
      traveledMeters: 0,
      totalMeters: 0,
      finished: true,
    };
  }

  const totalMeters = getTotalPathMeters(path);
  if (targetMeters >= totalMeters) {
    const last = path[path.length - 1];
    const prev = path[path.length - 2];
    return {
      position: last,
      bearing: computeBearing(prev, last),
      traveledMeters: totalMeters,
      totalMeters,
      finished: true,
    };
  }

  let acc = 0;
  for (let i = 1; i < path.length; i++) {
    const segLen = haversineMeters(path[i - 1], path[i]);
    if (acc + segLen >= targetMeters && segLen > 0) {
      const ratio = (targetMeters - acc) / segLen;
      const lat = path[i - 1].lat + (path[i].lat - path[i - 1].lat) * ratio;
      const lng = path[i - 1].lng + (path[i].lng - path[i - 1].lng) * ratio;
      return {
        position: {lat, lng},
        bearing: computeBearing(path[i - 1], path[i]),
        traveledMeters: targetMeters,
        totalMeters,
        finished: false,
      };
    }
    acc += segLen;
  }

  const last = path[path.length - 1];
  const prev = path[path.length - 2];
  return {
    position: last,
    bearing: computeBearing(prev, last),
    traveledMeters: totalMeters,
    totalMeters,
    finished: true,
  };
}
