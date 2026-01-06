import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Download, Clock, CheckSquare, MapPin } from "lucide-react";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks, subMonths } from "date-fns";
import { TimesheetApproval } from "@/components/hr/TimesheetApproval";
import { AttendanceMap } from "@/components/hr/AttendanceMap";

type DateRange = "this_week" | "last_week" | "this_month" | "last_month";

export default function Timesheets() {
  const [dateRange, setDateRange] = useState<DateRange>("this_week");
  const [filterEmployee, setFilterEmployee] = useState<string>("all");

  const getDateRange = () => {
    const now = new Date();
    switch (dateRange) {
      case "this_week":
        return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
      case "last_week":
        const lastWeek = subWeeks(now, 1);
        return { start: startOfWeek(lastWeek, { weekStartsOn: 1 }), end: endOfWeek(lastWeek, { weekStartsOn: 1 }) };
      case "this_month":
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case "last_month":
        const lastMonth = subMonths(now, 1);
        return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) };
      default:
        return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
    }
  };

  const { start, end } = getDateRange();

  // Fetch employees for filter
  const { data: employees } = useQuery({
    queryKey: ["employees-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, full_name, department")
        .eq("status", "active")
        .order("full_name");
      if (error) throw error;
      return data || [];
    }
  });

  // Fetch time entries for the selected range
  const { data: timeEntries, isLoading } = useQuery({
    queryKey: ["timesheets", dateRange, filterEmployee],
    queryFn: async () => {
      let query = supabase
        .from("time_entries")
        .select(`
          *,
          employees (
            id,
            full_name,
            department,
            hourly_rate
          )
        `)
        .gte("clock_in", start.toISOString())
        .lte("clock_in", end.toISOString())
        .not("clock_out", "is", null)
        .order("clock_in", { ascending: true });

      if (filterEmployee && filterEmployee !== "all") {
        query = query.eq("employee_id", filterEmployee);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    }
  });

  // Group entries by employee and calculate totals
  const processedData = () => {
    if (!timeEntries) return [];

    const employeeMap = new Map<string, {
      employeeId: string;
      name: string;
      department: string | null;
      hourlyRate: number | null;
      entries: any[];
      totalMinutes: number;
      totalPay: number;
    }>();

    timeEntries.forEach((entry: any) => {
      const employeeId = entry.employee_id;
      const existing = employeeMap.get(employeeId) || {
        employeeId,
        name: entry.employees?.full_name || "Unknown",
        department: entry.employees?.department,
        hourlyRate: entry.employees?.hourly_rate,
        entries: [],
        totalMinutes: 0,
        totalPay: 0
      };

      const clockIn = new Date(entry.clock_in);
      const clockOut = new Date(entry.clock_out);
      const minutes = (clockOut.getTime() - clockIn.getTime()) / (1000 * 60) - (entry.break_minutes || 0);
      
      existing.entries.push({ ...entry, minutes });
      existing.totalMinutes += minutes;
      if (existing.hourlyRate) {
        existing.totalPay += (minutes / 60) * existing.hourlyRate;
      }

      employeeMap.set(employeeId, existing);
    });

    return Array.from(employeeMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  };

  const data = processedData();
  const totalHours = data.reduce((sum, emp) => sum + emp.totalMinutes, 0) / 60;
  const totalPay = data.reduce((sum, emp) => sum + emp.totalPay, 0);

  const formatHours = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}h ${mins}m`;
  };

  const exportToCSV = () => {
    const headers = ["Employee", "Department", "Date", "Clock In", "Clock Out", "Hours", "Pay"];
    const rows = data.flatMap(emp => 
      emp.entries.map((entry: any) => [
        emp.name,
        emp.department || "",
        format(new Date(entry.clock_in), "yyyy-MM-dd"),
        format(new Date(entry.clock_in), "HH:mm"),
        format(new Date(entry.clock_out), "HH:mm"),
        (entry.minutes / 60).toFixed(2),
        emp.hourlyRate ? ((entry.minutes / 60) * emp.hourlyRate).toFixed(2) : ""
      ])
    );

    const csv = [headers, ...rows].map(row => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `timesheet-${format(start, "yyyy-MM-dd")}-${format(end, "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Timesheets</h1>
          <p className="text-muted-foreground">
            Manage employee time tracking and approvals
          </p>
        </div>
        <Button variant="outline" onClick={exportToCSV}>
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      <Tabs defaultValue="timesheets" className="space-y-4">
        <TabsList>
          <TabsTrigger value="timesheets" className="gap-2">
            <Clock className="h-4 w-4" />
            Timesheets
          </TabsTrigger>
          <TabsTrigger value="approvals" className="gap-2">
            <CheckSquare className="h-4 w-4" />
            Approvals
          </TabsTrigger>
          <TabsTrigger value="map" className="gap-2">
            <MapPin className="h-4 w-4" />
            Location Map
          </TabsTrigger>
        </TabsList>

        <TabsContent value="timesheets" className="space-y-4">
          <div className="text-sm text-muted-foreground mb-2">
            {format(start, "MMM d")} - {format(end, "MMM d, yyyy")}
          </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <Select value={dateRange} onValueChange={(v: DateRange) => setDateRange(v)}>
                <SelectTrigger>
                  <Calendar className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="this_week">This Week</SelectItem>
                  <SelectItem value="last_week">Last Week</SelectItem>
                  <SelectItem value="this_month">This Month</SelectItem>
                  <SelectItem value="last_month">Last Month</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <Select value={filterEmployee} onValueChange={setFilterEmployee}>
                <SelectTrigger>
                  <SelectValue placeholder="All Employees" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Employees</SelectItem>
                  {employees?.map(emp => (
                    <SelectItem key={emp.id} value={emp.id}>{emp.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Hours</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalHours.toFixed(1)}h</div>
            <p className="text-xs text-muted-foreground">across {data.length} employees</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Entries</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{timeEntries?.length || 0}</div>
            <p className="text-xs text-muted-foreground">completed shifts</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Estimated Pay</CardTitle>
            <span className="text-muted-foreground text-sm">$</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalPay.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">based on hourly rates</p>
          </CardContent>
        </Card>
      </div>

      {/* Timesheet Table */}
      <Card>
        <CardHeader>
          <CardTitle>Employee Timesheets</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : data.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead className="text-right">Shifts</TableHead>
                  <TableHead className="text-right">Total Hours</TableHead>
                  <TableHead className="text-right">Hourly Rate</TableHead>
                  <TableHead className="text-right">Total Pay</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((employee) => (
                  <TableRow key={employee.employeeId}>
                    <TableCell className="font-medium">{employee.name}</TableCell>
                    <TableCell>{employee.department || "-"}</TableCell>
                    <TableCell className="text-right">{employee.entries.length}</TableCell>
                    <TableCell className="text-right">{formatHours(employee.totalMinutes)}</TableCell>
                    <TableCell className="text-right">
                      {employee.hourlyRate ? `$${employee.hourlyRate.toFixed(2)}` : "-"}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {employee.hourlyRate ? `$${employee.totalPay.toFixed(2)}` : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No timesheet data for the selected period
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detailed Entries */}
        </TabsContent>

        <TabsContent value="approvals">
          <TimesheetApproval />
        </TabsContent>

        <TabsContent value="map">
          <AttendanceMap />
        </TabsContent>
      </Tabs>
    </div>
  );
}
