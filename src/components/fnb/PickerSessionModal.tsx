import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { User, Clock } from 'lucide-react';

interface PickerSessionModalProps {
  open: boolean;
  onSessionStart: (pickerName: string) => void;
  onClose?: () => void;
}

const RECENT_PICKERS_KEY = 'fnb_recent_pickers';
const MAX_RECENT_PICKERS = 5;

export function PickerSessionModal({ open, onSessionStart, onClose }: PickerSessionModalProps) {
  const [name, setName] = useState('');
  const [recentPickers, setRecentPickers] = useState<string[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem(RECENT_PICKERS_KEY);
    if (stored) {
      try {
        setRecentPickers(JSON.parse(stored));
      } catch {
        setRecentPickers([]);
      }
    }
  }, []);

  const handleStart = () => {
    if (!name.trim()) return;
    
    // Update recent pickers
    const updated = [name.trim(), ...recentPickers.filter(p => p !== name.trim())].slice(0, MAX_RECENT_PICKERS);
    localStorage.setItem(RECENT_PICKERS_KEY, JSON.stringify(updated));
    
    onSessionStart(name.trim());
  };

  const handleQuickSelect = (pickerName: string) => {
    setName(pickerName);
    
    // Update recent pickers (move to top)
    const updated = [pickerName, ...recentPickers.filter(p => p !== pickerName)].slice(0, MAX_RECENT_PICKERS);
    localStorage.setItem(RECENT_PICKERS_KEY, JSON.stringify(updated));
    
    onSessionStart(pickerName);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen && onClose) {
        onClose();
      }
    }}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <User className="h-6 w-6" />
            Start Picking Session
          </DialogTitle>
          <DialogDescription>
            Enter your name to begin picking orders. Your performance will be tracked on the leaderboard.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Recent Pickers */}
          {recentPickers.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Quick Select
              </Label>
              <div className="flex flex-wrap gap-2">
                {recentPickers.map((picker) => (
                  <Button
                    key={picker}
                    variant="outline"
                    size="lg"
                    className="h-12 px-6 text-base"
                    onClick={() => handleQuickSelect(picker)}
                  >
                    {picker}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Manual Entry */}
          <div className="space-y-2">
            <Label htmlFor="picker-name">Or enter your name</Label>
            <Input
              id="picker-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name..."
              className="h-14 text-lg"
              autoFocus={recentPickers.length === 0}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleStart();
              }}
            />
          </div>

          <Button
            onClick={handleStart}
            disabled={!name.trim()}
            className="w-full h-14 text-lg"
          >
            <User className="mr-2 h-5 w-5" />
            Start Session
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
