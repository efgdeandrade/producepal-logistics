import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Skeleton } from "../ui/skeleton";
import { format, subDays, startOfDay } from "date-fns";
import { User, Clock, FileText, Phone, Mail, MapPin, Calendar } from "lucide-react";

interface Employee {
  id: string;
  employee_number: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  department: string | null;
  position: string | null;
  status: string | null;
  hire_date: string | null;
  address: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  profile_photo_url: string | null;
  hourly_rate: number | null;
}

interface EmployeeDetailDialogProps {
  employee: Employee | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EmployeeDetailDialog({ employee, open, onOpenChange }: EmployeeDetailDialogProps) {
  const [tab, setTab] = useState("info");

  // Fetch time entries for last 30 days
  const { data: timeEntries, isLoading: loadingTime } = useQuery({
    queryKey: ["employee-time-entries", employee?.id],
    queryFn: async () => {
      if (!employee?.id) return [];
      const thirtyDaysAgo = subDays(new Date(), 30).toISOString();
      
      const { data, error } = await supabase
        .from("time_entries")
        .select("*")
        .eq("employee_id", employee.id)
        .gte("clock_in", thirtyDaysAgo)
        .order("clock_in", { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!employee?.id && open
  });

  // Fetch employee documents
  const { data: documents, isLoading: loadingDocs } = useQuery({
    queryKey: ["employee-documents", employee?.id],
    queryFn: async () => {
      if (!employee?.id) return [];
      
      const { data, error } = await supabase
        .from("employee_documents")
        .select("*")
        .eq("employee_id", employee.id)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!employee?.id && open
  });

  if (!employee) return null;

  const calculateDuration = (clockIn: string, clockOut: string | null) => {
    const start = new Date(clockIn);
    const end = clockOut ? new Date(clockOut) : new Date();
    const diffMs = end.getTime() - start.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const totalHours = timeEntries?.reduce((acc, entry) => {
    if (entry.clock_out) {
      const start = new Date(entry.clock_in).getTime();
      const end = new Date(entry.clock_out).getTime();
      return acc + (end - start) / (1000 * 60 * 60);
    }
    return acc;
  }, 0) || 0;

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case "active": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      case "on_leave": return "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300";
      case "terminated": return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
      default: return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-4">
            <Avatar className="h-12 w-12">
              <AvatarImage src={employee.profile_photo_url || undefined} />
              <AvatarFallback className="bg-primary text-primary-foreground">
                {employee.full_name?.split(" ").map(n => n[0]).join("").toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-2">
                {employee.full_name}
                <Badge className={getStatusColor(employee.status)}>
                  {employee.status || "unknown"}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground font-normal">
                {employee.position} • {employee.department}
              </p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="info">
              <User className="h-4 w-4 mr-2" />
              Info
            </TabsTrigger>
            <TabsTrigger value="time">
              <Clock className="h-4 w-4 mr-2" />
              Time History
            </TabsTrigger>
            <TabsTrigger value="documents">
              <FileText className="h-4 w-4 mr-2" />
              Documents
            </TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="space-y-4 mt-4">
            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Contact Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    {employee.email || "No email"}
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    {employee.phone || "No phone"}
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    {employee.address || "No address"}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Employment Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    Hired: {employee.hire_date ? format(new Date(employee.hire_date), "MMM d, yyyy") : "N/A"}
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Employee #:</span> {employee.employee_number}
                  </div>
                  {employee.hourly_rate && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Hourly Rate:</span> ƒ{employee.hourly_rate}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="md:col-span-2">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Emergency Contact</CardTitle>
                </CardHeader>
                <CardContent className="flex gap-4">
                  <div className="text-sm">
                    <span className="text-muted-foreground">Name:</span> {employee.emergency_contact_name || "N/A"}
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Phone:</span> {employee.emergency_contact_phone || "N/A"}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="time" className="mt-4">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-sm">Last 30 Days</CardTitle>
                  <Badge variant="secondary">
                    {totalHours.toFixed(1)} hours total
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {loadingTime ? (
                  <div className="space-y-2">
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                  </div>
                ) : timeEntries && timeEntries.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Clock In</TableHead>
                        <TableHead>Clock Out</TableHead>
                        <TableHead>Duration</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {timeEntries.slice(0, 10).map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell>{format(new Date(entry.clock_in), "MMM d")}</TableCell>
                          <TableCell>{format(new Date(entry.clock_in), "h:mm a")}</TableCell>
                          <TableCell>
                            {entry.clock_out ? format(new Date(entry.clock_out), "h:mm a") : "-"}
                          </TableCell>
                          <TableCell>{calculateDuration(entry.clock_in, entry.clock_out)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-center text-muted-foreground py-4">No time entries found</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="documents" className="mt-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Employee Documents</CardTitle>
              </CardHeader>
              <CardContent>
                {loadingDocs ? (
                  <div className="space-y-2">
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                  </div>
                ) : documents && documents.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Document</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Expires</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {documents.map((doc) => (
                        <TableRow key={doc.id}>
                          <TableCell className="font-medium">{doc.title}</TableCell>
                          <TableCell>{doc.document_type}</TableCell>
                          <TableCell>
                            <Badge variant={doc.status === "approved" ? "default" : "secondary"}>
                              {doc.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {doc.expiry_date ? format(new Date(doc.expiry_date), "MMM d, yyyy") : "N/A"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-center text-muted-foreground py-4">No documents found</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}