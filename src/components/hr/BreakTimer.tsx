import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Coffee, Play, Pause } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface BreakTimerProps {
  timeEntryId: string;
  breakMinutes: number | null;
  isOnBreak: boolean;
  breakStartedAt: string | null;
  onBreakChange?: (isOnBreak: boolean) => void;
}

export function BreakTimer({ 
  timeEntryId, 
  breakMinutes = 0, 
  isOnBreak,
  breakStartedAt,
  onBreakChange 
}: BreakTimerProps) {
  const queryClient = useQueryClient();
  const [elapsedBreakSeconds, setElapsedBreakSeconds] = useState(0);

  // Calculate elapsed break time if currently on break
  useEffect(() => {
    if (isOnBreak && breakStartedAt) {
      const startTime = new Date(breakStartedAt).getTime();
      
      const interval = setInterval(() => {
        const now = Date.now();
        const elapsed = Math.floor((now - startTime) / 1000);
        setElapsedBreakSeconds(elapsed);
      }, 1000);

      return () => clearInterval(interval);
    } else {
      setElapsedBreakSeconds(0);
    }
  }, [isOnBreak, breakStartedAt]);

  const startBreakMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("time_entries")
        .update({ 
          break_started_at: new Date().toISOString() 
        } as any)
        .eq("id", timeEntryId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["active-clock-in"] });
      onBreakChange?.(true);
      toast.success("Break started");
    },
    onError: (error) => {
      toast.error("Failed to start break: " + error.message);
    }
  });

  const endBreakMutation = useMutation({
    mutationFn: async () => {
      if (!breakStartedAt) throw new Error("No break start time");
      
      const startTime = new Date(breakStartedAt).getTime();
      const now = Date.now();
      const additionalMinutes = Math.floor((now - startTime) / 60000);
      const newBreakMinutes = (breakMinutes || 0) + additionalMinutes;

      const { error } = await supabase
        .from("time_entries")
        .update({ 
          break_minutes: newBreakMinutes,
          break_started_at: null
        } as any)
        .eq("id", timeEntryId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["active-clock-in"] });
      onBreakChange?.(false);
      toast.success("Break ended");
    },
    onError: (error) => {
      toast.error("Failed to end break: " + error.message);
    }
  });

  const formatTime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    }
    return `${minutes}m ${seconds}s`;
  };

  const totalBreakMinutes = (breakMinutes || 0) + Math.floor(elapsedBreakSeconds / 60);

  return (
    <div className="flex items-center gap-3">
      {isOnBreak ? (
        <>
          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800">
            <Coffee className="h-3 w-3 mr-1 animate-pulse" />
            On Break: {formatTime(elapsedBreakSeconds)}
          </Badge>
          <Button 
            size="sm" 
            variant="outline"
            onClick={() => endBreakMutation.mutate()}
            disabled={endBreakMutation.isPending}
          >
            <Play className="h-3 w-3 mr-1" />
            Resume
          </Button>
        </>
      ) : (
        <>
          {totalBreakMinutes > 0 && (
            <span className="text-xs text-muted-foreground">
              Total break: {totalBreakMinutes}m
            </span>
          )}
          <Button 
            size="sm" 
            variant="ghost"
            onClick={() => startBreakMutation.mutate()}
            disabled={startBreakMutation.isPending}
          >
            <Pause className="h-3 w-3 mr-1" />
            Take Break
          </Button>
        </>
      )}
    </div>
  );
}
