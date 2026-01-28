import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Download, X, Share, Plus, Bot, Smartphone } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'dre-install-banner-dismissed';
const DISMISS_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

export function DreInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);

  useEffect(() => {
    // Check if already installed (standalone mode)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    if (isStandalone) return;

    // Check if dismissed recently
    const dismissedAt = localStorage.getItem(DISMISS_KEY);
    if (dismissedAt && Date.now() - parseInt(dismissedAt) < DISMISS_DURATION) return;

    // Detect iOS
    const isIOSDevice = /iPhone|iPad|iPod/.test(navigator.userAgent);
    setIsIOS(isIOSDevice);

    // Only show on mobile
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (!isMobile) return;

    // For iOS, show banner immediately
    if (isIOSDevice) {
      setIsVisible(true);
      return;
    }

    // Listen for install prompt (Android/Chrome)
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // Listen for app installed
    window.addEventListener('appinstalled', () => {
      setIsVisible(false);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setIsVisible(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-3 safe-area-bottom">
      <div className={cn(
        "bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg p-4 mx-auto max-w-md text-white",
        "animate-in slide-in-from-bottom-4 duration-300"
      )}>
        <button 
          onClick={handleDismiss}
          className="absolute top-2 right-2 p-1 text-white/70 hover:text-white"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>

        {showIOSInstructions ? (
          <div className="space-y-3 pr-6">
            <p className="font-semibold text-sm">Add Dre to Home Screen:</p>
            <div className="flex items-center gap-2 text-sm">
              <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">1</div>
              <span>Tap <Share className="inline h-4 w-4 mx-1" /> Share at bottom</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">2</div>
              <span>Scroll & tap <Plus className="inline h-4 w-4 mx-1" /> Add to Home Screen</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">3</div>
              <span>Tap "Add" to confirm</span>
            </div>
            <Button 
              size="sm" 
              variant="secondary" 
              onClick={() => setShowIOSInstructions(false)} 
              className="w-full mt-2 bg-white/20 hover:bg-white/30 text-white border-0"
            >
              Got it
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-3 pr-6">
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
              <Bot className="h-7 w-7 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">Install Dre App</p>
              <p className="text-xs text-white/80 truncate">Add to home screen for quick access</p>
            </div>
            {isIOS ? (
              <Button 
                size="sm" 
                onClick={() => setShowIOSInstructions(true)}
                className="bg-white text-green-600 hover:bg-white/90"
              >
                <Smartphone className="h-4 w-4 mr-1" />
                Install
              </Button>
            ) : deferredPrompt ? (
              <Button 
                size="sm" 
                onClick={handleInstall}
                className="bg-white text-green-600 hover:bg-white/90"
              >
                <Download className="h-4 w-4 mr-1" />
                Install
              </Button>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

export default DreInstallBanner;
