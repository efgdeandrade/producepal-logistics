import { Link } from 'react-router-dom';
import { MessageSquarePlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { vibrateTap } from '@/utils/whatsappUtils';

interface QuickOrderFABProps {
  className?: string;
}

/**
 * Floating Action Button for Quick Order entry
 * Shows on mobile devices for fast WhatsApp order paste
 */
export function QuickOrderFAB({ className }: QuickOrderFABProps) {
  const isMobile = useIsMobile();
  
  // Only show on mobile
  if (!isMobile) {
    return null;
  }
  
  return (
    <Link
      to="/quick-paste?auto=true"
      onClick={() => vibrateTap()}
      className={cn(
        // Position - bottom right, above bottom nav
        'fixed bottom-20 right-4 z-40',
        // Size and shape
        'w-14 h-14 rounded-full',
        // Colors
        'bg-primary text-primary-foreground',
        // Shadow and depth
        'shadow-lg shadow-primary/25',
        // Flexbox centering
        'flex items-center justify-center',
        // Touch optimization
        'touch-manipulation active:scale-95 transition-transform',
        // Animation
        'animate-in fade-in zoom-in duration-300',
        className
      )}
      aria-label="Quick Order from WhatsApp"
    >
      <MessageSquarePlus className="h-6 w-6" />
    </Link>
  );
}
