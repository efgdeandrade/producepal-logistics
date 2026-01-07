import { useState, useEffect } from "react";
import { format } from "date-fns";
import { History, CheckCircle, AlertCircle, XCircle, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { supabase } from "../../integrations/supabase/client";

interface AlertExecution {
  id: string;
  alert_rule_id: string;
  triggered_by: string;
  trigger_data: Record<string, any>;
  notifications_sent: number;
  status: string;
  error_message: string | null;
  created_at: string;
  alert_rules?: {
    name: string;
  };
}

export function AlertHistory() {
  const [executions, setExecutions] = useState<AlertExecution[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchExecutions = async () => {
      try {
        const { data, error } = await supabase
          .from("alert_executions")
          .select(`
            *,
            alert_rules (name)
          `)
          .order("created_at", { ascending: false })
          .limit(50);

        if (error) throw error;
        setExecutions((data || []) as AlertExecution[]);
      } catch (error) {
        console.error("Error fetching alert executions:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchExecutions();
  }, []);

  const statusConfig: Record<string, { icon: React.ElementType; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    success: { icon: CheckCircle, variant: "default" },
    partial: { icon: AlertCircle, variant: "secondary" },
    failed: { icon: XCircle, variant: "destructive" },
    pending: { icon: Loader2, variant: "outline" },
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Alert History
        </CardTitle>
      </CardHeader>
      <CardContent>
        {executions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <History className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p>No alert executions yet</p>
            <p className="text-sm">Alert history will appear here once rules are triggered</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rule</TableHead>
                <TableHead>Triggered By</TableHead>
                <TableHead>Notifications</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {executions.map((execution) => {
                const StatusIcon = statusConfig[execution.status]?.icon || AlertCircle;
                return (
                  <TableRow key={execution.id}>
                    <TableCell className="font-medium">
                      {execution.alert_rules?.name || "Unknown Rule"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {execution.triggered_by}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{execution.notifications_sent}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusConfig[execution.status]?.variant || "outline"}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {execution.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(execution.created_at), "MMM d, HH:mm")}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
