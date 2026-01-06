import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Clock, LogIn, LogOut, MapPin, Users } from "lucide-react";
import { format, startOfDay, endOfDay } from "date-fns";

export default function TimeAttendance() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const today = new Date();

  // Fetch current user's employee record
  const { data: currentEmployee } = useQuery({
    queryKey: ["current-employee", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("employees")
        .select("*")
        .eq("user_id", user.id)
        .single();
      
      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
    enabled: !!user?.id
  });

  // Fetch current user's active clock-in
  const { data: activeEntry, isLoading: loadingActive } = useQuery({
    queryKey: ["active-clock-in", currentEmployee?.id],
    queryFn: async () => {
      if (!currentEmployee?.id) return null;
      const { data, error } = await supabase
        .from("time_entries")
        .select("*")
        .eq("employee_id", currentEmployee.id)
        .is("clock_out", null)
        .order("clock_in", { ascending: false })
        .limit(1)
        .single();
      
      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
    enabled: !!currentEmployee?.id
  });

  // Fetch today's attendance for all employees
  const { data: todayAttendance, isLoading: loadingAttendance } = useQuery({
    queryKey: ["today-attendance"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_entries")
        .select(`
          *,
          employees (
            full_name,
            department,
            position
          )
        `)
        .gte("clock_in", startOfDay(today).toISOString())
        .lte("clock_in", endOfDay(today).toISOString())
        .order("clock_in", { ascending: false });
      
      if (error) throw error;
      return data || [];
    }
  });

  const clockInMutation = useMutation({
    mutationFn: async () => {
      if (!currentEmployee?.id) throw new Error("No employee record found");
      
      let locationData = {};
      
      // Try to get location
      if (navigator.geolocation) {
        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              timeout: 5000,
              enableHighAccuracy: true
            });
          });
          locationData = {
            location_lat: position.coords.latitude,
            location_lng: position.coords.longitude
          };
        } catch (e) {
          console.log("Location not available");
        }
      }

      const { error } = await supabase.from("time_entries").insert({
        employee_id: currentEmployee.id,
        clock_in: new Date().toISOString(),
        ...locationData
      });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["active-clock-in"] });
      queryClient.invalidateQueries({ queryKey: ["today-attendance"] });
      queryClient.invalidateQueries({ queryKey: ["hr-today-clock-ins"] });
      toast.success("Clocked in successfully!");
    },
    onError: (error) => {
      toast.error("Failed to clock in: " + error.message);
    }
  });

  const clockOutMutation = useMutation({
    mutationFn: async () => {
      if (!activeEntry?.id) throw new Error("No active clock-in found");
      
      const { error } = await supabase.from("time_entries")
        .update({ clock_out: new Date().toISOString() })
        .eq("id", activeEntry.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["active-clock-in"] });
      queryClient.invalidateQueries({ queryKey: ["today-attendance"] });
      queryClient.invalidateQueries({ queryKey: ["hr-today-clock-ins"] });
      toast.success("Clocked out successfully!");
    },
    onError: (error) => {
      toast.error("Failed to clock out: " + error.message);
    }
  });

  const calculateDuration = (clockIn: string, clockOut: string | null) => {
    const start = new Date(clockIn);
    const end = clockOut ? new Date(clockOut) : new Date();
    const diffMs = end.getTime() - start.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const currentlyWorking = todayAttendance?.filter(t => !t.clock_out).length || 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Time & Attendance</h1>
        <p className="text-muted-foreground">Clock in/out and view today's attendance</p>
      </div>

      {/* Current User Clock In/Out */}
      {currentEmployee ? (
        <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="text-center md:text-left">
                <h2 className="text-2xl font-bold">{currentEmployee.full_name}</h2>
                <p className="text-muted-foreground">
                  {currentEmployee.department} • {currentEmployee.position}
                </p>
                {activeEntry ? (
                  <div className="mt-2">
                    <Badge variant="default" className="bg-green-500">
                      <Clock className="h-3 w-3 mr-1" />
                      Working since {format(new Date(activeEntry.clock_in), "h:mm a")}
                    </Badge>
                    <p className="text-sm text-muted-foreground mt-1">
                      Duration: {calculateDuration(activeEntry.clock_in, null)}
                    </p>
                  </div>
                ) : (
                  <Badge variant="secondary" className="mt-2">Not clocked in</Badge>
                )}
              </div>
              
              <div className="flex flex-col gap-2">
                {activeEntry ? (
                  <Button 
                    size="lg" 
                    variant="destructive"
                    onClick={() => clockOutMutation.mutate()}
                    disabled={clockOutMutation.isPending}
                    className="min-w-[160px]"
                  >
                    <LogOut className="h-5 w-5 mr-2" />
                    Clock Out
                  </Button>
                ) : (
                  <Button 
                    size="lg" 
                    onClick={() => clockInMutation.mutate()}
                    disabled={clockInMutation.isPending}
                    className="min-w-[160px]"
                  >
                    <LogIn className="h-5 w-5 mr-2" />
                    Clock In
                  </Button>
                )}
                {activeEntry?.location_lat && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    Location captured
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">
              No employee record linked to your account. Please contact HR.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Currently Working</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{currentlyWorking}</div>
            <p className="text-xs text-muted-foreground">employees clocked in</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Entries Today</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todayAttendance?.length || 0}</div>
            <p className="text-xs text-muted-foreground">clock in/out records</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed Shifts</CardTitle>
            <LogOut className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {todayAttendance?.filter(t => t.clock_out).length || 0}
            </div>
            <p className="text-xs text-muted-foreground">employees clocked out</p>
          </CardContent>
        </Card>
      </div>

      {/* Today's Attendance Table */}
      <Card>
        <CardHeader>
          <CardTitle>Today's Attendance - {format(today, "EEEE, MMMM d, yyyy")}</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingAttendance ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : todayAttendance && todayAttendance.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Clock In</TableHead>
                  <TableHead>Clock Out</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {todayAttendance.map((entry: any) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium">
                      {entry.employees?.full_name || "Unknown"}
                    </TableCell>
                    <TableCell>{entry.employees?.department || "-"}</TableCell>
                    <TableCell>{format(new Date(entry.clock_in), "h:mm a")}</TableCell>
                    <TableCell>
                      {entry.clock_out 
                        ? format(new Date(entry.clock_out), "h:mm a")
                        : "-"
                      }
                    </TableCell>
                    <TableCell>
                      {calculateDuration(entry.clock_in, entry.clock_out)}
                    </TableCell>
                    <TableCell>
                      {entry.clock_out ? (
                        <Badge variant="secondary">Completed</Badge>
                      ) : (
                        <Badge className="bg-green-500">Working</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No attendance records for today
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
