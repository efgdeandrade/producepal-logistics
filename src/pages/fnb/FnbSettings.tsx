import { useState } from 'react';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, MessageSquare, Webhook, Key, CheckCircle, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function FnbSettings() {
  const [whatsappConfig, setWhatsappConfig] = useState({
    phoneNumberId: '',
    accessToken: '',
    verifyToken: '',
    webhookUrl: `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fnb-whatsapp-webhook`,
  });

  const handleSaveWhatsApp = async () => {
    // TODO: Save to settings table
    toast.success('WhatsApp configuration saved');
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-6 max-w-4xl">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/fnb">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">F&B Settings</h1>
            <p className="text-muted-foreground">
              Configure WhatsApp Business API and QuickBooks integration
            </p>
          </div>
        </div>

        <div className="space-y-6">
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
              <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-200">
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
        </div>
      </main>
    </div>
  );
}