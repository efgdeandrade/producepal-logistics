import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ArrowLeft, Mail, CheckCircle, AlertCircle, RefreshCw, Unplug, Loader2, Clock, ShieldAlert, Activity } from 'lucide-react';
import { toast } from 'sonner';
import { useGmailCredentials } from '@/hooks/useGmailCredentials';
import { supabase } from '@/integrations/supabase/client';
import { format, differenceInDays, differenceInHours, formatDistanceToNow } from 'date-fns';

export default function GmailSettings() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { credential, loading: gmailLoading, isConnected, isTokenExpired, connect, disconnect, refreshStatus } = useGmailCredentials();
  const [disconnecting, setDisconnecting] = useState(false);
  const [renewingWatch, setRenewingWatch] = useState(false);
  const [runningHealthCheck, setRunningHealthCheck] = useState(false);

  // Query for extended credential info (needs_reauth, last_sync_at, last_error)
  const { data: extendedCredential, refetch: refetchExtended } = useQuery({
    queryKey: ['gmail-credential-extended', credential?.id],
    queryFn: async () => {
      if (!credential?.id) return null;
      const { data, error } = await supabase
        .from('gmail_credentials')
        .select('needs_reauth, last_sync_at, last_error')
        .eq('id', credential.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!credential?.id,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Handle OAuth callback result
  useEffect(() => {
    const gmailStatus = searchParams.get('gmail');
    if (gmailStatus === 'connected') {
      toast.success('Gmail connected successfully!');
      setSearchParams({});
      refreshStatus();
      refetchExtended();
    } else if (gmailStatus === 'error') {
      const errorMsg = searchParams.get('error') || 'Failed to connect Gmail';
      toast.error(errorMsg);
      setSearchParams({});
    }
  }, [searchParams, setSearchParams, refreshStatus, refetchExtended]);

  const handleDisconnectGmail = async () => {
    setDisconnecting(true);
    await disconnect();
    setDisconnecting(false);
  };

  const handleRenewWatch = async () => {
    if (!credential?.id) return;
    
    setRenewingWatch(true);
    try {
      const { data, error } = await supabase.functions.invoke('gmail-renew-watch', {
        body: { credentialId: credential.id },
      });
      
      if (error) throw error;
      
      toast.success('Gmail watch renewed successfully!');
      refreshStatus();
      refetchExtended();
    } catch (err) {
      console.error('Failed to renew watch:', err);
      toast.error('Failed to renew Gmail watch');
    } finally {
      setRenewingWatch(false);
    }
  };

  const handleRunHealthCheck = async () => {
    setRunningHealthCheck(true);
    try {
      const { data, error } = await supabase.functions.invoke('gmail-health-monitor');
      
      if (error) throw error;
      
      if (data?.results?.[0]?.healthy) {
        toast.success('Gmail connection is healthy!');
      } else if (data?.results?.[0]?.needsReauth) {
        toast.error('Gmail requires re-authentication', {
          description: 'Click Reconnect to fix this issue',
        });
      } else {
        toast.warning('Gmail health check found issues', {
          description: data?.results?.[0]?.issues?.join(', ') || 'Unknown issues',
        });
      }
      
      refreshStatus();
      refetchExtended();
    } catch (err) {
      console.error('Failed to run health check:', err);
      toast.error('Failed to run health check');
    } finally {
      setRunningHealthCheck(false);
    }
  };

  // Calculate watch expiration info
  const watchExpirationInfo = credential?.watch_expiration ? (() => {
    const expiration = new Date(credential.watch_expiration);
    const now = new Date();
    const daysUntil = differenceInDays(expiration, now);
    const hoursUntil = differenceInHours(expiration, now);
    
    return {
      expiration,
      daysUntil,
      hoursUntil,
      isExpiringSoon: daysUntil <= 2,
      isExpired: expiration < now,
    };
  })() : null;

  const needsReauth = extendedCredential?.needs_reauth;
  const lastSyncAt = extendedCredential?.last_sync_at;
  const lastError = extendedCredential?.last_error;

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/admin/integrations')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Gmail Integration</h1>
          <p className="text-muted-foreground">
            Receive customer orders via email and send confirmations
          </p>
        </div>
      </div>

      {/* Reauth Required Alert */}
      {needsReauth && (
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Re-authentication Required</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>
              Your Gmail connection has expired due to a security policy. This can happen when:
            </p>
            <ul className="list-disc ml-4 text-sm">
              <li>Your Google Workspace admin requires periodic re-authentication</li>
              <li>Your password was changed</li>
              <li>A security event was triggered</li>
            </ul>
            <p className="font-medium mt-2">
              Click "Reconnect" below to restore email sync.
            </p>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-red-500" />
            Connection Status
          </CardTitle>
          <CardDescription>
            Connect your Gmail account to receive order emails automatically
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {gmailLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : isConnected ? (
            <div className="space-y-4">
              <div className={`flex items-center justify-between p-4 rounded-lg border ${
                needsReauth 
                  ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800'
                  : 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800'
              }`}>
                <div className="flex items-center gap-3">
                  {needsReauth ? (
                    <AlertCircle className="h-5 w-5 text-red-600" />
                  ) : (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  )}
                  <div>
                    <p className="font-medium">{needsReauth ? 'Needs Reconnection' : 'Connected'}</p>
                    <p className="text-sm text-muted-foreground">
                      {credential?.email_address}
                    </p>
                  </div>
                </div>
                <Badge variant="secondary" className={
                  needsReauth 
                    ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                    : "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                }>
                  {needsReauth ? 'Auth Expired' : 'Active'}
                </Badge>
              </div>

              {/* Last Sync Info */}
              {lastSyncAt && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Activity className="h-4 w-4" />
                  <span>Last synced: {formatDistanceToNow(new Date(lastSyncAt), { addSuffix: true })}</span>
                </div>
              )}

              {/* Last Error */}
              {lastError && !needsReauth && (
                <Alert variant="destructive" className="py-2">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    {lastError}
                  </AlertDescription>
                </Alert>
              )}

              {watchExpirationInfo && (
                <div className="p-3 bg-muted/50 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Email Watch Status</span>
                    </div>
                    {watchExpirationInfo.isExpired ? (
                      <Badge variant="destructive">Expired</Badge>
                    ) : watchExpirationInfo.isExpiringSoon ? (
                      <Badge variant="secondary" className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300">
                        Expiring Soon
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                        Active
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {watchExpirationInfo.isExpired 
                        ? `Expired ${format(watchExpirationInfo.expiration, 'PPP')}`
                        : watchExpirationInfo.daysUntil > 0 
                          ? `Expires in ${watchExpirationInfo.daysUntil} day${watchExpirationInfo.daysUntil !== 1 ? 's' : ''}`
                          : `Expires in ${watchExpirationInfo.hoursUntil} hour${watchExpirationInfo.hoursUntil !== 1 ? 's' : ''}`
                      }
                    </span>
                    <Button
                      size="sm"
                      variant={watchExpirationInfo.isExpired || watchExpirationInfo.isExpiringSoon ? "default" : "outline"}
                      onClick={handleRenewWatch}
                      disabled={renewingWatch}
                    >
                      {renewingWatch ? (
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3 w-3 mr-1" />
                      )}
                      Renew Watch
                    </Button>
                  </div>
                  {(watchExpirationInfo.isExpired || watchExpirationInfo.isExpiringSoon) && (
                    <p className="text-xs text-muted-foreground">
                      {watchExpirationInfo.isExpired 
                        ? "The email watch has expired. Click 'Renew Watch' to resume receiving emails."
                        : "The email watch is expiring soon. Consider renewing it to ensure uninterrupted email reception."
                      }
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground border-t pt-2 mt-2">
                    ✓ Watch renewals are automated daily. Manual renewal is only needed if automation fails.
                  </p>
                </div>
              )}

              {isTokenExpired && !needsReauth && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Token Expired</AlertTitle>
                  <AlertDescription>
                    Your Gmail access token has expired. Please reconnect to continue receiving emails.
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex gap-2">
                <Button 
                  variant={needsReauth ? "default" : "outline"} 
                  onClick={connect} 
                  className="flex-1"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Reconnect
                </Button>
                <Button 
                  variant="destructive" 
                  onClick={handleDisconnectGmail}
                  disabled={disconnecting}
                  className="flex-1"
                >
                  {disconnecting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Unplug className="h-4 w-4 mr-2" />
                  )}
                  Disconnect
                </Button>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleRunHealthCheck}
                disabled={runningHealthCheck}
                className="w-full"
              >
                {runningHealthCheck ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Activity className="h-4 w-4 mr-2" />
                )}
                Run Health Check
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Setup Required</AlertTitle>
                <AlertDescription>
                  To use Gmail integration, you need to:
                  <ol className="list-decimal ml-4 mt-2 space-y-1">
                    <li>Configure Google Cloud project with OAuth credentials</li>
                    <li>Set up Google Pub/Sub topic for email notifications</li>
                    <li>Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET secrets</li>
                    <li>Connect your Gmail account below</li>
                  </ol>
                </AlertDescription>
              </Alert>

              <Button onClick={connect} className="w-full">
                <Mail className="h-4 w-4 mr-2" />
                Connect Gmail Account
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Automation Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Automation Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <span>Push notifications enabled - emails arrive in real-time</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <span>Daily watch renewal scheduled - no manual intervention needed</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <span>Health monitoring active - issues detected automatically</span>
          </div>
          <p className="text-muted-foreground pt-2 border-t">
            <strong>Note:</strong> Google Workspace security policies may occasionally require re-authentication. 
            If this happens, you'll see an alert here and in the Email Inbox.
          </p>
        </CardContent>
      </Card>

      {/* Usage Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>How It Works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Once connected, incoming emails to your Gmail account will be automatically processed for customer orders.
          </p>
          <ul className="list-disc ml-4 space-y-1">
            <li>Orders from known customers are parsed and created automatically</li>
            <li>Unknown senders or unclear orders are queued for manual review</li>
            <li>View incoming emails in the <Button variant="link" className="p-0 h-auto" onClick={() => navigate('/distribution/email-inbox')}>Email Inbox</Button></li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
