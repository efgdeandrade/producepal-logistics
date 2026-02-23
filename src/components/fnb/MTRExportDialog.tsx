import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Image,
  FileText,
  Share2,
  Download,
  ChevronDown,
  Settings2,
  TestTube,
  Loader2,
  Check,
  Wifi,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  type MTRReceiptData,
  type MTRProfile,
  type MTRGatewayConfig,
  DEFAULT_MTR_PROFILE,
  renderMTRCanvas,
  applyBWThreshold,
  mtrCanvasToPNGBlob,
  mtrCanvasToPDFBlob,
  mtrShareOrDownload,
  mtrGatewayPrint,
} from '@/utils/mtrExportEngine';

interface MTRExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  receiptData: MTRReceiptData | null;
  filename?: string;
}

const TEST_RECEIPT: MTRReceiptData = {
  storeName: 'FUIK COMPANY B.V.',
  storeAddress: 'Reigerweg 21',
  storePhone: '7363845',
  storeEmail: 'info@fuik.co',
  storeCrib: '102649479',
  title: 'TEST RECEIPT',
  date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
  dueDate: 'N/A',
  paymentTerms: 'Due on Receipt',
  customerName: 'Test Customer',
  customerAddress: '123 Sample Street, Willemstad',
  customerPhone: '555-0100',
  items: [
    { name: 'Blueberries 125g Pack Fresh Premium Quality', qty: 24, rate: 3.50, amount: 84.00, obEligible: true },
    { name: 'Little Gem Lettuce', qty: 12, rate: 2.25, amount: 27.00 },
    { name: 'Tomatoes Roma 1kg', qty: 5, rate: 4.80, amount: 24.00, obEligible: true },
    { name: 'Mixed Bell Peppers Tri-Color Pack Large', qty: 8, rate: 6.50, amount: 52.00 },
  ],
  subtotal: 187.00,
  obTax: 6.15,
  total: 187.00,
  orderRefs: ['ORD-2026-001', 'ORD-2026-002'],
  footer: 'Thank you for your business!',
};

export function MTRExportDialog({
  open,
  onOpenChange,
  receiptData,
  filename = 'receipt',
}: MTRExportDialogProps) {
  const canvasPreviewRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState<'png' | 'pdf' | 'gateway' | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [bwMode, setBwMode] = useState(true);
  const [showGateway, setShowGateway] = useState(false);
  const [gatewayConfig, setGatewayConfig] = useState<MTRGatewayConfig>({
    enabled: false,
    url: '',
    apiKey: '',
  });
  const [profile] = useState<MTRProfile>(DEFAULT_MTR_PROFILE);

  const data = receiptData || TEST_RECEIPT;
  const isTest = !receiptData;

  // Render preview canvas
  const previewCanvas = useMemo(() => {
    const c = renderMTRCanvas(data, profile);
    if (bwMode) applyBWThreshold(c);
    return c;
  }, [data, profile, bwMode]);

  // Display preview
  useEffect(() => {
    if (canvasPreviewRef.current && previewCanvas) {
      canvasPreviewRef.current.innerHTML = '';
      const display = previewCanvas.cloneNode(true) as HTMLCanvasElement;
      display.style.width = '100%';
      display.style.height = 'auto';
      display.style.imageRendering = 'pixelated';
      canvasPreviewRef.current.appendChild(display);
    }
  }, [previewCanvas]);

  const diagInfo = useMemo(() => {
    const mmToPx = (mm: number, dpi: number) => Math.round((mm / 25.4) * dpi);
    return {
      pixelWidth: mmToPx(profile.printableWidthMm, profile.dpi),
      printableWidthMm: profile.printableWidthMm,
      dpi: profile.dpi,
      canvasH: previewCanvas?.height ?? 0,
    };
  }, [profile, previewCanvas]);

  const handleExportPNG = useCallback(async () => {
    setExporting('png');
    setLastResult(null);
    try {
      const canvas = renderMTRCanvas(data, profile);
      if (bwMode) applyBWThreshold(canvas);
      const blob = await mtrCanvasToPNGBlob(canvas);
      const result = await mtrShareOrDownload(blob, `${filename}.png`, 'image/png');
      setLastResult(result === 'shared' ? 'Shared successfully!' : 'PNG downloaded');
      toast.success(result === 'shared' ? 'Receipt shared' : 'PNG downloaded');
    } catch (err: any) {
      toast.error(err.message || 'Export failed');
    } finally {
      setExporting(null);
    }
  }, [data, profile, bwMode, filename]);

  const handleExportPDF = useCallback(async () => {
    setExporting('pdf');
    setLastResult(null);
    try {
      const canvas = renderMTRCanvas(data, profile);
      if (bwMode) applyBWThreshold(canvas);
      const blob = await mtrCanvasToPDFBlob(canvas, profile);
      const result = await mtrShareOrDownload(blob, `${filename}.pdf`, 'application/pdf');
      setLastResult(result === 'shared' ? 'Shared successfully!' : 'PDF downloaded');
      toast.success(result === 'shared' ? 'Receipt shared' : 'PDF downloaded');
    } catch (err: any) {
      toast.error(err.message || 'PDF export failed');
    } finally {
      setExporting(null);
    }
  }, [data, profile, bwMode, filename]);

  const handleGatewayPrint = useCallback(async () => {
    setExporting('gateway');
    setLastResult(null);
    try {
      const canvas = renderMTRCanvas(data, profile);
      if (bwMode) applyBWThreshold(canvas);
      const result = await mtrGatewayPrint(canvas, gatewayConfig);
      if (result.ok) {
        toast.success(result.message);
        setLastResult(result.message);
      } else {
        toast.error(result.message);
      }
    } catch (err: any) {
      toast.error(err.message || 'Gateway print failed');
    } finally {
      setExporting(null);
    }
  }, [data, profile, bwMode, gatewayConfig]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Image className="h-5 w-5" />
            MTR Export
            {isTest && <Badge variant="outline" className="text-xs">Test</Badge>}
          </DialogTitle>
        </DialogHeader>

        {/* Preview */}
        <div className="flex-1 overflow-auto bg-muted/50 rounded-md p-2 min-h-[200px] max-h-[40vh]">
          <div ref={canvasPreviewRef} className="flex justify-center" />
        </div>

        {/* Diagnostics */}
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span>{diagInfo.pixelWidth}px wide</span>
          <span>•</span>
          <span>{diagInfo.printableWidthMm}mm printable</span>
          <span>•</span>
          <span>{diagInfo.dpi} DPI</span>
          <span>•</span>
          <span>{diagInfo.canvasH}px tall</span>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch checked={bwMode} onCheckedChange={setBwMode} id="bw-mode" />
            <Label htmlFor="bw-mode" className="text-sm">B/W mode</Label>
          </div>
          {lastResult && (
            <div className="flex items-center gap-1 text-sm text-primary">
              <Check className="h-3 w-3" />
              {lastResult}
            </div>
          )}
        </div>

        {/* Export Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <Button onClick={handleExportPNG} disabled={!!exporting} className="gap-2">
            {exporting === 'png' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Share2 className="h-4 w-4" />
            )}
            Share / Save PNG
          </Button>
          <Button variant="outline" onClick={handleExportPDF} disabled={!!exporting} className="gap-2">
            {exporting === 'pdf' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileText className="h-4 w-4" />
            )}
            Export PDF
          </Button>
        </div>

        {/* Gateway Section */}
        <Collapsible open={showGateway} onOpenChange={setShowGateway}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full gap-2 text-muted-foreground">
              <Settings2 className="h-4 w-4" />
              Print Gateway (optional)
              <ChevronDown className={`h-4 w-4 transition-transform ${showGateway ? 'rotate-180' : ''}`} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3 pt-2">
            <div className="flex items-center gap-2">
              <Switch
                checked={gatewayConfig.enabled}
                onCheckedChange={(v) => setGatewayConfig((p) => ({ ...p, enabled: v }))}
                id="gw-enable"
              />
              <Label htmlFor="gw-enable" className="text-sm">Enable Print Gateway</Label>
            </div>
            {gatewayConfig.enabled && (
              <>
                <div className="space-y-1">
                  <Label className="text-xs">Gateway URL</Label>
                  <Input
                    placeholder="http://192.168.x.x:PORT/print"
                    value={gatewayConfig.url}
                    onChange={(e) => setGatewayConfig((p) => ({ ...p, url: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">API Key (optional)</Label>
                  <Input
                    placeholder="Optional API key"
                    value={gatewayConfig.apiKey || ''}
                    onChange={(e) => setGatewayConfig((p) => ({ ...p, apiKey: e.target.value }))}
                  />
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleGatewayPrint}
                  disabled={!!exporting || !gatewayConfig.url}
                  className="w-full gap-2"
                >
                  {exporting === 'gateway' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Wifi className="h-4 w-4" />
                  )}
                  Send to Gateway
                </Button>
              </>
            )}
          </CollapsibleContent>
        </Collapsible>
      </DialogContent>
    </Dialog>
  );
}
