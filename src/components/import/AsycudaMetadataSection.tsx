import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { FileCheck, Save, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

interface AsycudaMetadataSectionProps {
  orderId: string;
}

export function AsycudaMetadataSection({ orderId }: AsycudaMetadataSectionProps) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    declaration_no: "",
    declaration_date: "",
    duties_amount: "",
    taxes_amount: "",
    clearance_date: "",
    notes: "",
  });

  const { data: record, isLoading } = useQuery({
    queryKey: ["asycuda-record", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cif_asycuda_records")
        .select("*")
        .eq("import_order_id", orderId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (record) {
      setForm({
        declaration_no: record.declaration_no || "",
        declaration_date: record.declaration_date || "",
        duties_amount: record.duties_amount?.toString() || "",
        taxes_amount: record.taxes_amount?.toString() || "",
        clearance_date: record.clearance_date || "",
        notes: record.notes || "",
      });
    }
  }, [record]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        import_order_id: orderId,
        declaration_no: form.declaration_no || null,
        declaration_date: form.declaration_date || null,
        duties_amount: form.duties_amount ? parseFloat(form.duties_amount) : null,
        taxes_amount: form.taxes_amount ? parseFloat(form.taxes_amount) : null,
        clearance_date: form.clearance_date || null,
        notes: form.notes || null,
        updated_at: new Date().toISOString(),
      };

      if (record) {
        const { error } = await supabase
          .from("cif_asycuda_records")
          .update(payload)
          .eq("id", record.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("cif_asycuda_records")
          .insert(payload);
        if (error) throw error;
      }

      toast.success("ASYCUDA record saved");
      queryClient.invalidateQueries({ queryKey: ["asycuda-record", orderId] });
    } catch (err) {
      toast.error("Failed to save ASYCUDA record");
    } finally {
      setSaving(false);
    }
  };

  const isCleared = !!record?.clearance_date;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileCheck className="h-4 w-4" />
            ASYCUDA / Customs Declaration
            {isCleared && <Badge className="bg-green-600 text-xs">Cleared</Badge>}
          </CardTitle>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
            Save
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Declaration No.</Label>
            <Input
              value={form.declaration_no}
              onChange={e => setForm(f => ({ ...f, declaration_no: e.target.value }))}
              placeholder="e.g. IM-2026-001234"
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Declaration Date</Label>
            <Input
              type="date"
              value={form.declaration_date}
              onChange={e => setForm(f => ({ ...f, declaration_date: e.target.value }))}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Duties Amount (USD)</Label>
            <Input
              type="number"
              step="0.01"
              value={form.duties_amount}
              onChange={e => setForm(f => ({ ...f, duties_amount: e.target.value }))}
              placeholder="0.00"
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Taxes Amount (USD)</Label>
            <Input
              type="number"
              step="0.01"
              value={form.taxes_amount}
              onChange={e => setForm(f => ({ ...f, taxes_amount: e.target.value }))}
              placeholder="0.00"
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Clearance Date</Label>
            <Input
              type="date"
              value={form.clearance_date}
              onChange={e => setForm(f => ({ ...f, clearance_date: e.target.value }))}
              className="h-8 text-sm"
            />
          </div>
        </div>
        <div className="mt-4 space-y-1.5">
          <Label className="text-xs">Notes</Label>
          <Textarea
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            placeholder="Additional customs notes..."
            rows={2}
            className="text-sm"
          />
        </div>
      </CardContent>
    </Card>
  );
}
