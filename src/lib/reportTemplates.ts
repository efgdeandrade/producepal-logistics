export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  category: "sales" | "operations" | "finance" | "customers" | "import";
  icon: string;
  queryConfig: {
    table: string;
    select: string;
    joins?: string[];
    defaultFilters?: Record<string, unknown>;
  };
  parameters: ReportParameter[];
  visualizations: ReportVisualization[];
}

export interface ReportParameter {
  key: string;
  label: string;
  type: "date" | "dateRange" | "select" | "multiSelect" | "text" | "number";
  required?: boolean;
  defaultValue?: unknown;
  options?: { label: string; value: string }[];
}

export interface ReportVisualization {
  type: "table" | "barChart" | "lineChart" | "pieChart" | "areaChart" | "metric";
  title: string;
  config: Record<string, unknown>;
}

export const builtInReportTemplates: ReportTemplate[] = [
  {
    id: "daily-sales-summary",
    name: "Daily Sales Summary",
    description: "Overview of daily sales including total orders, revenue, and top products",
    category: "sales",
    icon: "DollarSign",
    queryConfig: {
      table: "distribution_orders",
      select: "id, order_number, total_xcg, status, created_at, customer:distribution_customers(name)",
    },
    parameters: [
      {
        key: "date",
        label: "Date",
        type: "date",
        required: true,
        defaultValue: new Date().toISOString().split("T")[0],
      },
    ],
    visualizations: [
      {
        type: "metric",
        title: "Total Orders",
        config: { aggregation: "count" },
      },
      {
        type: "metric",
        title: "Total Revenue",
        config: { aggregation: "sum", field: "total_xcg" },
      },
      {
        type: "table",
        title: "Order Details",
        config: { columns: ["order_number", "customer.name", "total_xcg", "status"] },
      },
    ],
  },
  {
    id: "weekly-revenue-report",
    name: "Weekly Revenue Report",
    description: "Revenue trends and comparisons for the selected week",
    category: "sales",
    icon: "TrendingUp",
    queryConfig: {
      table: "distribution_orders",
      select: "id, order_number, total_xcg, status, created_at, delivery_date",
    },
    parameters: [
      {
        key: "dateRange",
        label: "Week",
        type: "dateRange",
        required: true,
      },
    ],
    visualizations: [
      {
        type: "lineChart",
        title: "Daily Revenue Trend",
        config: { xField: "created_at", yField: "total_xcg", aggregation: "sum" },
      },
      {
        type: "barChart",
        title: "Revenue by Status",
        config: { xField: "status", yField: "total_xcg", aggregation: "sum" },
      },
    ],
  },
  {
    id: "customer-order-history",
    name: "Customer Order History",
    description: "Complete order history for a specific customer",
    category: "customers",
    icon: "Users",
    queryConfig: {
      table: "distribution_orders",
      select: "id, order_number, total_xcg, status, created_at, delivery_date, items:distribution_order_items(quantity, unit_price_xcg, product:distribution_products(name))",
    },
    parameters: [
      {
        key: "customer_id",
        label: "Customer",
        type: "select",
        required: true,
      },
      {
        key: "dateRange",
        label: "Date Range",
        type: "dateRange",
        required: false,
      },
    ],
    visualizations: [
      {
        type: "metric",
        title: "Total Orders",
        config: { aggregation: "count" },
      },
      {
        type: "metric",
        title: "Total Spent",
        config: { aggregation: "sum", field: "total_xcg" },
      },
      {
        type: "table",
        title: "Order History",
        config: { columns: ["order_number", "created_at", "total_xcg", "status"] },
      },
    ],
  },
  {
    id: "delivery-performance",
    name: "Delivery Performance",
    description: "Track delivery times, on-time rates, and driver performance",
    category: "operations",
    icon: "Truck",
    queryConfig: {
      table: "distribution_orders",
      select: "id, order_number, status, created_at, delivery_date, delivered_at, driver_name",
    },
    parameters: [
      {
        key: "dateRange",
        label: "Date Range",
        type: "dateRange",
        required: true,
      },
      {
        key: "driver_id",
        label: "Driver",
        type: "select",
        required: false,
      },
    ],
    visualizations: [
      {
        type: "metric",
        title: "Total Deliveries",
        config: { aggregation: "count", filter: { status: "delivered" } },
      },
      {
        type: "barChart",
        title: "Deliveries by Driver",
        config: { xField: "driver_name", yField: "id", aggregation: "count" },
      },
      {
        type: "pieChart",
        title: "Status Distribution",
        config: { labelField: "status", valueField: "id", aggregation: "count" },
      },
    ],
  },
  {
    id: "product-sales-analysis",
    name: "Product Sales Analysis",
    description: "Analyze product performance, quantities sold, and revenue contribution",
    category: "sales",
    icon: "Package",
    queryConfig: {
      table: "distribution_order_items",
      select: "id, quantity, unit_price_xcg, total_xcg, product:distribution_products(name, code, category)",
    },
    parameters: [
      {
        key: "dateRange",
        label: "Date Range",
        type: "dateRange",
        required: true,
      },
      {
        key: "category",
        label: "Category",
        type: "select",
        required: false,
      },
    ],
    visualizations: [
      {
        type: "barChart",
        title: "Top Products by Revenue",
        config: { xField: "product.name", yField: "total_xcg", aggregation: "sum", limit: 10 },
      },
      {
        type: "table",
        title: "Product Details",
        config: { columns: ["product.name", "quantity", "total_xcg"] },
      },
    ],
  },
  {
    id: "cod-collection-report",
    name: "COD Collection Report",
    description: "Track cash-on-delivery collections and reconciliation status",
    category: "finance",
    icon: "Wallet",
    queryConfig: {
      table: "distribution_orders",
      select: "id, order_number, cod_amount_due, cod_amount_collected, cod_collected_at, cod_reconciled_at, driver_name, customer:distribution_customers(name)",
    },
    parameters: [
      {
        key: "dateRange",
        label: "Date Range",
        type: "dateRange",
        required: true,
      },
      {
        key: "reconciled",
        label: "Reconciliation Status",
        type: "select",
        options: [
          { label: "All", value: "" },
          { label: "Reconciled", value: "reconciled" },
          { label: "Pending", value: "pending" },
        ],
      },
    ],
    visualizations: [
      {
        type: "metric",
        title: "Total Due",
        config: { aggregation: "sum", field: "cod_amount_due" },
      },
      {
        type: "metric",
        title: "Total Collected",
        config: { aggregation: "sum", field: "cod_amount_collected" },
      },
      {
        type: "table",
        title: "Collection Details",
        config: { columns: ["order_number", "customer.name", "cod_amount_due", "cod_amount_collected", "driver_name"] },
      },
    ],
  },
  {
    id: "picker-productivity",
    name: "Picker Productivity Report",
    description: "Analyze picker performance, accuracy, and throughput",
    category: "operations",
    icon: "ClipboardList",
    queryConfig: {
      table: "distribution_order_items",
      select: "id, picked_quantity, quantity, picked_at, picker_name, short_quantity",
    },
    parameters: [
      {
        key: "dateRange",
        label: "Date Range",
        type: "dateRange",
        required: true,
      },
      {
        key: "picker_name",
        label: "Picker",
        type: "select",
        required: false,
      },
    ],
    visualizations: [
      {
        type: "barChart",
        title: "Items Picked by Picker",
        config: { xField: "picker_name", yField: "id", aggregation: "count" },
      },
      {
        type: "metric",
        title: "Pick Accuracy",
        config: { calculation: "accuracy" },
      },
    ],
  },
  {
    id: "zone-performance",
    name: "Zone Performance Report",
    description: "Analyze delivery zone performance and customer distribution",
    category: "operations",
    icon: "MapPin",
    queryConfig: {
      table: "distribution_customers",
      select: "id, name, delivery_zone, major_zone_id, pricing_tier_id",
    },
    parameters: [
      {
        key: "zone_id",
        label: "Zone",
        type: "select",
        required: false,
      },
    ],
    visualizations: [
      {
        type: "pieChart",
        title: "Customers by Zone",
        config: { labelField: "delivery_zone", valueField: "id", aggregation: "count" },
      },
      {
        type: "table",
        title: "Zone Details",
        config: { columns: ["delivery_zone", "customer_count"] },
      },
    ],
  },
  // Import-specific reports
  {
    id: "supplier-spend-report",
    name: "Supplier Spend Report",
    description: "Total spend by supplier with breakdown by product category and trends over time",
    category: "import",
    icon: "DollarSign",
    queryConfig: {
      table: "bills",
      select: "id, bill_number, vendor_name, vendor_id, amount, currency, bill_date, status, payment_status",
    },
    parameters: [
      {
        key: "dateRange",
        label: "Date Range",
        type: "dateRange",
        required: true,
      },
      {
        key: "vendor_id",
        label: "Supplier",
        type: "select",
        required: false,
      },
    ],
    visualizations: [
      {
        type: "metric",
        title: "Total Spend",
        config: { aggregation: "sum", field: "amount" },
      },
      {
        type: "barChart",
        title: "Spend by Supplier",
        config: { xField: "vendor_name", yField: "amount", aggregation: "sum" },
      },
      {
        type: "lineChart",
        title: "Monthly Spend Trend",
        config: { xField: "bill_date", yField: "amount", aggregation: "sum" },
      },
      {
        type: "table",
        title: "Bill Details",
        config: { columns: ["bill_number", "vendor_name", "bill_date", "amount", "status"] },
      },
    ],
  },
  {
    id: "landed-cost-analysis",
    name: "Landed Cost Analysis",
    description: "CIF breakdown showing FOB, freight, and other costs with margin analysis",
    category: "import",
    icon: "Calculator",
    queryConfig: {
      table: "cif_calculations",
      select: "id, calculation_name, calculation_type, exchange_rate, freight_exterior_per_kg, freight_local_per_kg, total_chargeable_weight, total_pallets, selected_distribution_method, created_at",
    },
    parameters: [
      {
        key: "dateRange",
        label: "Date Range",
        type: "dateRange",
        required: true,
      },
      {
        key: "calculation_type",
        label: "Calculation Type",
        type: "select",
        options: [
          { label: "All", value: "" },
          { label: "Estimate", value: "estimate" },
          { label: "Actual", value: "actual" },
        ],
      },
    ],
    visualizations: [
      {
        type: "metric",
        title: "Total Calculations",
        config: { aggregation: "count" },
      },
      {
        type: "metric",
        title: "Avg Exchange Rate",
        config: { aggregation: "avg", field: "exchange_rate" },
      },
      {
        type: "pieChart",
        title: "By Calculation Type",
        config: { labelField: "calculation_type", valueField: "id", aggregation: "count" },
      },
      {
        type: "table",
        title: "CIF Details",
        config: { columns: ["calculation_name", "calculation_type", "exchange_rate", "total_chargeable_weight", "created_at"] },
      },
    ],
  },
  {
    id: "bill-aging-report",
    name: "Bill Aging Report",
    description: "Outstanding bills by age bracket with vendor-wise breakdown",
    category: "import",
    icon: "Clock",
    queryConfig: {
      table: "bills",
      select: "id, bill_number, vendor_name, amount, currency, bill_date, due_date, payment_status, paid_amount",
    },
    parameters: [
      {
        key: "payment_status",
        label: "Payment Status",
        type: "select",
        options: [
          { label: "All", value: "" },
          { label: "Unpaid", value: "unpaid" },
          { label: "Partial", value: "partial" },
          { label: "Paid", value: "paid" },
        ],
      },
    ],
    visualizations: [
      {
        type: "metric",
        title: "Total Outstanding",
        config: { aggregation: "sum", field: "amount", filter: { payment_status: "unpaid" } },
      },
      {
        type: "barChart",
        title: "Aging by Bracket",
        config: { xField: "aging_bracket", yField: "amount", aggregation: "sum" },
      },
      {
        type: "pieChart",
        title: "By Payment Status",
        config: { labelField: "payment_status", valueField: "amount", aggregation: "sum" },
      },
      {
        type: "table",
        title: "Outstanding Bills",
        config: { columns: ["bill_number", "vendor_name", "due_date", "amount", "payment_status"] },
      },
    ],
  },
  {
    id: "shipment-status-report",
    name: "Shipment Status Report",
    description: "Track active shipments with ETD/ETA and supplier performance metrics",
    category: "import",
    icon: "Plane",
    queryConfig: {
      table: "orders",
      select: "id, status, created_at, supplier_id",
    },
    parameters: [
      {
        key: "dateRange",
        label: "Date Range",
        type: "dateRange",
        required: true,
      },
      {
        key: "status",
        label: "Status",
        type: "select",
        options: [
          { label: "All", value: "" },
          { label: "Pending", value: "pending" },
          { label: "Confirmed", value: "confirmed" },
          { label: "In Transit", value: "in_transit" },
          { label: "Delivered", value: "delivered" },
        ],
      },
    ],
    visualizations: [
      {
        type: "metric",
        title: "Total Shipments",
        config: { aggregation: "count" },
      },
      {
        type: "pieChart",
        title: "By Status",
        config: { labelField: "status", valueField: "id", aggregation: "count" },
      },
      {
        type: "table",
        title: "Shipment Details",
        config: { columns: ["id", "status", "created_at"] },
      },
    ],
  },
];

export function getTemplatesByCategory(category: string): ReportTemplate[] {
  return builtInReportTemplates.filter((t) => t.category === category);
}

export function getTemplateById(id: string): ReportTemplate | undefined {
  return builtInReportTemplates.find((t) => t.id === id);
}
