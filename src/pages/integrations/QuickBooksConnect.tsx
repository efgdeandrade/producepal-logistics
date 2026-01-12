import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ArrowLeft, Link as LinkIcon, CheckCircle, XCircle, RefreshCw, ExternalLink, AlertCircle } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';

interface TokenInfo {
  realm_id: string;
  expires_at: string;
  updated_at: string;
}

const QuickBooksConnect = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    loadConnectionStatus();
    
    // Check for success/error in URL params
    const connected = searchParams.get('connected');
    const error = searchParams.get('error');
    
    if (connected === 'true') {
      toast({
        title: 'Connected to QuickBooks',
        description: 'Your QuickBooks account has been successfully linked.',
      });
      // Clean up URL
      navigate('/settings/integrations/quickbooks/connect', { replace: true });
      loadConnectionStatus();
    }
    
    if (error) {
      toast({
        title: 'Connection Failed',
        description: decodeURIComponent(error),
        variant: 'destructive',
      });
      navigate('/settings/integrations/quickbooks/connect', { replace: true });
    }
  }, [searchParams, toast, navigate]);

  const loadConnectionStatus = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('quickbooks_tokens')
        .select('realm_id, expires_at, updated_at')
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      setTokenInfo(data);
    } catch (error: any) {
      console.error('Failed to load connection status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    setConnecting(true);
    
    try {
      // Call the secure edge function to get the OAuth URL
      const { data, error } = await supabase.functions.invoke('quickbooks-oauth-init');
      
      if (error) {
        throw new Error(error.message || 'Failed to initiate connection');
      }
      
      if (!data?.authUrl) {
        throw new Error('No authorization URL received from server');
      }
      
      // Redirect to QuickBooks authorization
      window.location.href = data.authUrl;
    } catch (error: any) {
      console.error('Failed to connect to QuickBooks:', error);
      toast({
        title: 'Connection Failed',
        description: error.message || 'Failed to initiate QuickBooks connection. Please try again.',
        variant: 'destructive',
      });
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect from QuickBooks? You will need to reconnect to sync invoices.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('quickbooks_tokens')
        .delete()
        .neq('realm_id', '');

      if (error) throw error;

      toast({
        title: 'Disconnected',
        description: 'QuickBooks has been disconnected.',
      });
      
      setTokenInfo(null);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const isConnected = !!tokenInfo;
  const isExpired = tokenInfo && new Date(tokenInfo.expires_at) < new Date();

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/settings/integrations/quickbooks')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <LinkIcon className="h-6 w-6 text-green-500" />
            Connect QuickBooks
          </h1>
          <p className="text-muted-foreground">Link your QuickBooks account to sync invoices</p>
        </div>
      </div>

      {/* Connection Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Connection Status
            {loading ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : isConnected ? (
              isExpired ? (
                <Badge variant="destructive">Token Expired</Badge>
              ) : (
                <Badge variant="default" className="bg-green-500">Connected</Badge>
              )
            ) : (
              <Badge variant="secondary">Not Connected</Badge>
            )}
          </CardTitle>
          <CardDescription>
            {isConnected 
              ? 'Your QuickBooks account is linked'
              : 'Connect your QuickBooks account to enable invoice sync'
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isConnected ? (
            <>
              <div className="grid gap-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Company ID (Realm)</span>
                  <code className="text-sm bg-muted px-2 py-1 rounded">{tokenInfo.realm_id}</code>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Token Expires</span>
                  <span className={`text-sm ${isExpired ? 'text-destructive' : ''}`}>
                    {format(new Date(tokenInfo.expires_at), 'MMM d, yyyy h:mm a')}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Last Updated</span>
                  <span className="text-sm">
                    {format(new Date(tokenInfo.updated_at), 'MMM d, yyyy h:mm a')}
                  </span>
                </div>
              </div>

              {isExpired && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Token Expired</AlertTitle>
                  <AlertDescription>
                    Your QuickBooks access has expired. Please reconnect to continue syncing invoices.
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex gap-2">
                <Button onClick={handleConnect} variant={isExpired ? 'default' : 'outline'}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  {isExpired ? 'Reconnect' : 'Refresh Connection'}
                </Button>
                <Button variant="destructive" onClick={handleDisconnect}>
                  <XCircle className="h-4 w-4 mr-2" />
                  Disconnect
                </Button>
              </div>
            </>
          ) : (
            <>
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertTitle>Ready to Connect</AlertTitle>
                <AlertDescription>
                  Click the button below to connect your QuickBooks account. You'll be redirected to Intuit to authorize access.
                </AlertDescription>
              </Alert>

              <Button 
                size="lg" 
                onClick={handleConnect}
                disabled={connecting}
                className="w-full"
              >
                {connecting ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <ExternalLink className="h-4 w-4 mr-2" />
                )}
                Connect to QuickBooks
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Setup Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Setup Instructions</CardTitle>
          <CardDescription>Steps to connect your QuickBooks account</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
                1
              </div>
              <div>
                <p className="font-medium">Click "Connect to QuickBooks"</p>
                <p className="text-sm text-muted-foreground">
                  You'll be redirected to Intuit's secure login page
                </p>
              </div>
            </div>
            
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
                2
              </div>
              <div>
                <p className="font-medium">Sign in to QuickBooks</p>
                <p className="text-sm text-muted-foreground">
                  Use your QuickBooks Online credentials to log in
                </p>
              </div>
            </div>
            
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
                3
              </div>
              <div>
                <p className="font-medium">Authorize the Connection</p>
                <p className="text-sm text-muted-foreground">
                  Review the permissions and click "Connect" to authorize access
                </p>
              </div>
            </div>
            
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
                4
              </div>
              <div>
                <p className="font-medium">Start Syncing</p>
                <p className="text-sm text-muted-foreground">
                  Once connected, you can sync invoices from the QuickBooks Integration page
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Troubleshooting */}
      <Card>
        <CardHeader>
          <CardTitle>Troubleshooting</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <p className="font-medium">Connection fails with "redirect_uri mismatch"</p>
            <p className="text-muted-foreground">
              Ensure the Redirect URI in your Intuit Developer Portal exactly matches:
              <code className="block mt-1 bg-muted px-2 py-1 rounded text-xs break-all">
                {import.meta.env.VITE_SUPABASE_URL}/functions/v1/quickbooks-oauth-callback
              </code>
            </p>
          </div>
          
          <div>
            <p className="font-medium">Token expires quickly</p>
            <p className="text-muted-foreground">
              QuickBooks access tokens expire after 1 hour, but refresh tokens are valid for 100 days. 
              The system will automatically refresh tokens when syncing invoices.
            </p>
          </div>

          <div>
            <p className="font-medium">Need to use a different QuickBooks company?</p>
            <p className="text-muted-foreground">
              Disconnect the current account and reconnect with a different QuickBooks login.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default QuickBooksConnect;
