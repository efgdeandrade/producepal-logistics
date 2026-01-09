import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface MobilePageWrapperProps {
  children: ReactNode;
  className?: string;
  /** Use fixed height (h-screen) instead of min-h-screen for full-screen layouts */
  fixedHeight?: boolean;
}

/**
 * A consistent wrapper for mobile-first pages that prevents horizontal overflow
 * and ensures proper viewport handling across all devices.
 */
export function MobilePageWrapper({ 
  children, 
  className,
  fixedHeight = false 
}: MobilePageWrapperProps) {
  return (
    <div 
      className={cn(
        "w-full max-w-full overflow-x-hidden bg-background flex flex-col",
        fixedHeight ? "h-screen" : "min-h-screen",
        className
      )}
    >
      {children}
    </div>
  );
}

export default MobilePageWrapper;
