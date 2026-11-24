import {
  Coffee,
  ExternalLink,
  Fuel,
  Loader2,
  MapPin,
  Navigation,
  Plus,
  Trees,
  Utensils,
  Wrench,
} from 'lucide-react';
import {formatDistance} from '../lib/geoUtils';
import type {
  NearbyPlaceItem,
  NearbyStopCategory,
  RidePlace,
  UnitSystem,
} from '../types/ride';

interface RiderStopsDrawerProps {
  stops: NearbyPlaceItem[];
  activeCategory: NearbyStopCategory | null;
  isLoading: boolean;
  error: string | null;
  unitSystem: UnitSystem;
  hasActiveRoute: boolean;
  onSelectCategory: (cat: NearbyStopCategory) => void;
  onFocusStop: (stop: NearbyPlaceItem) => void;
  onRideToStop: (place: RidePlace) => void;
  onAddWaypoint: (place: RidePlace) => void;
}

const CATEGORIES: {
  id: NearbyStopCategory;
  label: string;
  icon: typeof Fuel;
}[] = [
  {id: 'gas_station', label: 'Fuel', icon: Fuel},
  {id: 'cafe', label: 'Coffee', icon: Coffee},
  {id: 'restaurant', label: 'Food', icon: Utensils},
  {id: 'park', label: 'Scenic', icon: Trees},
  {id: 'car_repair', label: 'Service', icon: Wrench},
];

function toRidePlace(item: NearbyPlaceItem): RidePlace {
  return {
    id: item.id,
    name: item.name,
    address: item.address,
    location: item.location,
    googleMapsURI: item.googleMapsURI,
    rating: item.rating,
  };
}

export function RiderStopsDrawer({
  stops,
  activeCategory,
  isLoading,
  error,
  unitSystem,
  hasActiveRoute,
  onSelectCategory,
  onFocusStop,
  onRideToStop,
  onAddWaypoint,
}: RiderStopsDrawerProps) {
  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#11151B] text-slate-900 dark:text-slate-100">
      <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-white/10">
        <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Nearby Rider Stops
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Find fuel, coffee, food, scenic overlooks, or service near your position
        </p>

        <div className="mt-3 grid grid-cols-3 sm:grid-cols-5 md:grid-cols-3 gap-2">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const active = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => onSelectCategory(cat.id)}
                className={`min-h-[48px] px-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-orange-600 text-white border-orange-600'
                    : 'bg-slate-50 dark:bg-white/5 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto cockpit-scroll p-4">
        {isLoading ? (
          <div className="h-48 flex flex-col items-center justify-center gap-3 text-sm text-slate-500 dark:text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
            <span>Scanning nearby stops...</span>
          </div>
        ) : error ? (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        ) : !activeCategory ? (
          <div className="h-48 flex flex-col items-center justify-center text-center px-4 text-sm text-slate-500 dark:text-slate-400">
            <MapPin className="w-8 h-8 text-slate-400 mb-2" />
            <span>Select a stop category above to search near your bike.</span>
          </div>
        ) : stops.length === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center text-center px-4 text-sm text-slate-500 dark:text-slate-400">
            <span>No matching places found within range. Try another category or pan the map.</span>
          </div>
        ) : (
          <div className="space-y-3">
            {stops.map((stop) => (
              <div
                key={stop.id}
                className="p-3.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-[#161B23]"
              >
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => onFocusStop(stop)}
                    className="text-left min-w-0 flex-1"
                  >
                    <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                      {stop.name}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                      {stop.address || 'Address unavailable'}
                    </div>
                  </button>
                  <span className="font-mono-tabular text-xs font-semibold text-orange-600 dark:text-orange-400 shrink-0">
                    {formatDistance(stop.distanceMeters, unitSystem)}
                  </span>
                </div>

                <div className="mt-2 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  {stop.rating !== undefined && (
                    <span>{stop.rating.toFixed(1)} rating</span>
                  )}
                  {stop.rating !== undefined && stop.businessStatus && (
                    <span aria-hidden="true">·</span>
                  )}
                  {stop.businessStatus === 'OPERATIONAL' && (
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                      Open
                    </span>
                  )}
                  {stop.googleMapsURI && (
                    <>
                      <span aria-hidden="true">·</span>
                      <a
                        href={stop.googleMapsURI}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-300 hover:underline"
                      >
                        <span>Maps</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </>
                  )}
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onRideToStop(toRidePlace(stop))}
                    className="flex-1 min-h-[44px] px-3 rounded-lg bg-orange-600 text-white hover:bg-orange-500 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Navigation className="w-4 h-4" />
                    <span>Ride Here</span>
                  </button>
                  {hasActiveRoute && (
                    <button
                      type="button"
                      onClick={() => onAddWaypoint(toRidePlace(stop))}
                      className="min-h-[44px] px-3 rounded-lg border border-slate-300 dark:border-white/15 bg-white dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add Stop</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
