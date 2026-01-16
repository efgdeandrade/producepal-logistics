import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ArrowLeft, Mail, CheckCircle, AlertCircle, RefreshCw, Unplug, Loader2, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { useGmailCredentials } from '@/hooks/useGmailCredentials';
import { supabase } from '@/integrations/supabase/client';
import { format, differenceInDays, differenceInHours } from 'date-fns';

export default function GmailSettings() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { credential, loading: gmailLoading, isConnected, isTokenExpired, connect, disconnect, refreshStatus } = useGmailCredentials();
  const [disconnecting, setDisconnecting] = useState(false);
  const [renewingWatch, setRenewingWatch] = useState(false);

  // Handle OAuth callback result
  useEffect(() => {
    const gmailStatus = searchParams.get('gmail');
    if (gmailStatus === 'connected') {
      toast.success('Gmail connected successfully!');
      setSearchParams({});
      refreshStatus();
    } else if (gmailStatus === 'error') {
      const errorMsg = searchParams.get('error') || 'Failed to connect Gmail';
      toast.error(errorMsg);
      setSearchParams({});
    }
  }, [searchParams, setSearchParams, refreshStatus]);

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
    } catch (err) {
      console.error('Failed to renew watch:', err);
      toast.error('Failed to renew Gmail watch');
    } finally {
      setRenewingWatch(false);
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

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/settings/integrations')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Gmail Integration</h1>
          <p className="text-muted-foreground">
            Receive customer orders via email and send confirmations
          </p>
        </div>
      </div>

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
              <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="font-medium">Connected</p>
                    <p className="text-sm text-muted-foreground">
                      {credential?.email_address}
                    </p>
                  </div>
                </div>
                <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                  Active
                </Badge>
              </div>

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
                </div>
              )}

              {isTokenExpired && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Token Expired</AlertTitle>
                  <AlertDescription>
                    Your Gmail access token has expired. Please reconnect to continue receiving emails.
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex gap-2">
                <Button variant="outline" onClick={connect} className="flex-1">
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
