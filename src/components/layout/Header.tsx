import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { format, getWeek } from 'date-fns';
import { OfflineIndicator } from '@/components/OfflineIndicator';
import { NotificationCenter } from '@/components/notifications/NotificationCenter';

export const Header = () => {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
      <div className="container flex h-14 items-center justify-between px-4">
        {/* Left: Logo */}
        <Link to="/select-portal" className="flex items-center">
          <img 
            src="/logo.png" 
            alt="Logo" 
            className="h-8 w-auto min-w-[32px] object-contain" 
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/favicon.png';
            }}
          />
        </Link>

        {/* Center: Date, Week, Time */}
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-3">
            <span className="font-medium text-foreground">
              {format(currentTime, 'EEEE, MMM d')}
            </span>
            <span className="px-2 py-0.5 rounded bg-muted text-muted-foreground text-xs font-medium">
              W{getWeek(currentTime)}
            </span>
            <span className="font-mono text-foreground tabular-nums">
              {format(currentTime, 'HH:mm:ss')}
            </span>
          </div>
        </div>

        {/* Right: Offline indicator + Notifications */}
        <div className="flex items-center gap-2">
          <OfflineIndicator />
          <NotificationCenter />
        </div>
      </div>
    </header>
  );
};
