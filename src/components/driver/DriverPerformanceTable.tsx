import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

export interface DriverPerformance {
  driverId: string;
  driverName: string;
  driverEmail: string;
  routesToday: number;
  stopsCompleted: number;
  totalStops: number;
  avgTimePerStop: number;
  codCollected: number;
  efficiencyScore: number;
  status: "active" | "idle" | "completed";
}

interface DriverPerformanceTableProps {
  drivers: DriverPerformance[];
  isLoading?: boolean;
}

export function DriverPerformanceTable({ drivers, isLoading }: DriverPerformanceTableProps) {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-success text-success-foreground">Active</Badge>;
      case "idle":
        return <Badge variant="secondary">Idle</Badge>;
      case "completed":
        return <Badge className="bg-primary text-primary-foreground">Completed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getEfficiencyIcon = (score: number) => {
    if (score >= 90) return <TrendingUp className="h-4 w-4 text-success" />;
    if (score >= 70) return <Minus className="h-4 w-4 text-muted-foreground" />;
    return <TrendingDown className="h-4 w-4 text-destructive" />;
  };

  const getEfficiencyColor = (score: number) => {
    if (score >= 90) return "text-success";
    if (score >= 70) return "text-orange-500";
    return "text-destructive";
  };

  if (isLoading) {
    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Driver</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Routes</TableHead>
              <TableHead>Progress</TableHead>
              <TableHead>Avg Time/Stop</TableHead>
              <TableHead>COD Collected</TableHead>
              <TableHead>Efficiency</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...Array(3)].map((_, i) => (
              <TableRow key={i} className="animate-pulse">
                <TableCell><div className="h-8 bg-muted rounded w-32" /></TableCell>
                <TableCell><div className="h-6 bg-muted rounded w-16" /></TableCell>
                <TableCell><div className="h-6 bg-muted rounded w-8" /></TableCell>
                <TableCell><div className="h-6 bg-muted rounded w-24" /></TableCell>
                <TableCell><div className="h-6 bg-muted rounded w-16" /></TableCell>
                <TableCell><div className="h-6 bg-muted rounded w-20" /></TableCell>
                <TableCell><div className="h-6 bg-muted rounded w-16" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (drivers.length === 0) {
    return (
      <div className="rounded-md border p-8 text-center text-muted-foreground">
        No driver activity today
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Driver</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-center">Routes</TableHead>
            <TableHead>Progress</TableHead>
            <TableHead className="text-center">Avg Time/Stop</TableHead>
            <TableHead className="text-right">COD Collected</TableHead>
            <TableHead className="text-center">Efficiency</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {drivers.map((driver) => {
            const progressPercent = driver.totalStops > 0 
              ? Math.round((driver.stopsCompleted / driver.totalStops) * 100) 
              : 0;

            return (
              <TableRow key={driver.driverId}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-primary/10 text-primary text-xs">
                        {driver.driverName.split(" ").map(n => n[0]).join("").toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{driver.driverName}</p>
                      <p className="text-xs text-muted-foreground">{driver.driverEmail}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>{getStatusBadge(driver.status)}</TableCell>
                <TableCell className="text-center">{driver.routesToday}</TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span>{driver.stopsCompleted}/{driver.totalStops}</span>
                      <span className="text-muted-foreground">{progressPercent}%</span>
                    </div>
                    <Progress value={progressPercent} className="h-2" />
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <span className={driver.avgTimePerStop <= 10 ? "text-success" : driver.avgTimePerStop <= 15 ? "text-orange-500" : "text-destructive"}>
                    {driver.avgTimePerStop} min
                  </span>
                </TableCell>
                <TableCell className="text-right font-medium">
                  {driver.codCollected.toFixed(2)} XCG
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-center gap-1">
                    {getEfficiencyIcon(driver.efficiencyScore)}
                    <span className={`font-bold ${getEfficiencyColor(driver.efficiencyScore)}`}>
                      {driver.efficiencyScore}%
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
