import { useState, useEffect } from 'react';
import { format, getWeek } from 'date-fns';

export const HeaderClock = () => {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex items-center gap-2 md:gap-3 text-sm">
      <span className="hidden sm:inline font-medium text-foreground">
        {format(currentTime, 'EEE, MMM d')}
      </span>
      <span className="px-2 py-0.5 rounded bg-muted text-muted-foreground text-xs font-medium">
        W{getWeek(currentTime)}
      </span>
      <span className="font-mono text-foreground tabular-nums text-xs md:text-sm">
        {format(currentTime, 'HH:mm:ss')}
      </span>
    </div>
  );
};
