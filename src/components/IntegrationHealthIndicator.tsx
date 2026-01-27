import { useIntegrationHealth, IntegrationStatus } from '@/hooks/useIntegrationHealth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { MessageSquare, Mail, Receipt, Wifi, WifiOff, AlertCircle, CheckCircle2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Link } from 'react-router-dom';

const integrationIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  'WhatsApp API': MessageSquare,
  'Gmail': Mail,
  'QuickBooks': Receipt,
};

const statusColors: Record<IntegrationStatus['status'], string> = {
  healthy: 'text-green-500',
  warning: 'text-amber-500',
  error: 'text-red-500',
  disconnected: 'text-muted-foreground',
};

const statusBgColors: Record<IntegrationStatus['status'], string> = {
  healthy: 'bg-green-500/10',
  warning: 'bg-amber-500/10',
  error: 'bg-red-500/10',
  disconnected: 'bg-muted/50',
};

const integrationLinks: Record<string, string> = {
  'WhatsApp API': '/settings/integrations/whatsapp',
  'Gmail': '/settings/integrations/gmail',
  'QuickBooks': '/settings/integrations/quickbooks/connect',
};

function StatusIcon({ status }: { status: IntegrationStatus['status'] }) {
  switch (status) {
    case 'healthy':
      return <CheckCircle2 className="h-3 w-3 text-green-500" />;
    case 'warning':
      return <AlertCircle className="h-3 w-3 text-amber-500" />;
    case 'error':
      return <AlertCircle className="h-3 w-3 text-red-500" />;
    case 'disconnected':
      return <WifiOff className="h-3 w-3 text-muted-foreground" />;
  }
}

function IntegrationItem({ integration }: { integration: IntegrationStatus }) {
  const Icon = integrationIcons[integration.name] || Wifi;
  const link = integrationLinks[integration.name];

  const content = (
    <div 
      className={`flex items-center gap-2 p-2 rounded-lg transition-colors ${statusBgColors[integration.status]} hover:opacity-80`}
    >
      <div className={`p-1.5 rounded-md ${statusBgColors[integration.status]}`}>
        <Icon className={`h-4 w-4 ${statusColors[integration.status]}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium truncate">{integration.name}</span>
          <StatusIcon status={integration.status} />
        </div>
      </div>
    </div>
  );

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {link ? (
            <Link to={link} className="block">
              {content}
            </Link>
          ) : (
            <div>{content}</div>
          )}
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <div className="space-y-1">
            <p className="font-medium">{integration.name}</p>
            <p className="text-xs text-muted-foreground">{integration.message}</p>
            {integration.lastChecked && (
              <p className="text-xs text-muted-foreground">
                Last checked: {formatDistanceToNow(new Date(integration.lastChecked), { addSuffix: true })}
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function IntegrationHealthIndicator() {
  const { data: integrations, isLoading } = useIntegrationHealth();

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Wifi className="h-4 w-4" />
            Integrations
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  const healthyCount = integrations?.filter(i => i.status === 'healthy').length || 0;
  const totalCount = integrations?.length || 0;
  const allHealthy = healthyCount === totalCount;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wifi className="h-4 w-4" />
            Integrations
          </div>
          <span className={`text-xs ${allHealthy ? 'text-green-500' : 'text-amber-500'}`}>
            {healthyCount}/{totalCount} OK
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {integrations?.map((integration) => (
          <IntegrationItem key={integration.name} integration={integration} />
        ))}
      </CardContent>
    </Card>
  );
}

// Compact version for inline display
export function IntegrationHealthBadges() {
  const { data: integrations, isLoading } = useIntegrationHealth();

  if (isLoading) {
    return (
      <div className="flex items-center gap-2">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-6 w-6 rounded-full" />
        ))}
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="flex items-center gap-1">
        {integrations?.map((integration) => {
          const Icon = integrationIcons[integration.name] || Wifi;
          const link = integrationLinks[integration.name];
          
          const badge = (
            <div 
              className={`relative p-1.5 rounded-full transition-colors ${statusBgColors[integration.status]} hover:opacity-80 cursor-pointer`}
            >
              <Icon className={`h-4 w-4 ${statusColors[integration.status]}`} />
              {integration.status !== 'healthy' && integration.status !== 'disconnected' && (
                <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
              )}
              {integration.status === 'error' && (
                <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-red-500" />
              )}
            </div>
          );

          return (
            <Tooltip key={integration.name}>
              <TooltipTrigger asChild>
                {link ? (
                  <Link to={link}>
                    {badge}
                  </Link>
                ) : (
                  <div>{badge}</div>
                )}
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <div className="space-y-1">
                  <p className="font-medium flex items-center gap-1.5">
                    {integration.name}
                    <StatusIcon status={integration.status} />
                  </p>
                  <p className="text-xs text-muted-foreground">{integration.message}</p>
                </div>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
