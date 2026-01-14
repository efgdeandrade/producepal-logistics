import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ReportRequest {
  templateId?: string;
  reportType: string;
  parameters: Record<string, unknown>;
  format?: "json" | "csv";
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const startTime = Date.now();
    const body: ReportRequest = await req.json();
    const { templateId, reportType, parameters, format = "json" } = body;

    console.log(`Generating report: ${reportType}`, { templateId, parameters });

    let data: unknown[] = [];
    let error: unknown = null;

    // Generate report based on type
    switch (reportType) {
      case "daily-sales-summary": {
        const date = parameters.date as string || new Date().toISOString().split("T")[0];
        const result = await supabase
          .from("distribution_orders")
          .select("id, order_number, total_xcg, status, created_at, customer:distribution_customers(name)")
          .gte("created_at", `${date}T00:00:00`)
          .lte("created_at", `${date}T23:59:59`)
          .order("created_at", { ascending: false });
        
        data = result.data || [];
        error = result.error;
        break;
      }

      case "weekly-revenue-report": {
        const { startDate, endDate } = parameters as { startDate: string; endDate: string };
        const result = await supabase
          .from("distribution_orders")
          .select("id, order_number, total_xcg, status, created_at, delivery_date")
          .gte("created_at", startDate)
          .lte("created_at", endDate)
          .order("created_at", { ascending: true });
        
        data = result.data || [];
        error = result.error;
        break;
      }

      case "customer-order-history": {
        const customerId = parameters.customer_id as string;
        const result = await supabase
          .from("distribution_orders")
          .select("id, order_number, total_xcg, status, created_at, delivery_date")
          .eq("customer_id", customerId)
          .order("created_at", { ascending: false })
          .limit(100);
        
        data = result.data || [];
        error = result.error;
        break;
      }

      case "delivery-performance": {
        const { startDate, endDate, driverId } = parameters as { 
          startDate: string; 
          endDate: string; 
          driverId?: string;
        };
        
        let query = supabase
          .from("distribution_orders")
          .select("id, order_number, status, created_at, delivery_date, delivered_at, driver_name")
          .gte("created_at", startDate)
          .lte("created_at", endDate);
        
        if (driverId) {
          query = query.eq("driver_id", driverId);
        }
        
        const result = await query.order("created_at", { ascending: false });
        data = result.data || [];
        error = result.error;
        break;
      }

      case "product-sales-analysis": {
        const { startDate, endDate } = parameters as { startDate: string; endDate: string };
        const result = await supabase
          .from("distribution_order_items")
          .select(`
            id, 
            quantity, 
            unit_price_xcg, 
            total_xcg,
            product:distribution_products(name, code, category),
            order:distribution_orders(created_at)
          `)
          .gte("order.created_at", startDate)
          .lte("order.created_at", endDate);
        
        data = result.data || [];
        error = result.error;
        break;
      }

      case "cod-collection-report": {
        const { startDate, endDate } = parameters as { startDate: string; endDate: string };
        const result = await supabase
          .from("distribution_orders")
          .select(`
            id, 
            order_number, 
            cod_amount_due, 
            cod_amount_collected, 
            cod_collected_at, 
            cod_reconciled_at, 
            driver_name,
            customer:distribution_customers(name)
          `)
          .gte("created_at", startDate)
          .lte("created_at", endDate)
          .not("cod_amount_due", "is", null);
        
        data = result.data || [];
        error = result.error;
        break;
      }

      default:
        return new Response(
          JSON.stringify({ error: `Unknown report type: ${reportType}` }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
    }

    if (error) {
      console.error("Report generation error:", error);
      return new Response(JSON.stringify({ error: "Failed to generate report", details: error }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const executionTime = Date.now() - startTime;

    // Log execution
    await supabase.from("report_executions").insert({
      report_id: templateId,
      status: "completed",
      execution_time_ms: executionTime,
      metadata: { 
        report_type: reportType, 
        parameters, 
        record_count: data.length 
      },
    });

    console.log(`Report generated successfully: ${data.length} records in ${executionTime}ms`);

    // Format response
    if (format === "csv") {
      if (data.length === 0) {
        return new Response("No data", {
          headers: { 
            ...corsHeaders, 
            "Content-Type": "text/csv",
            "Content-Disposition": `attachment; filename="${reportType}.csv"`,
          },
        });
      }

      const headers = Object.keys(data[0] as Record<string, unknown>);
      const csvRows = [
        headers.join(","),
        ...data.map((row) =>
          headers
            .map((h) => {
              const value = (row as Record<string, unknown>)[h];
              const stringValue = value === null || value === undefined 
                ? "" 
                : typeof value === "object" 
                  ? JSON.stringify(value) 
                  : String(value);
              return stringValue.includes(",") ? `"${stringValue}"` : stringValue;
            })
            .join(",")
        ),
      ];

      return new Response(csvRows.join("\n"), {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="${reportType}.csv"`,
        },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        data,
        metadata: {
          reportType,
          recordCount: data.length,
          executionTimeMs: executionTime,
          generatedAt: new Date().toISOString(),
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Generate report error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(err) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
