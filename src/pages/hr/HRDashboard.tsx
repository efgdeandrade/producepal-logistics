import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, Clock, FileText, AlertTriangle, Plus, UserPlus, Upload } from "lucide-react";
import { format, differenceInDays, startOfDay, endOfDay, startOfWeek, endOfWeek } from "date-fns";
import { Link } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function HRDashboard() {
  const today = new Date();
  
  // Fetch employee stats
  const { data: employeeStats, isLoading: loadingEmployees } = useQuery({
    queryKey: ["hr-employee-stats"],
    queryFn: async () => {
      const { data: employees, error } = await supabase
        .from("employees")
        .select("id, status, department");
      
      if (error) throw error;
      
      const total = employees?.length || 0;
      const active = employees?.filter(e => e.status === "active").length || 0;
      const departments = [...new Set(employees?.map(e => e.department).filter(Boolean))];
      
      return { total, active, departments: departments.length };
    }
  });

  // Fetch today's clock-ins
  const { data: todayClockIns, isLoading: loadingClockIns } = useQuery({
    queryKey: ["hr-today-clock-ins"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_entries")
        .select(`
          id,
          clock_in,
          clock_out,
          employee_id,
          employees (
            full_name,
            department
          )
        `)
        .gte("clock_in", startOfDay(today).toISOString())
        .lte("clock_in", endOfDay(today).toISOString())
        .order("clock_in", { ascending: false });
      
      if (error) throw error;
      return data || [];
    }
  });

  // Fetch pending documents
  const { data: pendingDocs, isLoading: loadingDocs } = useQuery({
    queryKey: ["hr-pending-documents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_documents")
        .select(`
          id,
          title,
          document_type,
          status,
          expiry_date,
          employee_id,
          employees (
            full_name
          )
        `)
        .or("status.eq.pending,expiry_date.lte." + format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"))
        .order("created_at", { ascending: false })
        .limit(5);
      
      if (error) throw error;
      return data || [];
    }
  });

  // Fetch week hours
  const { data: weekHours, isLoading: loadingHours } = useQuery({
    queryKey: ["hr-week-hours"],
    queryFn: async () => {
      const weekStart = startOfWeek(today, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
      
      const { data, error } = await supabase
        .from("time_entries")
        .select("clock_in, clock_out")
        .gte("clock_in", weekStart.toISOString())
        .lte("clock_in", weekEnd.toISOString())
        .not("clock_out", "is", null);
      
      if (error) throw error;
      
      let totalMinutes = 0;
      data?.forEach(entry => {
        if (entry.clock_in && entry.clock_out) {
          const diff = new Date(entry.clock_out).getTime() - new Date(entry.clock_in).getTime();
          totalMinutes += diff / (1000 * 60);
        }
      });
      
      return Math.round(totalMinutes / 60);
    }
  });

  const clockedInCount = todayClockIns?.filter(t => !t.clock_out).length || 0;
  const pendingCount = pendingDocs?.filter(d => d.status === "pending").length || 0;
  const expiringCount = pendingDocs?.filter(d => d.expiry_date && differenceInDays(new Date(d.expiry_date), today) <= 30).length || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">HR Dashboard</h1>
          <p className="text-muted-foreground">Employee management & attendance overview</p>
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <Link to="/hr/employees">
              <UserPlus className="h-4 w-4 mr-2" />
              Add Employee
            </Link>
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loadingEmployees ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold">{employeeStats?.total || 0}</div>
                <p className="text-xs text-muted-foreground">
                  {employeeStats?.active || 0} active
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clocked In Today</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loadingClockIns ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold">{clockedInCount}</div>
                <p className="text-xs text-muted-foreground">
                  {todayClockIns?.length || 0} total entries today
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Reviews</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loadingDocs ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold">{pendingCount}</div>
                <p className="text-xs text-muted-foreground">
                  documents awaiting approval
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Hours This Week</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loadingHours ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold">{weekHours || 0}h</div>
                <p className="text-xs text-muted-foreground">
                  total logged hours
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <Button variant="outline" className="h-20 flex-col" asChild>
              <Link to="/hr/attendance">
                <Clock className="h-6 w-6 mb-2" />
                Clock In/Out
              </Link>
            </Button>
            <Button variant="outline" className="h-20 flex-col" asChild>
              <Link to="/hr/employees">
                <UserPlus className="h-6 w-6 mb-2" />
                Add Employee
              </Link>
            </Button>
            <Button variant="outline" className="h-20 flex-col" asChild>
              <Link to="/hr/documents">
                <Upload className="h-6 w-6 mb-2" />
                Upload Document
              </Link>
            </Button>
            <Button variant="outline" className="h-20 flex-col" asChild>
              <Link to="/hr/timesheets">
                <FileText className="h-6 w-6 mb-2" />
                View Timesheets
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Today's Attendance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Today's Attendance
              <Button variant="ghost" size="sm" asChild>
                <Link to="/hr/attendance">View All</Link>
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingClockIns ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : todayClockIns && todayClockIns.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Clock In</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {todayClockIns.slice(0, 5).map((entry: any) => (
                    <TableRow key={entry.id}>
                      <TableCell className="font-medium">
                        {entry.employees?.full_name || "Unknown"}
                      </TableCell>
                      <TableCell>
                        {format(new Date(entry.clock_in), "h:mm a")}
                      </TableCell>
                      <TableCell>
                        {entry.clock_out ? (
                          <Badge variant="secondary">Clocked Out</Badge>
                        ) : (
                          <Badge variant="default" className="bg-green-500">Working</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-center text-muted-foreground py-4">
                No clock-ins today
              </p>
            )}
          </CardContent>
        </Card>

        {/* Expiring Documents */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                Document Alerts
                {expiringCount > 0 && (
                  <Badge variant="destructive">{expiringCount}</Badge>
                )}
              </span>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/hr/documents">View All</Link>
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingDocs ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : pendingDocs && pendingDocs.length > 0 ? (
              <div className="space-y-3">
                {pendingDocs.map((doc: any) => {
                  const daysUntilExpiry = doc.expiry_date 
                    ? differenceInDays(new Date(doc.expiry_date), today)
                    : null;
                  
                  return (
                    <div key={doc.id} className="flex items-center justify-between p-3 rounded-lg border">
                      <div>
                        <p className="font-medium text-sm">{doc.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {doc.employees?.full_name} • {doc.document_type}
                        </p>
                      </div>
                      <div className="text-right">
                        {doc.status === "pending" && (
                          <Badge variant="outline">Pending Review</Badge>
                        )}
                        {daysUntilExpiry !== null && daysUntilExpiry <= 30 && (
                          <Badge variant={daysUntilExpiry <= 0 ? "destructive" : "secondary"}>
                            {daysUntilExpiry <= 0 
                              ? "Expired" 
                              : `Expires in ${daysUntilExpiry}d`
                            }
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-4">
                No pending documents or alerts
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
