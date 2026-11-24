import {useEffect, useState} from 'react';
import {
  Compass,
  Fuel,
  Gauge,
  Moon,
  Settings,
  Sun,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type {CockpitView} from '../types/ride';

interface SystemDockProps {
  activeView: CockpitView;
  onSelectView: (view: CockpitView) => void;
  isDark: boolean;
  onToggleTheme: () => void;
  voiceEnabled: boolean;
  onToggleVoice: () => void;
  hasActiveRoute: boolean;
}

export function SystemDock({
  activeView,
  onSelectView,
  isDark,
  onToggleTheme,
  voiceEnabled,
  onToggleVoice,
  hasActiveRoute,
}: SystemDockProps) {
  const [clock, setClock] = useState(() =>
    new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})
  );

  useEffect(() => {
    const id = setInterval(() => {
      setClock(
        new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})
      );
    }, 15000);
    return () => clearInterval(id);
  }, []);

  const navItems: {
    id: CockpitView;
    label: string;
    icon: typeof Compass;
    badge?: boolean;
  }[] = [
    {id: 'navigate', label: 'Ride', icon: Compass, badge: hasActiveRoute},
    {id: 'stops', label: 'Stops', icon: Fuel},
    {id: 'cluster', label: 'Dash', icon: Gauge},
    {id: 'settings', label: 'Setup', icon: Settings},
  ];

  return (
    <>
      {/* Desktop / Landscape Android Auto Left Rail */}
      <aside
        aria-label="Cockpit Dock"
        className="hidden md:flex flex-col items-center justify-between w-20 shrink-0 py-4 px-2 border-r border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-[#0B0E13] text-slate-900 dark:text-slate-100 select-none z-30"
      >
        <div className="flex flex-col items-center gap-1">
          <span className="font-mono-tabular text-sm font-bold tracking-tight text-slate-900 dark:text-white">
            {clock}
          </span>
          <span className="text-[11px] font-semibold tracking-tight text-slate-500 dark:text-slate-400">
            MotoRide
          </span>
        </div>

        <nav className="flex flex-col items-center gap-3 w-full">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectView(item.id)}
                aria-label={item.label}
                aria-current={active ? 'page' : undefined}
                className={`relative w-full min-h-[56px] rounded-xl flex flex-col items-center justify-center gap-1 transition-colors focus-visible:outline-2 focus-visible:outline-orange-500 ${
                  active
                    ? 'bg-orange-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/80 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Icon className="w-6 h-6" strokeWidth={2.1} />
                <span className="text-[11px] font-semibold whitespace-nowrap">
                  {item.label}
                </span>
                {item.badge && !active && (
                  <span className="sr-only">Active route</span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="flex flex-col items-center gap-2 w-full">
          <button
            type="button"
            onClick={onToggleVoice}
            aria-label={
              voiceEnabled ? 'Mute helmet voice prompts' : 'Enable helmet voice prompts'
            }
            title={voiceEnabled ? 'Voice Prompts On' : 'Voice Prompts Muted'}
            className={`w-full min-h-[48px] rounded-xl flex items-center justify-center transition-colors focus-visible:outline-2 focus-visible:outline-orange-500 ${
              voiceEnabled
                ? 'bg-slate-200/80 dark:bg-white/10 text-orange-600 dark:text-orange-400'
                : 'text-slate-500 dark:text-slate-500 hover:bg-slate-200/60 dark:hover:bg-white/5'
            }`}
          >
            {voiceEnabled ? (
              <Volume2 className="w-5 h-5" />
            ) : (
              <VolumeX className="w-5 h-5" />
            )}
          </button>

          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={isDark ? 'Switch to daylight mode' : 'Switch to night cockpit'}
            title={isDark ? 'Daylight Mode' : 'Night Cockpit'}
            className="w-full min-h-[48px] rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-200/80 dark:hover:bg-white/10 transition-colors focus-visible:outline-2 focus-visible:outline-orange-500"
          >
            {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>
      </aside>

      {/* Mobile Portrait Bottom Navigation Bar (<= 15% viewport height) */}
      <nav
        aria-label="Mobile Cockpit Navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-30 h-16 grid grid-cols-4 items-center border-t border-slate-200 dark:border-white/10 bg-white/95 dark:bg-[#0B0E13]/95 backdrop-blur-md px-2 select-none"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = activeView === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectView(item.id)}
              aria-current={active ? 'page' : undefined}
              className={`min-h-[48px] rounded-xl flex flex-col items-center justify-center gap-0.5 transition-colors ${
                active
                  ? 'text-orange-600 dark:text-orange-400 font-semibold'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <Icon className="w-5 h-5" strokeWidth={active ? 2.4 : 2} />
              <span className="text-[11px] whitespace-nowrap">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
}
