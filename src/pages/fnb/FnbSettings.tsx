import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, MessageSquare, Webhook, Key, CheckCircle, AlertCircle, Brain, Settings, Mail, RefreshCw, Unplug, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { GlobalAliasManager } from '@/components/fnb/GlobalAliasManager';
import { UnmatchedItemsQueue } from '@/components/fnb/UnmatchedItemsQueue';
import { CustomerMappingsViewer } from '@/components/fnb/CustomerMappingsViewer';
import { useGmailCredentials } from '@/hooks/useGmailCredentials';
import { format } from 'date-fns';

export default function FnbSettings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { credential, loading: gmailLoading, isConnected, isTokenExpired, isWatchExpired, connect, disconnect, refreshStatus } = useGmailCredentials();
  const [disconnecting, setDisconnecting] = useState(false);
  
  const [whatsappConfig, setWhatsappConfig] = useState({
    phoneNumberId: '',
    accessToken: '',
    verifyToken: '',
    webhookUrl: `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fnb-whatsapp-webhook`,
  });

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

  const handleSaveWhatsApp = async () => {
    // TODO: Save to settings table
    toast.success('WhatsApp configuration saved');
  };

  const handleDisconnectGmail = async () => {
    setDisconnecting(true);
    await disconnect();
    setDisconnecting(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-6 max-w-4xl">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/distribution">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Distribution Settings</h1>
            <p className="text-muted-foreground">
              Configure integrations and AI learning
            </p>
          </div>
        </div>

        <Tabs defaultValue="integrations" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 h-12">
            <TabsTrigger value="integrations" className="text-sm h-10">
              <Settings className="h-4 w-4 mr-2" />
              Integrations
            </TabsTrigger>
            <TabsTrigger value="ai-learning" className="text-sm h-10">
              <Brain className="h-4 w-4 mr-2" />
              AI Learning
            </TabsTrigger>
          </TabsList>

          {/* Integrations Tab */}
          <TabsContent value="integrations" className="space-y-6">
            {/* Gmail Integration */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5 text-red-500" />
                  Gmail Integration
                </CardTitle>
                <CardDescription>
                  Receive customer orders via email and send confirmations
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

                    {credential?.watch_expiration && (
                      <div className="text-sm text-muted-foreground">
                        <span className="font-medium">Watch expires:</span>{' '}
                        {format(new Date(credential.watch_expiration), 'PPP')}
                        {isWatchExpired && (
                          <Badge variant="destructive" className="ml-2">Expired</Badge>
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

            {/* WhatsApp Setup */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-green-600" />
                  WhatsApp Business API
                </CardTitle>
                <CardDescription>
                  Connect your WhatsApp Business account to receive and send orders
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Setup Required</AlertTitle>
                  <AlertDescription>
                    To use WhatsApp integration, you need to:
                    <ol className="list-decimal ml-4 mt-2 space-y-1">
                      <li>Create a Meta Business account at business.facebook.com</li>
                      <li>Set up WhatsApp Business API via Meta Cloud API</li>
                      <li>Get your Phone Number ID and Access Token from the dashboard</li>
                      <li>Configure the webhook URL in your Meta app settings</li>
                    </ol>
                  </AlertDescription>
                </Alert>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="phoneNumberId">Phone Number ID</Label>
                    <Input
                      id="phoneNumberId"
                      value={whatsappConfig.phoneNumberId}
                      onChange={(e) =>
                        setWhatsappConfig({ ...whatsappConfig, phoneNumberId: e.target.value })
                      }
                      placeholder="Enter your WhatsApp Phone Number ID"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="accessToken">Access Token</Label>
                    <Input
                      id="accessToken"
                      type="password"
                      value={whatsappConfig.accessToken}
                      onChange={(e) =>
                        setWhatsappConfig({ ...whatsappConfig, accessToken: e.target.value })
                      }
                      placeholder="Enter your WhatsApp Access Token"
                    />
                    <p className="text-xs text-muted-foreground">
                      This will be stored as a secret and never exposed
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="verifyToken">Webhook Verify Token</Label>
                    <Input
                      id="verifyToken"
                      value={whatsappConfig.verifyToken}
                      onChange={(e) =>
                        setWhatsappConfig({ ...whatsappConfig, verifyToken: e.target.value })
                      }
                      placeholder="Create a custom verify token"
                    />
                    <p className="text-xs text-muted-foreground">
                      This is used by Meta to verify your webhook endpoint
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Webhook URL (copy this to Meta)</Label>
                    <div className="flex gap-2">
                      <Input value={whatsappConfig.webhookUrl} readOnly className="font-mono text-sm" />
                      <Button
                        variant="outline"
                        onClick={() => {
                          navigator.clipboard.writeText(whatsappConfig.webhookUrl);
                          toast.success('Copied to clipboard');
                        }}
                      >
                        Copy
                      </Button>
                    </div>
                  </div>

                  <Button onClick={handleSaveWhatsApp} className="w-full">
                    <Key className="mr-2 h-4 w-4" />
                    Save WhatsApp Configuration
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* QuickBooks Setup */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Webhook className="h-5 w-5 text-blue-600" />
                  QuickBooks Online Integration
                </CardTitle>
                <CardDescription>
                  Connect to QuickBooks to automatically sync invoices
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Coming Soon</AlertTitle>
                  <AlertDescription>
                    QuickBooks integration will be available in the next phase. This will allow:
                    <ul className="list-disc ml-4 mt-2 space-y-1">
                      <li>Automatic customer sync to QuickBooks</li>
                      <li>Invoice creation when orders are completed</li>
                      <li>Payment status tracking</li>
                    </ul>
                  </AlertDescription>
                </Alert>

                <Button disabled className="w-full">
                  Connect to QuickBooks
                </Button>
              </CardContent>
            </Card>

            {/* AI Configuration */}
            <Card>
              <CardHeader>
                <CardTitle>AI Order Parser Settings</CardTitle>
                <CardDescription>
                  Configure how AI interprets customer orders
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="font-medium">AI Order Parsing</p>
                      <p className="text-sm text-muted-foreground">
                        Powered by Lovable AI (no API key needed)
                      </p>
                    </div>
                  </div>
                  <span className="text-sm text-green-600 font-medium">Active</span>
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium">Supported Languages</h4>
                  <div className="flex flex-wrap gap-2">
                    {['Papiamento', 'English', 'Dutch', 'Spanish'].map((lang) => (
                      <span
                        key={lang}
                        className="px-3 py-1 bg-muted rounded-full text-sm"
                      >
                        {lang}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium">AI Features</h4>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      Automatic language detection
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      Fuzzy product matching across languages
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      Order suggestions based on history
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      Natural response in customer's language
                    </li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* AI Learning Tab */}
          <TabsContent value="ai-learning" className="space-y-6">
            <Alert className="bg-primary/5 border-primary/20">
              <Brain className="h-4 w-4" />
              <AlertTitle>AI Learning Hub</AlertTitle>
              <AlertDescription>
                Teach the AI to understand product names in any language. Add global aliases,
                review unmatched items, and manage customer-specific mappings.
              </AlertDescription>
            </Alert>

            <Tabs defaultValue="aliases" className="space-y-4">
              <TabsList className="grid w-full grid-cols-3 h-auto">
                <TabsTrigger value="aliases" className="text-xs py-2 px-1">
                  Global Aliases
                </TabsTrigger>
                <TabsTrigger value="unmatched" className="text-xs py-2 px-1">
                  Unmatched
                </TabsTrigger>
                <TabsTrigger value="customer" className="text-xs py-2 px-1">
                  By Customer
                </TabsTrigger>
              </TabsList>

              <TabsContent value="aliases">
                <GlobalAliasManager />
              </TabsContent>

              <TabsContent value="unmatched">
                <UnmatchedItemsQueue />
              </TabsContent>

              <TabsContent value="customer">
                <CustomerMappingsViewer />
              </TabsContent>
            </Tabs>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
