import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

export function useRealtimeUpdates(tables: string[], queryKeys: string[][]) {
  const queryClient = useQueryClient();
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    const channels = tables.map((table, index) => {
      return supabase
        .channel(`realtime-${table}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: table,
          },
          () => {
            setLastUpdate(new Date());
            // Invalidate associated query keys
            queryKeys[index]?.forEach((key) => {
              queryClient.invalidateQueries({ queryKey: [key] });
            });
          }
        )
        .subscribe();
    });

    return () => {
      channels.forEach((channel) => {
        supabase.removeChannel(channel);
      });
    };
  }, [tables.join(","), queryClient]);

  return { lastUpdate };
}

// Hook specifically for executive dashboard
export function useExecutiveDashboardRealtime() {
  return useRealtimeUpdates(
    ["fnb_orders", "time_entries"],
    [
      ["executive-dashboard-stats", "department-health"],
      ["executive-dashboard-stats", "hr-dashboard-stats"],
    ]
  );
}
