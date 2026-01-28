import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";

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

interface AddBillDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editBill?: Bill | null;
}

export function AddBillDialog({ open, onOpenChange, editBill }: AddBillDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    bill_number: editBill?.bill_number || "",
    vendor_id: editBill?.vendor_id || "",
    vendor_name: editBill?.vendor_name || "",
    bill_date: editBill?.bill_date || new Date().toISOString().split("T")[0],
    due_date: editBill?.due_date || "",
    amount: editBill?.amount?.toString() || "",
    currency: editBill?.currency || "USD",
    status: editBill?.status || "pending",
    payment_status: editBill?.payment_status || "unpaid",
    notes: editBill?.notes || "",
  });

  const { data: suppliers } = useQuery({
    queryKey: ["suppliers-for-bills"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const selectedSupplier = suppliers?.find(s => s.id === formData.vendor_id);
      
      const billData = {
        bill_number: formData.bill_number,
        vendor_id: formData.vendor_id || null,
        vendor_name: selectedSupplier?.name || formData.vendor_name,
        bill_date: formData.bill_date,
        due_date: formData.due_date || null,
        amount: parseFloat(formData.amount) || 0,
        currency: formData.currency,
        status: formData.status,
        payment_status: formData.payment_status,
        notes: formData.notes || null,
      };

      if (editBill) {
        const { error } = await supabase
          .from("bills")
          .update(billData)
          .eq("id", editBill.id);
        if (error) throw error;
        toast({ title: "Bill updated successfully" });
      } else {
        const { error } = await supabase.from("bills").insert(billData);
        if (error) throw error;
        toast({ title: "Bill created successfully" });
      }

      queryClient.invalidateQueries({ queryKey: ["import-bills"] });
      onOpenChange(false);
      resetForm();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      bill_number: "",
      vendor_id: "",
      vendor_name: "",
      bill_date: new Date().toISOString().split("T")[0],
      due_date: "",
      amount: "",
      currency: "USD",
      status: "pending",
      payment_status: "unpaid",
      notes: "",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{editBill ? "Edit Bill" : "Add New Bill"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="bill_number">Bill Number *</Label>
              <Input
                id="bill_number"
                value={formData.bill_number}
                onChange={(e) => setFormData({ ...formData, bill_number: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Select
                value={formData.currency}
                onValueChange={(value) => setFormData({ ...formData, currency: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="XCG">XCG</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="vendor_id">Supplier</Label>
            <Select
              value={formData.vendor_id}
              onValueChange={(value) => setFormData({ ...formData, vendor_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a supplier" />
              </SelectTrigger>
              <SelectContent>
                {suppliers?.map((supplier) => (
                  <SelectItem key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="bill_date">Bill Date *</Label>
              <Input
                id="bill_date"
                type="date"
                value={formData.bill_date}
                onChange={(e) => setFormData({ ...formData, bill_date: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="due_date">Due Date</Label>
              <Input
                id="due_date"
                type="date"
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Amount *</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="status">Approval Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="payment_status">Payment Status</Label>
              <Select
                value={formData.payment_status}
                onValueChange={(value) => setFormData({ ...formData, payment_status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unpaid">Unpaid</SelectItem>
                  <SelectItem value="partial">Partial</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : editBill ? "Update Bill" : "Create Bill"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
