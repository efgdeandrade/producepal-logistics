import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Package, 
  Truck, 
  DollarSign, 
  Users, 
  Clock,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Factory,
  FileCheck,
  Bot,
  Zap
} from 'lucide-react';

interface KPIProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  loading?: boolean;
  color?: string;
}

function KPICard({ title, value, subtitle, icon: Icon, trend, trendValue, loading, color = 'primary' }: KPIProps) {
  if (loading) {
    return (
      <Card className="overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-4">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-6 w-6 rounded" />
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <Skeleton className="h-7 w-16 mb-1" />
          <Skeleton className="h-3 w-24" />
        </CardContent>
      </Card>
    );
  }

  const colorMap: Record<string, string> = {
    primary: 'bg-primary/10 text-primary',
    blue: 'bg-blue-500/10 text-blue-500',
    green: 'bg-green-500/10 text-green-500',
    amber: 'bg-amber-500/10 text-amber-500',
    red: 'bg-red-500/10 text-red-500',
    purple: 'bg-purple-500/10 text-purple-500',
  };

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-4">
        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {title}
        </CardTitle>
        <div className={`p-1.5 rounded-lg ${colorMap[color] || colorMap.primary}`}>
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="text-2xl font-bold tracking-tight">{value}</div>
        <div className="flex items-center gap-2 mt-1">
          {trend && trendValue && (
            <span className={`flex items-center text-xs font-medium ${
              trend === 'up' ? 'text-green-600' : 
              trend === 'down' ? 'text-red-600' : 
              'text-muted-foreground'
            }`}>
              {trend === 'up' ? <TrendingUp className="h-3 w-3 mr-0.5" /> : 
               trend === 'down' ? <TrendingDown className="h-3 w-3 mr-0.5" /> : null}
              {trendValue}
            </span>
          )}
          {subtitle && (
            <span className="text-xs text-muted-foreground">{subtitle}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface ExecutiveKPIGridProps {
  stats?: {
    importOrdersToday: number;
    distributionOrdersToday: number;
    activeDeliveries: number;
    todayRevenue: number;
    pendingIssues: number;
    weeklyOrders: any[];
  };
  hrMetrics?: {
    clockedIn: number;
    weeklyHours: number;
    pendingDocs: number;
    expiringDocs: number;
  };
  health?: {
    distribution: { pickingQueue: number; codCollected: number };
    logistics: { driversActive: number };
    production: { pendingOrders: number };
  };
  aiMetrics?: {
    accuracy: string;
    uptime: number;
    conversions: number;
  };
  statsLoading: boolean;
  hrLoading: boolean;
  healthLoading: boolean;
}

export function ExecutiveKPIGrid({ 
  stats, 
  hrMetrics, 
  health, 
  aiMetrics,
  statsLoading, 
  hrLoading,
  healthLoading 
}: ExecutiveKPIGridProps) {
  return (
    <div className="space-y-4">
      {/* Primary KPIs - Revenue & Orders */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4 lg:grid-cols-6">
        <KPICard
          title="Today's Revenue"
          value={`ƒ ${(stats?.todayRevenue || 0).toLocaleString()}`}
          icon={DollarSign}
          color="green"
          loading={statsLoading}
        />
        <KPICard
          title="Distribution"
          value={stats?.distributionOrdersToday || 0}
          subtitle="orders today"
          icon={Truck}
          color="blue"
          loading={statsLoading}
        />
        <KPICard
          title="Import Orders"
          value={stats?.importOrdersToday || 0}
          subtitle="today"
          icon={Package}
          color="purple"
          loading={statsLoading}
        />
        <KPICard
          title="Active Delivery"
          value={stats?.activeDeliveries || 0}
          subtitle="in transit"
          icon={Truck}
          color="primary"
          loading={statsLoading}
        />
        <KPICard
          title="Picking Queue"
          value={health?.distribution?.pickingQueue || 0}
          subtitle="orders"
          icon={Clock}
          color="amber"
          loading={healthLoading}
        />
        <KPICard
          title="Issues"
          value={stats?.pendingIssues || 0}
          subtitle="pending"
          icon={AlertTriangle}
          color={stats?.pendingIssues ? 'red' : 'green'}
          loading={statsLoading}
        />
      </div>

      {/* Secondary KPIs - HR & Operations */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4 lg:grid-cols-6">
        <KPICard
          title="Staff Working"
          value={hrMetrics?.clockedIn || 0}
          subtitle="clocked in"
          icon={Users}
          color="blue"
          loading={hrLoading}
        />
        <KPICard
          title="Weekly Hours"
          value={`${hrMetrics?.weeklyHours || 0}h`}
          subtitle="logged"
          icon={Clock}
          color="primary"
          loading={hrLoading}
        />
        <KPICard
          title="COD Collected"
          value={`ƒ ${(health?.distribution?.codCollected || 0).toLocaleString()}`}
          subtitle="today"
          icon={DollarSign}
          color="green"
          loading={healthLoading}
        />
        <KPICard
          title="Production"
          value={health?.production?.pendingOrders || 0}
          subtitle="pending"
          icon={Factory}
          color="purple"
          loading={healthLoading}
        />
        <KPICard
          title="Doc Reviews"
          value={hrMetrics?.pendingDocs || 0}
          subtitle="pending"
          icon={FileCheck}
          color={hrMetrics?.pendingDocs ? 'amber' : 'green'}
          loading={hrLoading}
        />
        <KPICard
          title="Dre AI"
          value={aiMetrics?.accuracy || '--'}
          subtitle="accuracy"
          icon={Bot}
          color="primary"
          loading={statsLoading}
        />
      </div>
    </div>
  );
}
