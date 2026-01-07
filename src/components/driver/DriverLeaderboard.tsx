import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { Trophy, Zap, Clock, Banknote } from "lucide-react";

interface LeaderboardEntry {
  driverName: string;
  value: number | string;
  rank: number;
}

interface DriverLeaderboardProps {
  topDeliveries: LeaderboardEntry[];
  topCod: LeaderboardEntry[];
  fastestDrivers: LeaderboardEntry[];
  isLoading?: boolean;
}

function LeaderboardCard({ 
  title, 
  icon: Icon, 
  entries, 
  valueLabel,
  iconColor 
}: { 
  title: string; 
  icon: any; 
  entries: LeaderboardEntry[];
  valueLabel: string;
  iconColor: string;
}) {
  const getRankBadge = (rank: number) => {
    if (rank === 1) return <Badge className="bg-yellow-500 text-yellow-950">🥇</Badge>;
    if (rank === 2) return <Badge className="bg-gray-400 text-gray-900">🥈</Badge>;
    if (rank === 3) return <Badge className="bg-amber-600 text-amber-50">🥉</Badge>;
    return <Badge variant="outline">{rank}</Badge>;
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Icon className={`h-5 w-5 ${iconColor}`} />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No data yet</p>
        ) : (
          <div className="space-y-2">
            {entries.map((entry) => (
              <div 
                key={`${entry.driverName}-${entry.rank}`}
                className="flex items-center justify-between py-2 border-b last:border-0"
              >
                <div className="flex items-center gap-3">
                  {getRankBadge(entry.rank)}
                  <span className="font-medium text-sm">{entry.driverName}</span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {entry.value} {valueLabel}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function DriverLeaderboard({ 
  topDeliveries, 
  topCod, 
  fastestDrivers,
  isLoading 
}: DriverLeaderboardProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-6 bg-muted rounded w-32" />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[...Array(3)].map((_, j) => (
                  <div key={j} className="h-8 bg-muted rounded" />
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <LeaderboardCard
        title="Most Deliveries"
        icon={Trophy}
        entries={topDeliveries}
        valueLabel="deliveries"
        iconColor="text-yellow-500"
      />
      <LeaderboardCard
        title="Top COD Collectors"
        icon={Banknote}
        entries={topCod}
        valueLabel="XCG"
        iconColor="text-success"
      />
      <LeaderboardCard
        title="Fastest Drivers"
        icon={Zap}
        entries={fastestDrivers}
        valueLabel="min/stop"
        iconColor="text-primary"
      />
    </div>
  );
}
