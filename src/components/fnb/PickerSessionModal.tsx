import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { User, Clock, CheckCircle, Package } from 'lucide-react';

interface PickerSessionModalProps {
  open: boolean;
  onSessionStart: (pickerName: string) => void;
  onClose?: () => void;
  previousPickerStats?: {
    name: string;
    ordersCompleted: number;
    sessionDuration: string;
  } | null;
}

const RECENT_PICKERS_KEY = 'fnb_recent_pickers';
const MAX_RECENT_PICKERS = 6;

export function PickerSessionModal({ 
  open, 
  onSessionStart, 
  onClose,
  previousPickerStats 
}: PickerSessionModalProps) {
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
      <DialogContent className="sm:max-w-lg" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <User className="h-6 w-6" />
            {previousPickerStats ? 'Switch Picker' : 'Start Picking Session'}
          </DialogTitle>
          <DialogDescription>
            {previousPickerStats 
              ? 'Select the next picker to continue working on orders.'
              : 'Enter your name to begin picking orders. Your performance will be tracked on the leaderboard.'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Previous Session Summary */}
          {previousPickerStats && (
            <div className="bg-muted/50 rounded-lg p-4 border">
              <div className="flex items-center gap-2 text-sm font-medium mb-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                Previous Session: {previousPickerStats.name}
              </div>
              <div className="flex gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Package className="h-3.5 w-3.5" />
                  {previousPickerStats.ordersCompleted} orders
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {previousPickerStats.sessionDuration}
                </span>
              </div>
            </div>
          )}

          {/* Quick Select - Prominent Grid */}
          {recentPickers.length > 0 && (
            <div className="space-y-3">
              <Label className="text-sm text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Quick Select - Tap Your Name
              </Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {recentPickers.map((picker) => (
                  <Button
                    key={picker}
                    variant="outline"
                    className="h-16 text-lg font-medium hover:bg-primary hover:text-primary-foreground transition-colors"
                    onClick={() => handleQuickSelect(picker)}
                  >
                    <User className="h-5 w-5 mr-2 opacity-70" />
                    {picker}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Manual Entry */}
          <div className="space-y-2">
            <Label htmlFor="picker-name" className="text-sm text-muted-foreground">
              {recentPickers.length > 0 ? 'Or enter a new name' : 'Enter your name'}
            </Label>
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
