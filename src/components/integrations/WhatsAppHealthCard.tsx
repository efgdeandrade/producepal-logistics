import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useWhatsAppHealth, useWhatsAppHealthHistory } from '@/hooks/useWhatsAppHealth';
import { Activity, AlertTriangle, CheckCircle, RefreshCw, XCircle } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useState } from 'react';
import { toast } from '@/hooks/use-toast';

export function WhatsAppHealthCard() {
  const { data: latestCheck, refetch, isLoading } = useWhatsAppHealth();
  const { data: history } = useWhatsAppHealthHistory(12);
  const [isChecking, setIsChecking] = useState(false);

  const runManualCheck = async () => {
    setIsChecking(true);
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-health-monitor');
      
      if (error) throw error;
      
      toast({
        title: data?.result?.status === 'healthy' ? '✓ WhatsApp API Healthy' : '⚠️ WhatsApp API Issue',
        description: data?.result?.status === 'healthy' 
          ? `Response time: ${data.result.response_time_ms}ms`
          : data?.result?.error_message || 'Check failed',
      });
      
      refetch();
    } catch (error) {
      console.error('Manual check failed:', error);
      toast({
        title: 'Check Failed',
        description: 'Could not run health check',
        variant: 'destructive',
      });
    } finally {
      setIsChecking(false);
    }
  };

  const getStatusIcon = (status: string | undefined) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'degraded':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Activity className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string | undefined) => {
    switch (status) {
      case 'healthy':
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Healthy</Badge>;
      case 'degraded':
        return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">Degraded</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  // Calculate uptime percentage from history
  const uptimePercentage = history?.length 
    ? Math.round((history.filter(h => h.status === 'healthy').length / history.length) * 100)
    : null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-green-500" />
            <CardTitle className="text-lg">WhatsApp API Health</CardTitle>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={runManualCheck}
            disabled={isChecking}
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${isChecking ? 'animate-spin' : ''}`} />
            Check Now
          </Button>
        </div>
        <CardDescription>
          Automated monitoring every 15 minutes
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="animate-pulse space-y-2">
            <div className="h-8 bg-muted rounded" />
            <div className="h-4 bg-muted rounded w-3/4" />
          </div>
        ) : latestCheck ? (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {getStatusIcon(latestCheck.status)}
                <span className="font-medium">Current Status:</span>
                {getStatusBadge(latestCheck.status)}
              </div>
              {latestCheck.response_time_ms && (
                <span className="text-sm text-muted-foreground">
                  {latestCheck.response_time_ms}ms
                </span>
              )}
            </div>

            {latestCheck.token_valid !== null && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Token Status:</span>
                {latestCheck.token_valid ? (
                  <Badge variant="outline" className="border-green-500 text-green-600">Valid</Badge>
                ) : (
                  <Badge variant="destructive">Invalid - Update Required</Badge>
                )}
              </div>
            )}

            {latestCheck.error_message && (
              <div className="p-3 bg-destructive/10 rounded-lg border border-destructive/20">
                <p className="text-sm text-destructive font-medium">Error Details</p>
                <p className="text-sm text-destructive/80">{latestCheck.error_message}</p>
                {latestCheck.error_code && (
                  <code className="text-xs text-muted-foreground">Code: {latestCheck.error_code}</code>
                )}
              </div>
            )}

            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Last checked: {formatDistanceToNow(new Date(latestCheck.created_at), { addSuffix: true })}</span>
              {uptimePercentage !== null && (
                <span>Uptime (last 3h): {uptimePercentage}%</span>
              )}
            </div>

            {/* Mini status history */}
            {history && history.length > 1 && (
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground mb-2">Recent Checks</p>
                <div className="flex gap-1">
                  {history.slice(0, 12).reverse().map((check) => (
                    <div
                      key={check.id}
                      className={`h-6 w-2 rounded-sm ${
                        check.status === 'healthy' 
                          ? 'bg-green-500' 
                          : check.status === 'degraded' 
                            ? 'bg-yellow-500' 
                            : 'bg-red-500'
                      }`}
                      title={`${check.status} - ${format(new Date(check.created_at), 'MMM d, HH:mm')}`}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-4 text-muted-foreground">
            <p>No health checks recorded yet.</p>
            <p className="text-sm">Click "Check Now" to run the first check.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
