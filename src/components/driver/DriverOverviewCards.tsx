import { Card, CardContent } from "@/components/ui/card";
import { Users, Truck, Clock, Banknote, CheckCircle, AlertTriangle } from "lucide-react";

interface DriverStats {
  activeDrivers: number;
  totalDeliveries: number;
  pendingDeliveries: number;
  avgDeliveryTime: number;
  totalCodCollected: number;
  onTimeRate: number;
}

interface DriverOverviewCardsProps {
  stats: DriverStats;
  isLoading?: boolean;
}

export function DriverOverviewCards({ stats, isLoading }: DriverOverviewCardsProps) {
  const cards = [
    {
      title: "Active Drivers",
      value: stats.activeDrivers,
      icon: Users,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: "Deliveries Today",
      value: stats.totalDeliveries,
      icon: CheckCircle,
      color: "text-success",
      bgColor: "bg-success/10",
    },
    {
      title: "Pending",
      value: stats.pendingDeliveries,
      icon: Truck,
      color: "text-orange-500",
      bgColor: "bg-orange-500/10",
    },
    {
      title: "Avg Time/Stop",
      value: `${stats.avgDeliveryTime} min`,
      icon: Clock,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      title: "COD Collected",
      value: `${stats.totalCodCollected.toFixed(0)} XCG`,
      icon: Banknote,
      color: "text-success",
      bgColor: "bg-success/10",
    },
    {
      title: "On-Time Rate",
      value: `${stats.onTimeRate}%`,
      icon: stats.onTimeRate >= 90 ? CheckCircle : AlertTriangle,
      color: stats.onTimeRate >= 90 ? "text-success" : "text-orange-500",
      bgColor: stats.onTimeRate >= 90 ? "bg-success/10" : "bg-orange-500/10",
    },
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="h-16 bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {cards.map((card) => (
        <Card key={card.title} className="hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${card.bgColor}`}>
                <card.icon className={`h-5 w-5 ${card.color}`} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{card.title}</p>
                <p className="text-lg font-bold">{card.value}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
