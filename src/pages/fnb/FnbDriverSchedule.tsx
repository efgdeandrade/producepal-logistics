import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../integrations/supabase/client";
import { Header } from "../../components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Switch } from "../../components/ui/switch";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import { toast } from "sonner";
import { format, addDays, startOfWeek, isSameDay } from "date-fns";
import { ChevronLeft, ChevronRight, Users, Calendar, Truck, Clock, Save, Copy } from "lucide-react";
import { cn } from "../../lib/utils";

interface DriverAvailability {
  id: string;
  driver_id: string;
  date: string;
  is_available: boolean;
  start_time: string;
  end_time: string;
  vehicle_capacity: number;
  notes: string | null;
}

interface Driver {
  id: string;
  email: string;
  full_name: string | null;
}

const FnbDriverSchedule = () => {
  const queryClient = useQueryClient();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [pendingChanges, setPendingChanges] = useState<Record<string, Partial<DriverAvailability>>>({});

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Fetch drivers with driver role
  const { data: drivers = [] } = useQuery({
    queryKey: ["fnb-drivers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("user_id, profiles!inner(id, email, full_name)")
        .eq("role", "driver");
      
      if (error) throw error;
      return data?.map((d: any) => ({
        id: d.profiles.id,
        email: d.profiles.email,
        full_name: d.profiles.full_name
      })) as Driver[];
    }
  });

  // Fetch availability for the week
  const { data: availability = [] } = useQuery({
    queryKey: ["driver-availability", format(weekStart, "yyyy-MM-dd")],
    queryFn: async () => {
      const startDate = format(weekStart, "yyyy-MM-dd");
      const endDate = format(addDays(weekStart, 6), "yyyy-MM-dd");
      
      const { data, error } = await supabase
        .from("driver_availability")
        .select("*")
        .gte("date", startDate)
        .lte("date", endDate);
      
      if (error) throw error;
      return data as DriverAvailability[];
    }
  });

  const upsertMutation = useMutation({
    mutationFn: async (records: { driver_id: string; date: string; is_available: boolean; start_time: string; end_time: string; vehicle_capacity: number; notes?: string | null }[]) => {
      const { error } = await supabase
        .from("driver_availability")
        .upsert(records, { onConflict: "driver_id,date" });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["driver-availability"] });
      setPendingChanges({});
      toast.success("Schedule saved successfully");
    },
    onError: (error) => {
      toast.error("Failed to save schedule: " + error.message);
    }
  });

  const getAvailability = (driverId: string, date: Date): DriverAvailability | undefined => {
    const dateStr = format(date, "yyyy-MM-dd");
    const key = `${driverId}-${dateStr}`;
    
    if (pendingChanges[key]) {
      return { ...getBaseAvailability(driverId, date), ...pendingChanges[key] } as DriverAvailability;
    }
    
    return availability.find(a => a.driver_id === driverId && a.date === dateStr);
  };

  const getBaseAvailability = (driverId: string, date: Date): Partial<DriverAvailability> => {
    const dateStr = format(date, "yyyy-MM-dd");
    return {
      driver_id: driverId,
      date: dateStr,
      is_available: true,
      start_time: "07:00",
      end_time: "18:00",
      vehicle_capacity: 50
    };
  };

  const updateAvailability = (driverId: string, date: Date, updates: Partial<DriverAvailability>) => {
    const dateStr = format(date, "yyyy-MM-dd");
    const key = `${driverId}-${dateStr}`;
    const existing = getAvailability(driverId, date) || getBaseAvailability(driverId, date);
    
    setPendingChanges(prev => ({
      ...prev,
      [key]: { ...existing, ...prev[key], ...updates }
    }));
  };

  const saveChanges = () => {
    const records = Object.values(pendingChanges).map(change => ({
      driver_id: change.driver_id,
      date: change.date,
      is_available: change.is_available ?? true,
      start_time: change.start_time ?? "07:00",
      end_time: change.end_time ?? "18:00",
      vehicle_capacity: change.vehicle_capacity ?? 50,
      notes: change.notes
    }));
    
    if (records.length > 0) {
      upsertMutation.mutate(records);
    }
  };

  const copyFromPreviousWeek = async () => {
    const prevWeekStart = format(addDays(weekStart, -7), "yyyy-MM-dd");
    const prevWeekEnd = format(addDays(weekStart, -1), "yyyy-MM-dd");
    
    const { data: prevWeek, error } = await supabase
      .from("driver_availability")
      .select("*")
      .gte("date", prevWeekStart)
      .lte("date", prevWeekEnd);
    
    if (error) {
      toast.error("Failed to load previous week");
      return;
    }
    
    if (!prevWeek || prevWeek.length === 0) {
      toast.info("No data from previous week to copy");
      return;
    }
    
    const newRecords = prevWeek.map(record => ({
      driver_id: record.driver_id,
      date: format(addDays(new Date(record.date), 7), "yyyy-MM-dd"),
      is_available: record.is_available,
      start_time: record.start_time,
      end_time: record.end_time,
      vehicle_capacity: record.vehicle_capacity,
      notes: record.notes
    }));
    
    upsertMutation.mutate(newRecords);
  };

  const totalDriversAvailable = (date: Date) => {
    return drivers.filter(driver => {
      const avail = getAvailability(driver.id, date);
      return avail?.is_available !== false;
    }).length;
  };

  const totalCapacity = (date: Date) => {
    return drivers.reduce((sum, driver) => {
      const avail = getAvailability(driver.id, date);
      if (avail?.is_available !== false) {
        return sum + (avail?.vehicle_capacity ?? 50);
      }
      return sum;
    }, 0);
  };

  const hasPendingChanges = Object.keys(pendingChanges).length > 0;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-6 max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Calendar className="h-6 w-6 text-primary" />
              Driver Schedule
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage driver availability and capacity for route optimization
            </p>
          </div>
          
          <div className="flex gap-2">
            <Button variant="outline" onClick={copyFromPreviousWeek} disabled={upsertMutation.isPending}>
              <Copy className="h-4 w-4 mr-2" />
              Copy Previous Week
            </Button>
            {hasPendingChanges && (
              <Button onClick={saveChanges} disabled={upsertMutation.isPending}>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </Button>
            )}
          </div>
        </div>

        {/* Week Navigation */}
        <Card className="mb-6">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="icon" onClick={() => setWeekStart(addDays(weekStart, -7))}>
                <ChevronLeft className="h-5 w-5" />
              </Button>
              
              <div className="text-center">
                <h2 className="font-semibold text-lg">
                  {format(weekStart, "MMM d")} - {format(addDays(weekStart, 6), "MMM d, yyyy")}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {drivers.length} drivers configured
                </p>
              </div>
              
              <Button variant="ghost" size="icon" onClick={() => setWeekStart(addDays(weekStart, 7))}>
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Daily Summary Cards */}
        <div className="grid grid-cols-7 gap-2 mb-6">
          {weekDays.map(day => (
            <Card 
              key={day.toISOString()} 
              className={cn(
                "text-center",
                isSameDay(day, new Date()) && "ring-2 ring-primary"
              )}
            >
              <CardContent className="py-3 px-2">
                <p className="text-xs text-muted-foreground">{format(day, "EEE")}</p>
                <p className="font-semibold">{format(day, "d")}</p>
                <div className="mt-2 space-y-1">
                  <div className="flex items-center justify-center gap-1 text-xs">
                    <Users className="h-3 w-3" />
                    <span>{totalDriversAvailable(day)}</span>
                  </div>
                  <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                    <Truck className="h-3 w-3" />
                    <span>{totalCapacity(day)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Driver Schedule Grid */}
        {drivers.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-medium text-lg mb-2">No Drivers Found</h3>
              <p className="text-muted-foreground">
                Add users with the "driver" role to manage their schedules
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {drivers.map(driver => (
              <Card key={driver.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center justify-between">
                    <span>{driver.full_name || driver.email}</span>
                    <Badge variant="outline">{driver.email}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-7 gap-2">
                    {weekDays.map(day => {
                      const avail = getAvailability(driver.id, day);
                      const isAvailable = avail?.is_available !== false;
                      const dateStr = format(day, "yyyy-MM-dd");
                      const hasChange = pendingChanges[`${driver.id}-${dateStr}`];
                      
                      return (
                        <div 
                          key={day.toISOString()}
                          className={cn(
                            "border rounded-lg p-2 space-y-2",
                            isAvailable ? "bg-green-500/10 border-green-500/30" : "bg-muted/50",
                            hasChange && "ring-2 ring-primary/50"
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium">{format(day, "EEE")}</span>
                            <Switch
                              checked={isAvailable}
                              onCheckedChange={(checked) => 
                                updateAvailability(driver.id, day, { is_available: checked })
                              }
                            />
                          </div>
                          
                          {isAvailable && (
                            <>
                              <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3 text-muted-foreground" />
                                <Input
                                  type="time"
                                  value={avail?.start_time || "07:00"}
                                  onChange={(e) => 
                                    updateAvailability(driver.id, day, { start_time: e.target.value })
                                  }
                                  className="h-6 text-xs px-1"
                                />
                              </div>
                              <div className="flex items-center gap-1">
                                <Truck className="h-3 w-3 text-muted-foreground" />
                                <Input
                                  type="number"
                                  min={1}
                                  max={200}
                                  value={avail?.vehicle_capacity ?? 50}
                                  onChange={(e) => 
                                    updateAvailability(driver.id, day, { 
                                      vehicle_capacity: parseInt(e.target.value) || 50 
                                    })
                                  }
                                  className="h-6 text-xs px-1"
                                />
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default FnbDriverSchedule;
