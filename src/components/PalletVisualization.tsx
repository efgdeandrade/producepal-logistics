import { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Package, Layers, Weight, TrendingUp, Box } from 'lucide-react';
import { OrderPalletConfig, SupplierPalletConfig } from '@/lib/weightCalculations';

interface PalletVisualizationProps {
  palletConfig: OrderPalletConfig | null;
}

export const PalletVisualization = ({ palletConfig }: PalletVisualizationProps) => {
  const canvasRefs = useRef<{ [key: string]: HTMLCanvasElement | null }>({});
  const [selectedSupplier, setSelectedSupplier] = useState<string>('overview');

  useEffect(() => {
    if (!palletConfig) return;
    
    // Draw overview
    const overviewCanvas = canvasRefs.current['overview'];
    if (overviewCanvas) {
      drawPalletOverview(overviewCanvas, palletConfig);
    }

    // Draw each supplier's pallets
    palletConfig.supplierConfigs.forEach((config) => {
      const canvas = canvasRefs.current[config.supplierId];
      if (canvas) {
        drawSupplierPallet(canvas, config);
      }
    });
  }, [palletConfig]);

  const drawPalletOverview = (canvas: HTMLCanvasElement, config: OrderPalletConfig) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 800;
    canvas.height = 400;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Background
    ctx.fillStyle = 'hsl(var(--muted))';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const palletWidth = 80;
    const palletDepth = 50;
    const spacing = 20;
    const startX = 50;
    let startY = 200;

    let currentX = startX;

    config.supplierConfigs.forEach((supplier, idx) => {
      const colors = [
        'hsl(var(--primary))',
        'hsl(var(--secondary))',
        'hsl(var(--accent))',
        'hsl(220, 70%, 50%)',
        'hsl(280, 70%, 50%)',
      ];
      const color = colors[idx % colors.length];

      for (let i = 0; i < supplier.pallets; i++) {
        // Draw simple 3D pallet representation
        const height = 60;
        
        // Pallet base
        ctx.fillStyle = 'hsl(30, 40%, 40%)';
        drawIsometricBox(ctx, currentX, startY, palletWidth, palletDepth, 10);
        
        // Cargo on pallet
        ctx.fillStyle = color;
        drawIsometricBox(ctx, currentX + 5, startY - 10, palletWidth - 10, palletDepth - 10, height);
        
        // Weight label
        ctx.fillStyle = 'hsl(var(--foreground))';
        ctx.font = 'bold 10px sans-serif';
        const weight = (supplier.totalChargeableWeight / supplier.pallets).toFixed(0);
        ctx.fillText(`${weight}kg`, currentX + palletWidth/2 - 15, startY - height - 5);
        
        currentX += palletWidth + spacing;

        // Wrap to next row if needed
        if (currentX > canvas.width - palletWidth - 50) {
          currentX = startX;
          startY += 150;
        }
      }
    });

    // Legend
    ctx.fillStyle = 'hsl(var(--foreground))';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText('Pallet Configuration Overview', 20, 30);
    
    let legendY = 60;
    config.supplierConfigs.forEach((supplier, idx) => {
      const colors = [
        'hsl(var(--primary))',
        'hsl(var(--secondary))',
        'hsl(var(--accent))',
        'hsl(220, 70%, 50%)',
        'hsl(280, 70%, 50%)',
      ];
      const color = colors[idx % colors.length];
      
      ctx.fillStyle = color;
      ctx.fillRect(20, legendY, 20, 20);
      
      ctx.fillStyle = 'hsl(var(--foreground))';
      ctx.font = '12px sans-serif';
      ctx.fillText(`${supplier.supplierName} (${supplier.pallets} pallets)`, 50, legendY + 15);
      legendY += 30;
    });
  };

  const drawSupplierPallet = (canvas: HTMLCanvasElement, config: SupplierPalletConfig) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 800;
    canvas.height = 500;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Background
    ctx.fillStyle = 'hsl(var(--muted))';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    // Draw single pallet in detail with cases stacked
    const palletBaseWidth = 200;
    const palletBaseDepth = 130;
    const maxHeight = 250;
    
    // Pallet base
    ctx.fillStyle = 'hsl(30, 40%, 40%)';
    drawIsometricBox(ctx, centerX - palletBaseWidth/2, centerY + 50, palletBaseWidth, palletBaseDepth, 20);
    
    // Stack cases on pallet
    const caseHeight = 40;
    const casesPerLayer = 4;
    const layers = Math.min(Math.ceil(config.products.length / casesPerLayer), 5);
    
    let currentY = centerY + 50 - 20;
    
    for (let layer = 0; layer < layers; layer++) {
      const startIdx = layer * casesPerLayer;
      const endIdx = Math.min(startIdx + casesPerLayer, config.products.length);
      
      const casesInLayer = endIdx - startIdx;
      const caseWidth = palletBaseWidth / 2;
      const caseDepth = palletBaseDepth / 2;
      
      for (let i = 0; i < casesInLayer; i++) {
        const product = config.products[startIdx + i];
        const row = Math.floor(i / 2);
        const col = i % 2;
        
        const x = centerX - palletBaseWidth/2 + col * caseWidth;
        const y = currentY - layer * caseHeight;
        
        // Case color based on product
        const hue = (product.code.charCodeAt(0) * 137) % 360;
        ctx.fillStyle = `hsl(${hue}, 60%, 55%)`;
        
        drawIsometricBox(ctx, x + row * 20, y, caseWidth - 10, caseDepth - 10, caseHeight);
        
        // Product code label
        ctx.fillStyle = 'hsl(var(--foreground))';
        ctx.font = 'bold 10px sans-serif';
        ctx.fillText(product.code, x + 10, y + caseHeight / 2);
      }
    }

    // Dimensions overlay
    ctx.strokeStyle = 'hsl(var(--primary))';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    
    // Width dimension
    ctx.beginPath();
    ctx.moveTo(centerX - palletBaseWidth/2, centerY + 100);
    ctx.lineTo(centerX + palletBaseWidth/2, centerY + 100);
    ctx.stroke();
    
    ctx.fillStyle = 'hsl(var(--primary))';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('120cm', centerX - 20, centerY + 120);
    
    // Height dimension
    ctx.beginPath();
    ctx.moveTo(centerX + palletBaseWidth/2 + 20, centerY + 50);
    ctx.lineTo(centerX + palletBaseWidth/2 + 20, centerY + 50 - maxHeight);
    ctx.stroke();
    
    ctx.fillText('155cm max', centerX + palletBaseWidth/2 + 30, centerY - maxHeight/2);
    
    ctx.setLineDash([]);

    // Info panel
    ctx.fillStyle = 'hsl(var(--card))';
    ctx.fillRect(20, 20, 250, 180);
    ctx.strokeStyle = 'hsl(var(--border))';
    ctx.strokeRect(20, 20, 250, 180);
    
    ctx.fillStyle = 'hsl(var(--foreground))';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText(config.supplierName, 30, 45);
    
    ctx.font = '12px sans-serif';
    ctx.fillText(`Products: ${config.products.length}`, 30, 70);
    ctx.fillText(`Pallets: ${config.pallets}`, 30, 90);
    ctx.fillText(`Total Weight: ${config.totalChargeableWeight.toFixed(1)} kg`, 30, 110);
    ctx.fillText(`Utilization: ${config.utilizationPct.toFixed(1)}%`, 30, 130);
    
    const limitingColor = config.limitingFactor === 'volume' ? 'hsl(var(--destructive))' : 
                          config.limitingFactor === 'weight' ? 'hsl(var(--primary))' : 
                          'hsl(var(--accent))';
    ctx.fillStyle = limitingColor;
    ctx.fillText(`Limiting: ${config.limitingFactor}`, 30, 150);
    
    ctx.fillStyle = 'hsl(var(--foreground))';
    ctx.fillText(`Actual: ${config.totalActualWeight.toFixed(1)} kg`, 30, 170);
    ctx.fillText(`Volumetric: ${config.totalVolumetricWeight.toFixed(1)} kg`, 30, 190);
  };

  const drawIsometricBox = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    depth: number,
    height: number
  ) => {
    const angleX = Math.PI / 6; // 30 degrees
    const angleY = Math.PI / 6;
    
    // Top face
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + width * Math.cos(angleX), y - width * Math.sin(angleX));
    ctx.lineTo(x + width * Math.cos(angleX) + depth * Math.cos(angleY), y - width * Math.sin(angleX) + depth * Math.sin(angleY));
    ctx.lineTo(x + depth * Math.cos(angleY), y + depth * Math.sin(angleY));
    ctx.closePath();
    ctx.fill();
    
    // Right face (darker)
    const currentFill = ctx.fillStyle;
    ctx.fillStyle = adjustBrightness(currentFill.toString(), -20);
    ctx.beginPath();
    ctx.moveTo(x + width * Math.cos(angleX), y - width * Math.sin(angleX));
    ctx.lineTo(x + width * Math.cos(angleX), y - width * Math.sin(angleX) - height);
    ctx.lineTo(x + width * Math.cos(angleX) + depth * Math.cos(angleY), y - width * Math.sin(angleX) + depth * Math.sin(angleY) - height);
    ctx.lineTo(x + width * Math.cos(angleX) + depth * Math.cos(angleY), y - width * Math.sin(angleX) + depth * Math.sin(angleY));
    ctx.closePath();
    ctx.fill();
    
    // Left face (darkest)
    ctx.fillStyle = adjustBrightness(currentFill.toString(), -40);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y - height);
    ctx.lineTo(x + width * Math.cos(angleX), y - width * Math.sin(angleX) - height);
    ctx.lineTo(x + width * Math.cos(angleX), y - width * Math.sin(angleX));
    ctx.closePath();
    ctx.fill();
    
    ctx.fillStyle = currentFill;
  };

  const adjustBrightness = (color: string, percent: number): string => {
    // Simple brightness adjustment for HSL colors
    if (color.includes('hsl')) {
      const match = color.match(/hsl\(([^,]+),\s*([^,]+),\s*([^)]+)\)/);
      if (match) {
        const h = match[1];
        const s = match[2];
        const l = parseFloat(match[3]);
        const newL = Math.max(0, Math.min(100, l + percent));
        return `hsl(${h}, ${s}, ${newL}%)`;
      }
    }
    return color;
  };

  if (!palletConfig) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Pallet Configuration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No pallet configuration available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Pallet Configuration Visualization
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Layers className="h-4 w-4" />
                Total Pallets
              </div>
              <div className="text-2xl font-bold">{palletConfig.totalPallets}</div>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Weight className="h-4 w-4" />
                Chargeable Weight
              </div>
              <div className="text-2xl font-bold">{palletConfig.totalChargeableWeight.toFixed(1)} kg</div>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <TrendingUp className="h-4 w-4" />
                Utilization
              </div>
              <div className="text-2xl font-bold">{palletConfig.overallUtilization.toFixed(1)}%</div>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Box className="h-4 w-4" />
                Suppliers
              </div>
              <div className="text-2xl font-bold">{palletConfig.supplierConfigs.length}</div>
            </div>
          </div>

          <Tabs value={selectedSupplier} onValueChange={setSelectedSupplier}>
            <TabsList className="mb-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              {palletConfig.supplierConfigs.map((config) => (
                <TabsTrigger key={config.supplierId} value={config.supplierId}>
                  {config.supplierName}
                  <Badge variant="secondary" className="ml-2">
                    {config.pallets}
                  </Badge>
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="overview" key="overview-content">
              <div className="border border-border rounded-lg overflow-hidden bg-card">
                <canvas
                  ref={(el) => (canvasRefs.current['overview'] = el)}
                  className="w-full"
                />
              </div>
            </TabsContent>

            {palletConfig.supplierConfigs.map((config) => (
              <TabsContent key={`${config.supplierId}-content`} value={config.supplierId}>
                <div className="border border-border rounded-lg overflow-hidden bg-card">
                  <canvas
                    ref={(el) => (canvasRefs.current[config.supplierId] = el)}
                    className="w-full"
                  />
                </div>

                <div className="mt-4 grid grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Weight Distribution</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Actual Weight:</span>
                        <span className="font-medium">{config.totalActualWeight.toFixed(1)} kg</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Volumetric Weight:</span>
                        <span className="font-medium">{config.totalVolumetricWeight.toFixed(1)} kg</span>
                      </div>
                      <div className="flex justify-between border-t pt-2">
                        <span className="text-muted-foreground">Chargeable:</span>
                        <span className="font-bold">{config.totalChargeableWeight.toFixed(1)} kg</span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Efficiency Metrics</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Pallets Used:</span>
                        <span className="font-medium">{config.pallets}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Utilization:</span>
                        <span className="font-medium">{config.utilizationPct.toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between border-t pt-2">
                        <span className="text-muted-foreground">Limiting Factor:</span>
                        <Badge variant={config.limitingFactor === 'volume' ? 'destructive' : 'default'}>
                          {config.limitingFactor}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};
