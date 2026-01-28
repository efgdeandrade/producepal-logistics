import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { format, differenceInDays, isPast } from "date-fns";
import { 
  Receipt, 
  DollarSign, 
  Clock, 
  CheckCircle, 
  Plus, 
  MoreHorizontal,
  Pencil,
  Trash2,
  CreditCard,
  AlertTriangle
} from "lucide-react";
import { AddBillDialog } from "@/components/import/AddBillDialog";
import { useToast } from "@/hooks/use-toast";

interface Bill {
  id: string;
  bill_number: string;
  vendor_id: string | null;
  vendor_name: string;
  bill_date: string;
  due_date: string | null;
  amount: number;
  currency: string;
  status: string;
  payment_status: string;
  notes: string | null;
}

export default function ImportBills() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editBill, setEditBill] = useState<Bill | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [billToDelete, setBillToDelete] = useState<Bill | null>(null);

  const { data: bills, isLoading } = useQuery({
    queryKey: ["import-bills"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bills")
        .select("*")
        .order("bill_date", { ascending: false });
      if (error) throw error;
      return data as Bill[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("bills").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Bill deleted successfully" });
      queryClient.invalidateQueries({ queryKey: ["import-bills"] });
      setDeleteDialogOpen(false);
      setBillToDelete(null);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const markAsPaidMutation = useMutation({
    mutationFn: async (bill: Bill) => {
      const { error } = await supabase
        .from("bills")
        .update({ 
          payment_status: "paid", 
          paid_date: new Date().toISOString().split("T")[0],
          paid_amount: bill.amount
        })
        .eq("id", bill.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Bill marked as paid" });
      queryClient.invalidateQueries({ queryKey: ["import-bills"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Calculate stats
  const stats = {
    total: bills?.length || 0,
    pending: bills?.filter(b => b.status === 'pending').length || 0,
    approved: bills?.filter(b => b.status === 'approved').length || 0,
    totalAmount: bills?.reduce((sum, b) => sum + (b.amount || 0), 0) || 0,
    unpaid: bills?.filter(b => b.payment_status === 'unpaid').length || 0,
    paid: bills?.filter(b => b.payment_status === 'paid').length || 0,
  };

  // Calculate aging buckets
  const getAgingBuckets = () => {
    const now = new Date();
    const buckets = { current: 0, days1_30: 0, days31_60: 0, days60plus: 0 };
    
    bills?.forEach(bill => {
      if (bill.payment_status === 'paid') return;
      if (!bill.due_date) return;
      
      const dueDate = new Date(bill.due_date);
      if (!isPast(dueDate)) {
        buckets.current += bill.amount;
      } else {
        const daysOverdue = differenceInDays(now, dueDate);
        if (daysOverdue <= 30) buckets.days1_30 += bill.amount;
        else if (daysOverdue <= 60) buckets.days31_60 += bill.amount;
        else buckets.days60plus += bill.amount;
      }
    });
    
    return buckets;
  };

  const aging = getAgingBuckets();

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-500">Approved</Badge>;
      case 'pending':
        return <Badge variant="secondary">Pending</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPaymentBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-emerald-500">Paid</Badge>;
      case 'partial':
        return <Badge className="bg-amber-500">Partial</Badge>;
      case 'unpaid':
        return <Badge variant="outline">Unpaid</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const isOverdue = (bill: Bill) => {
    if (bill.payment_status === 'paid') return false;
    if (!bill.due_date) return false;
    return isPast(new Date(bill.due_date));
  };

  const handleEdit = (bill: Bill) => {
    setEditBill(bill);
    setDialogOpen(true);
  };

  const handleDelete = (bill: Bill) => {
    setBillToDelete(bill);
    setDeleteDialogOpen(true);
  };

  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open);
    if (!open) setEditBill(null);
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Supplier Bills</h1>
          <p className="text-muted-foreground">Track and manage supplier invoices and expenses</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Bill
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Bills</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">{stats.unpaid} unpaid</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Approval</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pending}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Paid</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.paid}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Amount</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${stats.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Aging Report */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Bill Aging Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">Current (Not Due)</p>
              <p className="text-2xl font-bold text-green-600">
                ${aging.current.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">1-30 Days Overdue</p>
              <p className="text-2xl font-bold text-amber-600">
                ${aging.days1_30.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">31-60 Days Overdue</p>
              <p className="text-2xl font-bold text-orange-600">
                ${aging.days31_60.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">60+ Days Overdue</p>
              <p className="text-2xl font-bold text-red-600">
                ${aging.days60plus.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bills Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Bills</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center py-8 text-muted-foreground">Loading...</p>
          ) : bills && bills.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bill #</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bills.map((bill) => (
                  <TableRow key={bill.id} className={isOverdue(bill) ? "bg-red-50 dark:bg-red-950/20" : ""}>
                    <TableCell className="font-medium">
                      {bill.bill_number}
                      {isOverdue(bill) && (
                        <AlertTriangle className="inline-block ml-2 h-4 w-4 text-red-500" />
                      )}
                    </TableCell>
                    <TableCell>{bill.vendor_name}</TableCell>
                    <TableCell>{format(new Date(bill.bill_date), "MMM d, yyyy")}</TableCell>
                    <TableCell>
                      {bill.due_date ? format(new Date(bill.due_date), "MMM d, yyyy") : "-"}
                    </TableCell>
                    <TableCell>{getStatusBadge(bill.status)}</TableCell>
                    <TableCell>{getPaymentBadge(bill.payment_status || 'unpaid')}</TableCell>
                    <TableCell className="text-right">
                      {bill.currency} {bill.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(bill)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          {bill.payment_status !== 'paid' && (
                            <DropdownMenuItem onClick={() => markAsPaidMutation.mutate(bill)}>
                              <CreditCard className="mr-2 h-4 w-4" />
                              Mark as Paid
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem 
                            onClick={() => handleDelete(bill)}
                            className="text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Receipt className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No bills found</p>
              <p className="text-sm">Add your first supplier bill to get started</p>
              <Button className="mt-4" onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Bill
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <AddBillDialog 
        open={dialogOpen} 
        onOpenChange={handleDialogClose}
        editBill={editBill}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Bill</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete bill {billToDelete?.bill_number}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => billToDelete && deleteMutation.mutate(billToDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
