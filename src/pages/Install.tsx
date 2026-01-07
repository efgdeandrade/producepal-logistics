import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Smartphone, 
  Share, 
  Plus, 
  Download, 
  CheckCircle, 
  ArrowRight,
  MapPin,
  Wifi,
  Bell
} from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function Install() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if already installed
    const isInStandalone = window.matchMedia('(display-mode: standalone)').matches;
    setIsStandalone(isInStandalone);
    
    // Detect iOS
    const isIOSDevice = /iPhone|iPad|iPod/.test(navigator.userAgent);
    setIsIOS(isIOSDevice);

    // Listen for install prompt (Android/Chrome)
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // Listen for app installed
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
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
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  if (isStandalone || isInstalled) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <div className="w-20 h-20 mx-auto mb-4 bg-success/20 rounded-full flex items-center justify-center">
              <CheckCircle className="h-10 w-10 text-success" />
            </div>
            <h1 className="text-2xl font-bold mb-2">App Installed!</h1>
            <p className="text-muted-foreground mb-6">
              FUIK.IO is ready to use on your home screen.
            </p>
            <Button asChild className="w-full">
              <a href="/fnb/driver-mobile">
                Open Driver Portal
                <ArrowRight className="ml-2 h-4 w-4" />
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/10 to-background">
      {/* Hero */}
      <div className="px-6 pt-12 pb-8 text-center">
        <div className="w-24 h-24 mx-auto mb-6 bg-primary rounded-2xl flex items-center justify-center shadow-lg overflow-hidden">
          <img src="/logo.png" alt="FUIK" className="h-16 w-16 object-contain" />
        </div>
        <h1 className="text-3xl font-bold mb-2">FUIK.IO</h1>
        <p className="text-muted-foreground">
          Your mobile delivery companion
        </p>
      </div>

      {/* Features */}
      <div className="px-6 py-6 space-y-4">
        <Card>
          <CardContent className="flex items-center gap-4 py-4">
            <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center flex-shrink-0">
              <MapPin className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold">GPS Navigation</h3>
              <p className="text-sm text-muted-foreground">One-tap navigation to each stop</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 py-4">
            <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center flex-shrink-0">
              <Wifi className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold">Works Offline</h3>
              <p className="text-sm text-muted-foreground">Access orders even without internet</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 py-4">
            <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center flex-shrink-0">
              <Bell className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold">Instant Updates</h3>
              <p className="text-sm text-muted-foreground">Get new orders in real-time</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Install instructions */}
      <div className="px-6 py-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              Install App
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {deferredPrompt ? (
              // Android/Chrome install button
              <Button onClick={handleInstall} className="w-full h-14 text-lg">
                <Download className="h-5 w-5 mr-2" />
                Install Now
              </Button>
            ) : isIOS ? (
              // iOS instructions
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  To install on your iPhone:
                </p>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 text-sm font-bold">
                      1
                    </div>
                    <div>
                      <p className="font-medium">Tap the Share button</p>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Share className="h-4 w-4" /> at the bottom of Safari
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 text-sm font-bold">
                      2
                    </div>
                    <div>
                      <p className="font-medium">Scroll down and tap</p>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Plus className="h-4 w-4" /> "Add to Home Screen"
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 text-sm font-bold">
                      3
                    </div>
                    <div>
                      <p className="font-medium">Tap "Add"</p>
                      <p className="text-sm text-muted-foreground">
                        The app will appear on your home screen
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              // Generic instructions
              <div className="text-center py-4">
                <p className="text-muted-foreground mb-4">
                  Open this page in Chrome or Safari to install the app.
                </p>
                <Button variant="outline" asChild>
                  <a href="/fnb/driver-mobile">
                    Continue to Web App
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Skip to web */}
      <div className="px-6 pb-8 text-center">
        <Button variant="ghost" asChild>
          <a href="/fnb/driver-mobile">
            Skip, use web version
          </a>
        </Button>
      </div>
    </div>
  );
}
