import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { ReportChart } from "./ReportChart";
import { ExportButton } from "./ExportButton";
import { ReportVisualization } from "../../lib/reportTemplates";
import { format } from "date-fns";

interface ReportViewerProps {
  title: string;
  description?: string;
  data: Record<string, unknown>[];
  visualizations: ReportVisualization[];
  isLoading?: boolean;
}

function MetricCard({ title, value, format: formatType }: { title: string; value: unknown; format?: string }) {
  const formattedValue = useMemo(() => {
    if (value === null || value === undefined) return "—";
    if (typeof value === "number") {
      if (formatType === "currency") {
        return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      }
      if (formatType === "percent") {
        return `${value.toFixed(1)}%`;
      }
      return value.toLocaleString();
    }
    return String(value);
  }, [value, formatType]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{formattedValue}</p>
      </CardContent>
    </Card>
  );
}

function DataTable({ 
  data, 
  columns 
}: { 
  data: Record<string, unknown>[]; 
  columns?: string[];
}) {
  const displayColumns = useMemo(() => {
    if (columns && columns.length > 0) return columns;
    if (data.length === 0) return [];
    return Object.keys(data[0]).filter((key) => !key.startsWith("_"));
  }, [data, columns]);

  const getNestedValue = (obj: Record<string, unknown>, path: string): unknown => {
    return path.split(".").reduce((acc: unknown, part) => {
      if (acc && typeof acc === "object" && part in (acc as Record<string, unknown>)) {
        return (acc as Record<string, unknown>)[part];
      }
      return undefined;
    }, obj);
  };

  const formatCellValue = (value: unknown): string => {
    if (value === null || value === undefined) return "—";
    if (value instanceof Date) return format(value, "MMM d, yyyy");
    if (typeof value === "object") return JSON.stringify(value);
    if (typeof value === "boolean") return value ? "Yes" : "No";
    return String(value);
  };

  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No data available
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            {displayColumns.map((col) => (
              <TableHead key={col} className="capitalize">
                {col.replace(/_/g, " ").replace(/\./g, " ")}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row, idx) => (
            <TableRow key={idx}>
              {displayColumns.map((col) => (
                <TableCell key={col}>{formatCellValue(getNestedValue(row, col))}</TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function ReportViewer({
  title,
  description,
  data,
  visualizations,
  isLoading = false,
}: ReportViewerProps) {
  const computedMetrics = useMemo(() => {
    return visualizations
      .filter((v) => v.type === "metric")
      .map((viz) => {
        const config = viz.config as { aggregation?: string; field?: string };
        let value: unknown = 0;

        if (config.aggregation === "count") {
          value = data.length;
        } else if (config.aggregation === "sum" && config.field) {
          value = data.reduce((sum, row) => {
            const val = row[config.field as string];
            return sum + (typeof val === "number" ? val : 0);
          }, 0);
        } else if (config.aggregation === "avg" && config.field) {
          const sum = data.reduce((acc, row) => {
            const val = row[config.field as string];
            return acc + (typeof val === "number" ? val : 0);
          }, 0);
          value = data.length > 0 ? sum / data.length : 0;
        }

        return { title: viz.title, value };
      });
  }, [data, visualizations]);

  const chartVisualizations = visualizations.filter(
    (v) => v.type === "barChart" || v.type === "lineChart" || v.type === "pieChart" || v.type === "areaChart"
  );

  const tableVisualizations = visualizations.filter((v) => v.type === "table");

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/4"></div>
            <div className="h-64 bg-muted rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{title}</h2>
          {description && <p className="text-muted-foreground">{description}</p>}
        </div>
        <ExportButton data={data} filename={title.replace(/\s+/g, "-").toLowerCase()} />
      </div>

      {/* Metrics */}
      {computedMetrics.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {computedMetrics.map((metric, idx) => (
            <MetricCard key={idx} title={metric.title} value={metric.value} />
          ))}
        </div>
      )}

      {/* Charts */}
      {chartVisualizations.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {chartVisualizations.map((viz, idx) => (
            <ReportChart
              key={idx}
              type={viz.type.replace("Chart", "") as "bar" | "line" | "pie" | "area"}
              title={viz.title}
              data={data}
              config={viz.config as { xField?: string; yField?: string; labelField?: string; valueField?: string }}
            />
          ))}
        </div>
      )}

      {/* Tables */}
      {tableVisualizations.map((viz, idx) => (
        <Card key={idx}>
          <CardHeader>
            <CardTitle className="text-lg">{viz.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable data={data} columns={(viz.config as { columns?: string[] }).columns} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
