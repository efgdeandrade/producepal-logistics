import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertCircle, CheckCircle2, Edit, Save, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CifReadinessCheckerProps {
  orderId: string;
  onReady?: () => void;
}

interface ReadinessIssue {
  productCode: string;
  productName: string;
  productId: string;
  missingFields: string[];
  currentValues: Record<string, number | null>;
}

const REQUIRED_FIELDS = [
  { key: "pack_size", label: "Case Pack", dbField: "pack_size" },
  { key: "weight", label: "Weight (g)", dbField: "weight" },
  { key: "length_cm", label: "Length (cm)", dbField: "length_cm" },
  { key: "width_cm", label: "Width (cm)", dbField: "width_cm" },
  { key: "height_cm", label: "Height (cm)", dbField: "height_cm" },
];

const COST_FIELDS = [
  { key: "supplier_cost", label: "Supplier Cost USD/Case", source: "line_or_product" },
];

export function CifReadinessChecker({ orderId, onReady }: CifReadinessCheckerProps) {
  const queryClient = useQueryClient();
  const [editingProduct, setEditingProduct] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const { data: readiness, isLoading, refetch } = useQuery({
    queryKey: ["cif-readiness", orderId],
    queryFn: async () => {
      // Get order items with product details
      const { data: items, error } = await supabase
        .from("order_items")
        .select("id, product_code, quantity, supplier_cost_usd_per_case")
        .eq("order_id", orderId)
        .gt("quantity", 0);
      if (error) throw error;

      // Get unique product codes
      const codes = [...new Set(items.map(i => i.product_code))];
      
      const { data: products, error: pErr } = await supabase
        .from("products")
        .select("id, code, name, pack_size, weight, length_cm, width_cm, height_cm, price_usd, price_usd_per_unit")
        .in("code", codes);
      if (pErr) throw pErr;

      const productMap = new Map(products?.map(p => [p.code, p]) || []);
      const issues: ReadinessIssue[] = [];

      for (const code of codes) {
        const prod = productMap.get(code);
        if (!prod) {
          issues.push({
            productCode: code,
            productName: code,
            productId: "",
            missingFields: ["Product not found in database"],
            currentValues: {},
          });
          continue;
        }

        const missing: string[] = [];
        const vals: Record<string, number | null> = {};

        for (const f of REQUIRED_FIELDS) {
          const val = prod[f.dbField as keyof typeof prod];
          vals[f.key] = val != null ? Number(val) : null;
          if (val == null || Number(val) <= 0) {
            missing.push(f.label);
          }
        }

        // Check supplier cost
        const lineItem = items.find(i => i.product_code === code);
        const lineCost = lineItem?.supplier_cost_usd_per_case;
        const prodCostPerCase = prod.price_usd_per_unit != null && prod.pack_size
          ? Number(prod.price_usd_per_unit) * prod.pack_size
          : prod.price_usd != null ? Number(prod.price_usd) : null;
        
        vals["supplier_cost"] = lineCost != null ? Number(lineCost) : prodCostPerCase;
        if (vals["supplier_cost"] == null || vals["supplier_cost"] <= 0) {
          missing.push("Supplier Cost USD/Case");
        }

        if (missing.length > 0) {
          issues.push({
            productCode: code,
            productName: prod.name,
            productId: prod.id,
            missingFields: missing,
            currentValues: vals,
          });
        }
      }

      return { issues, totalProducts: codes.length, readyCount: codes.length - issues.length };
    },
  });

  const isReady = readiness && readiness.issues.length === 0;

  const handleStartEdit = (issue: ReadinessIssue) => {
    setEditingProduct(issue.productCode);
    const vals: Record<string, string> = {};
    for (const f of REQUIRED_FIELDS) {
      vals[f.key] = issue.currentValues[f.key]?.toString() || "";
    }
    vals["supplier_cost"] = issue.currentValues["supplier_cost"]?.toString() || "";
    setEditValues(vals);
  };

  const handleSave = async (issue: ReadinessIssue) => {
    if (!issue.productId) {
      toast.error("Cannot update: product not found in database");
      return;
    }
    setSaving(true);
    try {
      // Update product fields
      const productUpdate: Record<string, number> = {};
      for (const f of REQUIRED_FIELDS) {
        const val = parseFloat(editValues[f.key]);
        if (!isNaN(val) && val > 0) {
          productUpdate[f.dbField] = val;
        }
      }

      if (Object.keys(productUpdate).length > 0) {
        const { error } = await supabase
          .from("products")
          .update(productUpdate)
          .eq("id", issue.productId);
        if (error) throw error;
      }

      // Update supplier cost on order_items if provided
      const costVal = parseFloat(editValues["supplier_cost"]);
      if (!isNaN(costVal) && costVal > 0) {
        const { error } = await supabase
          .from("order_items")
          .update({ supplier_cost_usd_per_case: costVal })
          .eq("order_id", orderId)
          .eq("product_code", issue.productCode);
        if (error) throw error;
      }

      setEditingProduct(null);
      toast.success(`Updated ${issue.productCode}`);
      refetch();
      queryClient.invalidateQueries({ queryKey: ["order-items-cif", orderId] });
    } catch (err) {
      console.error(err);
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Checking CIF readiness...</div>;
  }

  if (!readiness) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          {isReady ? (
            <>
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              CIF Ready — All {readiness.totalProducts} products have required data
            </>
          ) : (
            <>
              <AlertCircle className="h-5 w-5 text-amber-500" />
              CIF Readiness: {readiness.readyCount}/{readiness.totalProducts} products ready
            </>
          )}
        </CardTitle>
      </CardHeader>
      {!isReady && (
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Missing Fields</TableHead>
                {REQUIRED_FIELDS.map(f => (
                  <TableHead key={f.key} className="text-right text-xs">{f.label}</TableHead>
                ))}
                <TableHead className="text-right text-xs">Cost/Case</TableHead>
                <TableHead className="w-[80px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {readiness.issues.map(issue => (
                <TableRow key={issue.productCode}>
                  <TableCell>
                    <div className="font-medium text-sm">{issue.productCode}</div>
                    <div className="text-xs text-muted-foreground">{issue.productName}</div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {issue.missingFields.map(f => (
                        <Badge key={f} variant="destructive" className="text-xs">{f}</Badge>
                      ))}
                    </div>
                  </TableCell>
                  {REQUIRED_FIELDS.map(f => (
                    <TableCell key={f.key} className="text-right">
                      {editingProduct === issue.productCode ? (
                        <Input
                          type="number"
                          step="any"
                          className="h-7 w-20 text-right text-xs"
                          value={editValues[f.key] || ""}
                          onChange={e => setEditValues(prev => ({ ...prev, [f.key]: e.target.value }))}
                        />
                      ) : (
                        <span className={`text-xs ${issue.currentValues[f.key] == null || issue.currentValues[f.key]! <= 0 ? 'text-destructive font-semibold' : ''}`}>
                          {issue.currentValues[f.key] ?? "—"}
                        </span>
                      )}
                    </TableCell>
                  ))}
                  <TableCell className="text-right">
                    {editingProduct === issue.productCode ? (
                      <Input
                        type="number"
                        step="any"
                        className="h-7 w-20 text-right text-xs"
                        value={editValues["supplier_cost"] || ""}
                        onChange={e => setEditValues(prev => ({ ...prev, supplier_cost: e.target.value }))}
                        placeholder="USD"
                      />
                    ) : (
                      <span className={`text-xs ${issue.currentValues["supplier_cost"] == null || issue.currentValues["supplier_cost"]! <= 0 ? 'text-destructive font-semibold' : ''}`}>
                        {issue.currentValues["supplier_cost"] != null ? `$${Number(issue.currentValues["supplier_cost"]).toFixed(2)}` : "—"}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {editingProduct === issue.productCode ? (
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleSave(issue)} disabled={saving}>
                          <Save className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingProduct(null)}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleStartEdit(issue)} disabled={!issue.productId}>
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {isReady && onReady && (
            <div className="mt-3 text-center">
              <Button onClick={onReady}>Proceed to Compute CIF</Button>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
