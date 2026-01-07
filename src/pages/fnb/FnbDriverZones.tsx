import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format, addDays, startOfWeek } from "date-fns";
import { ArrowLeft, Crown, Users, Calendar, Truck, Plus, X, Copy, ChevronLeft, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface Driver {
  id: string;
  name: string;
  email: string;
}

interface Zone {
  id: string;
  name: string;
  zone_type: "major" | "sub";
}

interface Assignment {
  id: string;
  driver_id: string;
  zone_id: string;
  date: string;
  is_primary: boolean;
}

const MAJOR_ZONE_COLORS: Record<string, string> = {
  Pariba: "bg-blue-500",
  Pabou: "bg-green-500",
  Meimei: "bg-amber-500",
};

export default function FnbDriverZones() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [weekOffset, setWeekOffset] = useState(0);
  
  const weekStart = startOfWeek(addDays(new Date(), weekOffset * 7), { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Fetch major zones
  const { data: zones = [] } = useQuery({
    queryKey: ["major-zones"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fnb_delivery_zones")
        .select("id, name, zone_type")
        .eq("zone_type", "major")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data as Zone[];
    },
  });

  // Fetch drivers
  const { data: drivers = [] } = useQuery({
    queryKey: ["drivers-for-zones"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select(`
          user_id,
          profiles!inner(id, email, full_name)
        `)
        .eq("role", "driver");
      if (error) throw error;
      return data?.map((d: any) => ({
        id: d.user_id,
        name: d.profiles.full_name || d.profiles.email.split("@")[0],
        email: d.profiles.email,
      })) as Driver[];
    },
  });

  // Fetch assignments for the week
  const { data: assignments = [] } = useQuery({
    queryKey: ["driver-zone-assignments", format(weekStart, "yyyy-MM-dd")],
    queryFn: async () => {
      const startDate = format(weekStart, "yyyy-MM-dd");
      const endDate = format(addDays(weekStart, 6), "yyyy-MM-dd");
      
      const { data, error } = await supabase
        .from("driver_zone_assignments")
        .select("*")
        .gte("date", startDate)
        .lte("date", endDate);
      if (error) throw error;
      return data as Assignment[];
    },
  });

  const assignMutation = useMutation({
    mutationFn: async ({ driver_id, zone_id, date, is_primary }: { 
      driver_id: string; 
      zone_id: string; 
      date: string;
      is_primary: boolean;
    }) => {
      const { error } = await supabase
        .from("driver_zone_assignments")
        .upsert({
          driver_id,
          zone_id,
          date,
          is_primary,
        }, {
          onConflict: "driver_id,zone_id,date"
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["driver-zone-assignments"] });
      toast.success("Assignment saved");
    },
    onError: (error) => {
      toast.error("Failed to save: " + error.message);
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("driver_zone_assignments")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["driver-zone-assignments"] });
      toast.success("Assignment removed");
    },
  });

  const copyPreviousWeek = async () => {
    const prevWeekStart = addDays(weekStart, -7);
    const prevStartDate = format(prevWeekStart, "yyyy-MM-dd");
    const prevEndDate = format(addDays(prevWeekStart, 6), "yyyy-MM-dd");

    const { data: prevAssignments } = await supabase
      .from("driver_zone_assignments")
      .select("*")
      .gte("date", prevStartDate)
      .lte("date", prevEndDate);

    if (!prevAssignments?.length) {
      toast.error("No assignments found in previous week");
      return;
    }

    // Create new assignments for current week
    const newAssignments = prevAssignments.map((a) => {
      const prevDate = new Date(a.date);
      const dayOfWeek = prevDate.getDay();
      const newDate = addDays(weekStart, dayOfWeek === 0 ? 6 : dayOfWeek - 1);
      return {
        driver_id: a.driver_id,
        zone_id: a.zone_id,
        date: format(newDate, "yyyy-MM-dd"),
        is_primary: a.is_primary,
      };
    });

    const { error } = await supabase
      .from("driver_zone_assignments")
      .upsert(newAssignments, { onConflict: "driver_id,zone_id,date" });

    if (error) {
      toast.error("Failed to copy: " + error.message);
    } else {
      queryClient.invalidateQueries({ queryKey: ["driver-zone-assignments"] });
      toast.success(`Copied ${newAssignments.length} assignments from previous week`);
    }
  };

  const getAssignmentsForCell = (zoneId: string, date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return assignments.filter((a) => a.zone_id === zoneId && a.date === dateStr);
  };

  const getDriverName = (driverId: string) => {
    return drivers.find((d) => d.id === driverId)?.name || "Unknown";
  };

  const getUnassignedDrivers = (zoneId: string, date: Date) => {
    const assigned = getAssignmentsForCell(zoneId, date).map((a) => a.driver_id);
    return drivers.filter((d) => !assigned.includes(d.id));
  };

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/fnb")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Driver Zone Assignments</h1>
              <p className="text-muted-foreground">Assign drivers to major zones by day</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={copyPreviousWeek}>
              <Copy className="h-4 w-4 mr-2" />
              Copy Previous Week
            </Button>
          </div>
        </div>

        {/* Week Navigation */}
        <Card>
          <CardContent className="py-3 px-4">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={() => setWeekOffset((w) => w - 1)}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span className="font-medium">
                  {format(weekStart, "MMM d")} - {format(addDays(weekStart, 6), "MMM d, yyyy")}
                </span>
                {weekOffset === 0 && <Badge>Current</Badge>}
              </div>
              <Button variant="ghost" size="sm" onClick={() => setWeekOffset((w) => w + 1)}>
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">{zones.length}</div>
              <div className="text-sm text-muted-foreground">Major Zones</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">{drivers.length}</div>
              <div className="text-sm text-muted-foreground">Available Drivers</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">{assignments.length}</div>
              <div className="text-sm text-muted-foreground">This Week's Assignments</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">
                {zones.length * 7 - assignments.length}
              </div>
              <div className="text-sm text-muted-foreground">Slots to Fill</div>
            </CardContent>
          </Card>
        </div>

        {/* Assignment Grid */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              Weekly Schedule
            </CardTitle>
          </CardHeader>
          <CardContent>
            {zones.length === 0 ? (
              <div className="text-center py-8">
                <Crown className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground mb-4">
                  No major zones configured. Create Pariba, Pabou, and Meimei first.
                </p>
                <Button variant="outline" onClick={() => navigate("/fnb/zones")}>
                  Go to Zone Management
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="p-2 border bg-muted text-left font-medium">Zone</th>
                      {weekDays.map((day) => (
                        <th 
                          key={day.toISOString()} 
                          className={cn(
                            "p-2 border bg-muted text-center font-medium min-w-[140px]",
                            format(day, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd") && "bg-primary/10"
                          )}
                        >
                          <div>{format(day, "EEE")}</div>
                          <div className="text-xs font-normal text-muted-foreground">{format(day, "MMM d")}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {zones.map((zone) => (
                      <tr key={zone.id}>
                        <td className="p-2 border">
                          <div className="flex items-center gap-2">
                            <div className={cn("w-3 h-3 rounded-full", MAJOR_ZONE_COLORS[zone.name] || "bg-muted")} />
                            <span className="font-medium">{zone.name}</span>
                          </div>
                        </td>
                        {weekDays.map((day) => {
                          const cellAssignments = getAssignmentsForCell(zone.id, day);
                          const unassigned = getUnassignedDrivers(zone.id, day);
                          const isToday = format(day, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");

                          return (
                            <td 
                              key={day.toISOString()} 
                              className={cn(
                                "p-2 border align-top",
                                isToday && "bg-primary/5"
                              )}
                            >
                              <div className="space-y-1 min-h-[60px]">
                                {cellAssignments.map((assignment) => (
                                  <div 
                                    key={assignment.id}
                                    className={cn(
                                      "flex items-center justify-between gap-1 px-2 py-1 rounded text-xs",
                                      assignment.is_primary ? "bg-primary/20" : "bg-muted"
                                    )}
                                  >
                                    <div className="flex items-center gap-1">
                                      {assignment.is_primary && <Crown className="h-3 w-3 text-amber-500" />}
                                      <span className="truncate">{getDriverName(assignment.driver_id)}</span>
                                    </div>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-4 w-4 shrink-0"
                                      onClick={() => removeMutation.mutate(assignment.id)}
                                    >
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </div>
                                ))}
                                
                                {unassigned.length > 0 && (
                                  <Select
                                    value=""
                                    onValueChange={(driverId) => {
                                      assignMutation.mutate({
                                        driver_id: driverId,
                                        zone_id: zone.id,
                                        date: format(day, "yyyy-MM-dd"),
                                        is_primary: cellAssignments.length === 0,
                                      });
                                    }}
                                  >
                                    <SelectTrigger className="h-6 text-xs">
                                      <Plus className="h-3 w-3 mr-1" />
                                      <span>Add driver</span>
                                    </SelectTrigger>
                                    <SelectContent>
                                      {unassigned.map((driver) => (
                                        <SelectItem key={driver.id} value={driver.id}>
                                          {driver.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                )}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Legend */}
        <div className="flex items-center gap-6 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Crown className="h-4 w-4 text-amber-500" />
            <span>Primary Driver</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-3 rounded bg-primary/20" />
            <span>Primary Assignment</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-3 rounded bg-muted" />
          <span>Backup Driver</span>
        </div>
      </div>
    </div>
  );
}
