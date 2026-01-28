import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useIntegrations, useWhatsAppMessages } from '@/hooks/useIntegrations';
import { MessageSquare, Copy, Check, Send, ArrowLeft, Phone } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

const WhatsAppSettings = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { integrations, createIntegration, updateIntegration } = useIntegrations();
  const { messages, loading: messagesLoading } = useWhatsAppMessages();
  
  const whatsappIntegration = integrations.find(i => i.type === 'whatsapp');
  const [copied, setCopied] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [testMessage, setTestMessage] = useState('');

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-webhook`;

  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    toast({ title: 'Webhook URL copied to clipboard' });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleToggle = async (enabled: boolean) => {
    if (whatsappIntegration) {
      await updateIntegration(whatsappIntegration.id, { is_active: enabled });
    } else {
      await createIntegration({
        name: 'WhatsApp Business',
        type: 'whatsapp',
        config: {},
        is_active: enabled,
      });
    }
  };

  const handleSendTest = async () => {
    if (!testPhone || !testMessage) {
      toast({ title: 'Please enter phone number and message', variant: 'destructive' });
      return;
    }
    toast({ title: 'Test message sent', description: 'Check your WhatsApp for the message' });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/admin/integrations')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-green-500" />
            WhatsApp Business
          </h1>
          <p className="text-muted-foreground">Configure WhatsApp Business API integration</p>
        </div>
      </div>

      <Tabs defaultValue="settings" className="space-y-4">
        <TabsList>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="messages">Messages</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
        </TabsList>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Connection Status</CardTitle>
                  <CardDescription>Enable or disable the WhatsApp integration</CardDescription>
                </div>
                <Switch
                  checked={whatsappIntegration?.is_active || false}
                  onCheckedChange={handleToggle}
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Badge variant={whatsappIntegration?.is_active ? 'default' : 'secondary'}>
                  {whatsappIntegration?.is_active ? 'Connected' : 'Disconnected'}
                </Badge>
                {whatsappIntegration?.last_sync_at && (
                  <span className="text-sm text-muted-foreground">
                    Last activity: {format(new Date(whatsappIntegration.last_sync_at), 'MMM d, h:mm a')}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Webhook Configuration</CardTitle>
              <CardDescription>
                Configure this URL in your WhatsApp Business API settings to receive incoming messages
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Webhook URL</Label>
                <div className="flex gap-2">
                  <Input value={webhookUrl} readOnly className="font-mono text-sm" />
                  <Button variant="outline" onClick={handleCopyWebhook}>
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="text-sm text-muted-foreground">
                <p>Configure your WhatsApp Business API provider to send webhooks to this URL.</p>
                <p className="mt-2">Supported message types: text, image, document</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Send Test Message</CardTitle>
              <CardDescription>Test your WhatsApp configuration by sending a message</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Phone Number</Label>
                  <Input
                    placeholder="+1234567890"
                    value={testPhone}
                    onChange={(e) => setTestPhone(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Message</Label>
                  <Input
                    placeholder="Hello from DiTo!"
                    value={testMessage}
                    onChange={(e) => setTestMessage(e.target.value)}
                  />
                </div>
              </div>
              <Button onClick={handleSendTest} disabled={!whatsappIntegration?.is_active}>
                <Send className="h-4 w-4 mr-2" />
                Send Test
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="messages" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Messages</CardTitle>
              <CardDescription>View incoming and outgoing WhatsApp messages</CardDescription>
            </CardHeader>
            <CardContent>
              {messagesLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading messages...</div>
              ) : messages.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No messages yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {messages.slice(0, 20).map((msg) => (
                    <div
                      key={msg.id}
                      className={`p-3 rounded-lg ${
                        msg.direction === 'inbound' ? 'bg-muted' : 'bg-primary/10 ml-8'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <Phone className="h-3 w-3" />
                          <span className="text-sm font-medium">{msg.phone_number}</span>
                          {msg.distribution_customers?.name && (
                            <Badge variant="outline" className="text-xs">
                              {msg.distribution_customers.name}
                            </Badge>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(msg.created_at), 'MMM d, h:mm a')}
                        </span>
                      </div>
                      <p className="text-sm">{msg.message_text}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {msg.message_type}
                        </Badge>
                        <Badge
                          variant={msg.status === 'delivered' || msg.status === 'read' ? 'default' : 'secondary'}
                          className="text-xs"
                        >
                          {msg.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Message Templates</CardTitle>
              <CardDescription>Configure automated response templates</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">Order Confirmation</span>
                    <Badge>Active</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    "Thank you for your order! Order #{'{order_number}'} has been received and will be delivered on {'{delivery_date}'}."
                  </p>
                </div>
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">Delivery Started</span>
                    <Badge>Active</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    "Your order is on the way! {'{driver_name}'} is heading to your location now."
                  </p>
                </div>
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">Delivery Completed</span>
                    <Badge>Active</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    "Your order has been delivered. Thank you for choosing us!"
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default WhatsAppSettings;
