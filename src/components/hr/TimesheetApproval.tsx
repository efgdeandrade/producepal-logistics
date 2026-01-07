import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../integrations/supabase/client";
import { useAuth } from "../../contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Checkbox } from "../ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../ui/dialog";
import { Textarea } from "../ui/textarea";
import { toast } from "sonner";
import { format, differenceInMinutes } from "date-fns";
import { Check, X, Clock, Loader2 } from "lucide-react";
import { GPSVerificationBadge } from "./GPSVerificationBadge";

interface TimeEntry {
  id: string;
  employee_id: string;
  clock_in: string;
  clock_out: string | null;
  status: string | null;
  location_lat: number | null;
  location_lng: number | null;
  employees: {
    full_name: string;
    department: string | null;
  } | null;
}

export function TimesheetApproval() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedEntries, setSelectedEntries] = useState<string[]>([]);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [entryToReject, setEntryToReject] = useState<string | null>(null);

  const { data: pendingEntries, isLoading } = useQuery({
    queryKey: ["pending-timesheets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_entries")
        .select(`
          *,
          employees (full_name, department)
        `)
        .eq("status", "pending")
        .not("clock_out", "is", null)
        .order("clock_in", { ascending: false });

      if (error) throw error;
      return data as TimeEntry[];
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (entryIds: string[]) => {
      const { error } = await supabase
        .from("time_entries")
        .update({
          status: "approved",
          approved_by: user?.id,
        })
        .in("id", entryIds);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-timesheets"] });
      queryClient.invalidateQueries({ queryKey: ["time-entries"] });
      setSelectedEntries([]);
      toast.success("Timesheet(s) approved");
    },
    onError: () => {
      toast.error("Failed to approve timesheet(s)");
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({
      entryId,
      reason,
    }: {
      entryId: string;
      reason: string;
    }) => {
      const { error } = await supabase
        .from("time_entries")
        .update({
          status: "rejected",
          notes: reason,
        })
        .eq("id", entryId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-timesheets"] });
      queryClient.invalidateQueries({ queryKey: ["time-entries"] });
      setRejectDialogOpen(false);
      setRejectReason("");
      setEntryToReject(null);
      toast.success("Timesheet rejected");
    },
    onError: () => {
      toast.error("Failed to reject timesheet");
    },
  });

  const calculateDuration = (clockIn: string, clockOut: string | null) => {
    if (!clockOut) return "-";
    const minutes = differenceInMinutes(new Date(clockOut), new Date(clockIn));
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const toggleSelect = (id: string) => {
    setSelectedEntries((prev) =>
      prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedEntries.length === pendingEntries?.length) {
      setSelectedEntries([]);
    } else {
      setSelectedEntries(pendingEntries?.map((e) => e.id) || []);
    }
  };

  const handleReject = (entryId: string) => {
    setEntryToReject(entryId);
    setRejectDialogOpen(true);
  };

  const confirmReject = () => {
    if (entryToReject && rejectReason.trim()) {
      rejectMutation.mutate({ entryId: entryToReject, reason: rejectReason });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Pending Approvals
            {pendingEntries && pendingEntries.length > 0 && (
              <Badge variant="secondary">{pendingEntries.length}</Badge>
            )}
          </CardTitle>
          {selectedEntries.length > 0 && (
            <Button
              onClick={() => approveMutation.mutate(selectedEntries)}
              disabled={approveMutation.isPending}
            >
              <Check className="h-4 w-4 mr-2" />
              Approve Selected ({selectedEntries.length})
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {!pendingEntries || pendingEntries.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No pending timesheets to approve
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedEntries.length === pendingEntries.length}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Clock In</TableHead>
                  <TableHead>Clock Out</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedEntries.includes(entry.id)}
                        onCheckedChange={() => toggleSelect(entry.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      {entry.employees?.full_name || "Unknown"}
                    </TableCell>
                    <TableCell>{entry.employees?.department || "-"}</TableCell>
                    <TableCell>
                      {format(new Date(entry.clock_in), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>
                      {format(new Date(entry.clock_in), "h:mm a")}
                    </TableCell>
                    <TableCell>
                      {entry.clock_out
                        ? format(new Date(entry.clock_out), "h:mm a")
                        : "-"}
                    </TableCell>
                    <TableCell>
                      {calculateDuration(entry.clock_in, entry.clock_out)}
                    </TableCell>
                    <TableCell>
                      <GPSVerificationBadge
                        latitude={entry.location_lat}
                        longitude={entry.location_lng}
                        timestamp={entry.clock_in}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => approveMutation.mutate([entry.id])}
                          disabled={approveMutation.isPending}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleReject(entry.id)}
                          disabled={rejectMutation.isPending}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Timesheet</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="Enter rejection reason..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRejectDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmReject}
              disabled={!rejectReason.trim() || rejectMutation.isPending}
            >
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
