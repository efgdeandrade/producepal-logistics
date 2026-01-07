import { useState } from "react";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Download, FileSpreadsheet, FileJson, FileText, Loader2 } from "lucide-react";
import { useReportExport, ExportFormat } from "../../hooks/useReportExport";

interface ExportButtonProps<T extends Record<string, unknown>> {
  data: T[];
  filename: string;
  columns?: string[];
  disabled?: boolean;
  variant?: "default" | "outline" | "secondary" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
}

export function ExportButton<T extends Record<string, unknown>>({
  data,
  filename,
  columns,
  disabled = false,
  variant = "outline",
  size = "default",
}: ExportButtonProps<T>) {
  const { isExporting, exportData } = useReportExport();
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat | null>(null);

  const handleExport = async (format: ExportFormat) => {
    setSelectedFormat(format);
    await exportData(data, { filename, format, columns });
    setSelectedFormat(null);
  };

  const formatOptions = [
    { format: "xlsx" as ExportFormat, label: "Excel (.xlsx)", icon: FileSpreadsheet },
    { format: "csv" as ExportFormat, label: "CSV (.csv)", icon: FileText },
    { format: "json" as ExportFormat, label: "JSON (.json)", icon: FileJson },
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size} disabled={disabled || isExporting || data.length === 0}>
          {isExporting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          {size === "icon" ? null : "Export"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {formatOptions.map(({ format, label, icon: Icon }) => (
          <DropdownMenuItem
            key={format}
            onClick={() => handleExport(format)}
            disabled={isExporting}
          >
            {selectedFormat === format ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Icon className="mr-2 h-4 w-4" />
            )}
            {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
