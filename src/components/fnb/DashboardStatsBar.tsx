import { 
  ShoppingCart, Package, Truck, CheckCircle, Users, DollarSign, 
  TrendingUp, Clock, AlertTriangle, Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface DashboardStats {
  todayOrders: number;
  pending: number;
  picking: number;
  outForDelivery: number;
  completed: number;
  todayRevenue: number;
  activeCustomers: number;
  sameDayOrders: number;
}

interface DashboardStatsBarProps {
  stats: DashboardStats;
  isLoading: boolean;
}

export function DashboardStatsBar({ stats, isLoading }: DashboardStatsBarProps) {
  const items = [
    { 
      label: "Today's Orders", 
      value: stats.todayOrders, 
      icon: ShoppingCart, 
      color: "text-blue-500",
      bgColor: "bg-blue-500/10"
    },
    { 
      label: "Pending", 
      value: stats.pending, 
      icon: Clock, 
      color: "text-yellow-500",
      bgColor: "bg-yellow-500/10"
    },
    { 
      label: "Picking", 
      value: stats.picking, 
      icon: Package, 
      color: "text-purple-500",
      bgColor: "bg-purple-500/10"
    },
    { 
      label: "Delivery", 
      value: stats.outForDelivery, 
      icon: Truck, 
      color: "text-orange-500",
      bgColor: "bg-orange-500/10"
    },
    { 
      label: "Completed", 
      value: stats.completed, 
      icon: CheckCircle, 
      color: "text-green-500",
      bgColor: "bg-green-500/10"
    },
    { 
      label: "Revenue", 
      value: `${stats.todayRevenue.toFixed(0)}`, 
      suffix: "XCG",
      icon: DollarSign, 
      color: "text-emerald-500",
      bgColor: "bg-emerald-500/10"
    },
    { 
      label: "Same Day", 
      value: stats.sameDayOrders, 
      icon: Zap, 
      color: "text-red-500",
      bgColor: "bg-red-500/10",
      highlight: stats.sameDayOrders > 0
    },
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-4 md:grid-cols-7 gap-2">
        {items.map((_, i) => (
          <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-4 md:grid-cols-7 gap-2">
      {items.map((item) => (
        <div 
          key={item.label} 
          className={cn(
            "flex flex-col items-center justify-center p-2 rounded-lg border transition-colors",
            item.highlight ? "border-red-500/50 bg-red-500/5" : "bg-card"
          )}
        >
          <div className={cn("p-1.5 rounded-full mb-1", item.bgColor)}>
            <item.icon className={cn("h-3.5 w-3.5", item.color)} />
          </div>
          <span className="text-lg font-bold leading-none">
            {item.value}
            {item.suffix && <span className="text-xs font-normal ml-0.5">{item.suffix}</span>}
          </span>
          <span className="text-[10px] text-muted-foreground mt-0.5 text-center leading-tight">
            {item.label}
          </span>
        </div>
      ))}
    </div>
  );
}
