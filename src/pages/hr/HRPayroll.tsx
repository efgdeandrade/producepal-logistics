import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign } from "lucide-react";
import { format } from "date-fns";

export default function HRPayroll() {
  const { data: records, isLoading } = useQuery({
    queryKey: ["payroll-records"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payroll_records")
        .select("*, employees(full_name)")
        .order("period_start", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
  });

  const statusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
      draft: "outline", approved: "secondary", paid: "default",
    };
    return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Payroll</h1>
        <p className="text-muted-foreground">Manage payroll records</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            Payroll Records
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : records && records.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Gross</TableHead>
                  <TableHead>Deductions</TableHead>
                  <TableHead>Net</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.employees?.full_name || "—"}</TableCell>
                    <TableCell>
                      {format(new Date(r.period_start), "MMM d")} – {format(new Date(r.period_end), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>{Number(r.gross_amount).toFixed(2)}</TableCell>
                    <TableCell>{Number(r.deductions || 0).toFixed(2)}</TableCell>
                    <TableCell className="font-semibold">{Number(r.net_amount).toFixed(2)}</TableCell>
                    <TableCell>{statusBadge(r.status)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-center text-muted-foreground py-8">No payroll records yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
