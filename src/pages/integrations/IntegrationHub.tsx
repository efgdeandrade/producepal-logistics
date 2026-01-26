import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useIntegrations, useWebhooks } from '@/hooks/useIntegrations';
import { useGmailCredentials } from '@/hooks/useGmailCredentials';
import { MessageSquare, RefreshCw, Webhook, Plug, ArrowRight, Settings, Mail } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { WhatsAppHealthCard } from '@/components/integrations/WhatsAppHealthCard';

const IntegrationHub = () => {
  const navigate = useNavigate();
  const { integrations, loading: integrationsLoading } = useIntegrations();
  const { webhooks, loading: webhooksLoading } = useWebhooks();
  const { isConnected: gmailConnected, loading: gmailLoading } = useGmailCredentials();

  const whatsappIntegration = integrations.find(i => i.type === 'whatsapp');
  const quickbooksIntegration = integrations.find(i => i.type === 'quickbooks');
  const activeWebhooksCount = webhooks.filter(w => w.is_active).length;

  const integrationCards = [
    {
      title: 'Gmail',
      description: 'Receive customer orders via email and send confirmations',
      icon: Mail,
      status: gmailConnected ? 'connected' : 'disconnected',
      href: '/settings/integrations/gmail',
      color: 'text-red-500',
    },
    {
      title: 'WhatsApp Business',
      description: 'Receive orders via WhatsApp and send automated responses',
      icon: MessageSquare,
      status: whatsappIntegration?.is_active ? 'connected' : 'disconnected',
      lastSync: whatsappIntegration?.last_sync_at,
      href: '/settings/integrations/whatsapp',
      color: 'text-green-500',
    },
    {
      title: 'QuickBooks',
      description: 'Sync customers, invoices, and payments with QuickBooks',
      icon: RefreshCw,
      status: quickbooksIntegration?.is_active ? 'connected' : 'disconnected',
      lastSync: quickbooksIntegration?.last_sync_at,
      href: '/settings/integrations/quickbooks',
      color: 'text-blue-500',
    },
    {
      title: 'Webhooks',
      description: `Send real-time event notifications to external systems`,
      icon: Webhook,
      status: activeWebhooksCount > 0 ? 'active' : 'inactive',
      extra: `${activeWebhooksCount} active`,
      href: '/settings/integrations/webhooks',
      color: 'text-purple-500',
    },
    {
      title: 'API Connectors',
      description: 'Connect to custom APIs and external services',
      icon: Plug,
      status: integrations.filter(i => i.type === 'custom_api').length > 0 ? 'configured' : 'none',
      extra: `${integrations.filter(i => i.type === 'custom_api').length} connectors`,
      href: '/settings/integrations/api',
      color: 'text-orange-500',
    },
  ];

  if (integrationsLoading || webhooksLoading || gmailLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Integration Hub</h1>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          {[1, 2, 3, 4].map(i => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="h-24 bg-muted" />
              <CardContent className="h-16 bg-muted/50" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Integration Hub</h1>
          <p className="text-muted-foreground">Connect and manage external services</p>
        </div>
        <Button variant="outline" onClick={() => navigate('/settings')}>
          <Settings className="h-4 w-4 mr-2" />
          Settings
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {integrationCards.map((card) => (
          <Card key={card.title} className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate(card.href)}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg bg-muted ${card.color}`}>
                  <card.icon className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-lg">{card.title}</CardTitle>
                  <CardDescription className="text-sm">{card.description}</CardDescription>
                </div>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant={card.status === 'connected' || card.status === 'active' ? 'default' : 'secondary'}>
                    {card.status}
                  </Badge>
                  {card.extra && (
                    <span className="text-sm text-muted-foreground">{card.extra}</span>
                  )}
                </div>
                {card.lastSync && (
                  <span className="text-xs text-muted-foreground">
                    Last sync: {format(new Date(card.lastSync), 'MMM d, h:mm a')}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* WhatsApp Health Monitoring */}
      <WhatsAppHealthCard />

      {/* Quick Stats */}
      <Card>
        <CardHeader>
          <CardTitle>Integration Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-2xl font-bold">{integrations.filter(i => i.is_active).length}</div>
              <div className="text-sm text-muted-foreground">Active Integrations</div>
            </div>
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-2xl font-bold">{activeWebhooksCount}</div>
              <div className="text-sm text-muted-foreground">Active Webhooks</div>
            </div>
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-2xl font-bold">{integrations.filter(i => i.sync_status === 'error').length}</div>
              <div className="text-sm text-muted-foreground">Sync Errors</div>
            </div>
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-2xl font-bold">{integrations.length}</div>
              <div className="text-sm text-muted-foreground">Total Configured</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default IntegrationHub;
