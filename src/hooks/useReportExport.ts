import { useState } from "react";
import * as XLSX from "xlsx";
import { toast } from "sonner";

export type ExportFormat = "csv" | "xlsx" | "json";

interface ExportOptions {
  filename: string;
  format: ExportFormat;
  columns?: string[];
}

interface UseReportExportReturn {
  isExporting: boolean;
  exportData: <T extends Record<string, unknown>>(data: T[], options: ExportOptions) => Promise<void>;
}

export function useReportExport(): UseReportExportReturn {
  const [isExporting, setIsExporting] = useState(false);

  const downloadFile = (content: string | Blob, filename: string, mimeType: string) => {
    const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const formatDataForExport = <T extends Record<string, unknown>>(
    data: T[],
    columns?: string[]
  ): Record<string, unknown>[] => {
    if (!columns || columns.length === 0) {
      return data;
    }
    return data.map((row) => {
      const filteredRow: Record<string, unknown> = {};
      columns.forEach((col) => {
        if (col in row) {
          filteredRow[col] = row[col];
        }
      });
      return filteredRow;
    });
  };

  const exportToCSV = (data: Record<string, unknown>[], filename: string) => {
    if (data.length === 0) {
      toast.error("No data to export");
      return;
    }

    const headers = Object.keys(data[0]);
    const csvRows = [
      headers.join(","),
      ...data.map((row) =>
        headers
          .map((header) => {
            const value = row[header];
            const stringValue = value === null || value === undefined ? "" : String(value);
            if (stringValue.includes(",") || stringValue.includes('"') || stringValue.includes("\n")) {
              return `"${stringValue.replace(/"/g, '""')}"`;
            }
            return stringValue;
          })
          .join(",")
      ),
    ];

    downloadFile(csvRows.join("\n"), `${filename}.csv`, "text/csv;charset=utf-8;");
  };

  const exportToXLSX = (data: Record<string, unknown>[], filename: string) => {
    if (data.length === 0) {
      toast.error("No data to export");
      return;
    }

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Data");

    const columnWidths = Object.keys(data[0]).map((key) => ({
      wch: Math.max(key.length, ...data.map((row) => String(row[key] ?? "").length)),
    }));
    worksheet["!cols"] = columnWidths;

    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    downloadFile(
      new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
      `${filename}.xlsx`,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
  };

  const exportToJSON = (data: Record<string, unknown>[], filename: string) => {
    if (data.length === 0) {
      toast.error("No data to export");
      return;
    }
    downloadFile(JSON.stringify(data, null, 2), `${filename}.json`, "application/json");
  };

  const exportData = async <T extends Record<string, unknown>>(
    data: T[],
    options: ExportOptions
  ): Promise<void> => {
    setIsExporting(true);
    try {
      const formattedData = formatDataForExport(data, options.columns);

      switch (options.format) {
        case "csv":
          exportToCSV(formattedData, options.filename);
          break;
        case "xlsx":
          exportToXLSX(formattedData, options.filename);
          break;
        case "json":
          exportToJSON(formattedData, options.filename);
          break;
      }

      toast.success(`Exported ${data.length} records to ${options.format.toUpperCase()}`);
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export data");
    } finally {
      setIsExporting(false);
    }
  };

  return { isExporting, exportData };
}
