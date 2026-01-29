import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Slider } from '@/components/ui/slider';
import { 
  Package, Layers, Weight, TrendingUp, Box, ChevronDown, ChevronUp,
  Scale, Maximize, AlertTriangle, CheckCircle, Info
} from 'lucide-react';
import { 
  OrderPalletConfig, 
  SupplierPalletConfig, 
  ProductWeightInfo,
  STANDARD_EUROPALLET,
  PalletConfig
} from '@/lib/weightCalculations';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

// Calculate how cases fit on a pallet footprint
interface CaseFitResult {
  casesAcross: number;
  casesDeep: number;
  casesPerLayer: number;
  maxLayers: number;
  totalCapacity: number;
  caseWidth: number;
  caseLength: number;
  caseHeight: number;
  palletWidth: number;
  palletLength: number;
  hasDimensions: boolean;
}

const calculateCaseFit = (
  products: ProductWeightInfo[],
  palletConfig: PalletConfig = STANDARD_EUROPALLET
): CaseFitResult => {
  // Find a product with dimensions to use as representative
  const productWithDims = products.find(p => 
    p.lengthCm && p.widthCm && p.heightCm && 
    p.lengthCm > 0 && p.widthCm > 0 && p.heightCm > 0
  );

  if (!productWithDims || !productWithDims.lengthCm || !productWithDims.widthCm || !productWithDims.heightCm) {
    // No dimensions available - show estimated layout
    return {
      casesAcross: 2,
      casesDeep: 2,
      casesPerLayer: 4,
      maxLayers: 5,
      totalCapacity: 20,
      caseWidth: 40,
      caseLength: 60,
      caseHeight: 20,
      palletWidth: palletConfig.widthCm,
      palletLength: palletConfig.lengthCm,
      hasDimensions: false
    };
  }

  const caseLength = productWithDims.lengthCm;
  const caseWidth = productWithDims.widthCm;
  const caseHeight = productWithDims.heightCm;

  // Add 2cm tolerance for pallet placement
  const effectiveLength = palletConfig.lengthCm + 2;
  const effectiveWidth = palletConfig.widthCm + 2;

  // Try both orientations
  // Pattern 1: Case length along pallet length
  const casesAcross1 = Math.floor(effectiveLength / caseLength);
  const casesDeep1 = Math.floor(effectiveWidth / caseWidth);

  // Pattern 2: Case length along pallet width (rotated)
  const casesAcross2 = Math.floor(effectiveLength / caseWidth);
  const casesDeep2 = Math.floor(effectiveWidth / caseLength);

  // Use better orientation
  const pattern1Total = casesAcross1 * casesDeep1;
  const pattern2Total = casesAcross2 * casesDeep2;
  
  const usePat1 = pattern1Total >= pattern2Total;
  const casesAcross = usePat1 ? casesAcross1 : casesAcross2;
  const casesDeep = usePat1 ? casesDeep1 : casesDeep2;
  const casesPerLayer = casesAcross * casesDeep;

  // Calculate vertical layers
  const availableHeight = palletConfig.maxCargoHeightCm - palletConfig.heightCm;
  const maxLayers = Math.max(1, Math.floor(availableHeight / caseHeight));

  return {
    casesAcross,
    casesDeep,
    casesPerLayer,
    maxLayers,
    totalCapacity: casesPerLayer * maxLayers,
    caseWidth: usePat1 ? caseWidth : caseLength,
    caseLength: usePat1 ? caseLength : caseWidth,
    caseHeight,
    palletWidth: palletConfig.widthCm,
    palletLength: palletConfig.lengthCm,
    hasDimensions: true
  };
};
interface PalletVisualizationProps {
  palletConfig: OrderPalletConfig | null;
}

// Color palette for suppliers
const SUPPLIER_COLORS = [
  { bg: 'bg-blue-500', text: 'text-blue-500', light: 'bg-blue-100 dark:bg-blue-900/30' },
  { bg: 'bg-emerald-500', text: 'text-emerald-500', light: 'bg-emerald-100 dark:bg-emerald-900/30' },
  { bg: 'bg-amber-500', text: 'text-amber-500', light: 'bg-amber-100 dark:bg-amber-900/30' },
  { bg: 'bg-purple-500', text: 'text-purple-500', light: 'bg-purple-100 dark:bg-purple-900/30' },
  { bg: 'bg-rose-500', text: 'text-rose-500', light: 'bg-rose-100 dark:bg-rose-900/30' },
];

// Get utilization color based on percentage
const getUtilizationColor = (pct: number): string => {
  if (pct < 50) return 'bg-red-500';
  if (pct < 80) return 'bg-yellow-500';
  if (pct < 95) return 'bg-green-500';
  return 'bg-blue-500';
};

const getUtilizationLabel = (pct: number): string => {
  if (pct < 50) return 'Underutilized';
  if (pct < 80) return 'Acceptable';
  if (pct < 95) return 'Optimal';
  return 'Near Capacity';
};

// Overview Stats Cards
const PalletOverviewCards = ({ config }: { config: OrderPalletConfig }) => {
  const isMobile = useIsMobile();
  
  return (
    <div className={cn(
      "grid gap-4 mb-6",
      isMobile ? "grid-cols-2" : "grid-cols-2 md:grid-cols-4"
    )}>
      <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-blue-200 dark:border-blue-800">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 mb-1">
            <Layers className="h-4 w-4" />
            Total Pallets
          </div>
          <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">{config.totalPallets}</div>
        </CardContent>
      </Card>
      
      <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 border-purple-200 dark:border-purple-800">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-sm text-purple-600 dark:text-purple-400 mb-1">
            <Weight className="h-4 w-4" />
            Chargeable Weight
          </div>
          <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">{config.totalChargeableWeight.toFixed(1)} kg</div>
        </CardContent>
      </Card>
      
      <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20 border-emerald-200 dark:border-emerald-800">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400 mb-1">
            <TrendingUp className="h-4 w-4" />
            Utilization
          </div>
          <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{config.overallUtilization.toFixed(1)}%</div>
        </CardContent>
      </Card>
      
      <Card className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/20 border-amber-200 dark:border-amber-800">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400 mb-1">
            <Box className="h-4 w-4" />
            Suppliers
          </div>
          <div className="text-2xl font-bold text-amber-700 dark:text-amber-300">{config.supplierConfigs.length}</div>
        </CardContent>
      </Card>
    </div>
  );
};

// Weight Comparison Bars
const WeightComparisonBars = ({ config }: { config: OrderPalletConfig }) => {
  const maxWeight = Math.max(config.totalActualWeight, config.totalVolumetricWeight) * 1.1;
  const actualPct = (config.totalActualWeight / maxWeight) * 100;
  const volumetricPct = (config.totalVolumetricWeight / maxWeight) * 100;
  const gap = Math.abs(config.totalVolumetricWeight - config.totalActualWeight);
  const isVolumeLimited = config.totalVolumetricWeight > config.totalActualWeight;

  return (
    <Card className="mb-6">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Scale className="h-4 w-4" />
          Weight Comparison
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-3.5 w-3.5 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs">Chargeable weight is the higher of actual vs volumetric. The gap represents "air" you're paying freight for.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Actual Weight Bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <span className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              Actual Weight
            </span>
            <span className="font-medium">{config.totalActualWeight.toFixed(1)} kg</span>
          </div>
          <div className="h-6 bg-secondary rounded-full overflow-hidden">
            <div 
              className="h-full bg-blue-500 transition-all duration-500 ease-out rounded-full"
              style={{ width: `${actualPct}%` }}
            />
          </div>
        </div>

        {/* Volumetric Weight Bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <span className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-orange-500" />
              Volumetric Weight
            </span>
            <span className="font-medium">{config.totalVolumetricWeight.toFixed(1)} kg</span>
          </div>
          <div className="h-6 bg-secondary rounded-full overflow-hidden">
            <div 
              className="h-full bg-orange-500 transition-all duration-500 ease-out rounded-full"
              style={{ width: `${volumetricPct}%` }}
            />
          </div>
        </div>

        {/* Gap Indicator */}
        {gap > 0 && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-dashed">
            <AlertTriangle className={cn(
              "h-5 w-5",
              isVolumeLimited ? "text-orange-500" : "text-blue-500"
            )} />
            <div className="flex-1">
              <p className="text-sm font-medium">
                {isVolumeLimited ? 'Volume Limited' : 'Weight Limited'}
              </p>
              <p className="text-xs text-muted-foreground">
                {isVolumeLimited 
                  ? `Paying for ${gap.toFixed(1)} kg of "air" in freight charges`
                  : `Dense cargo - ${gap.toFixed(1)} kg of weight capacity used beyond volume`
                }
              </p>
            </div>
            <Badge variant={isVolumeLimited ? "destructive" : "default"}>
              +{gap.toFixed(1)} kg
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Limiting Factor Badge
const LimitingFactorBadge = ({ factor }: { factor: 'weight' | 'volume' | 'balanced' }) => {
  switch (factor) {
    case 'weight':
      return (
        <Badge className="bg-blue-500 hover:bg-blue-600">
          <Weight className="h-3 w-3 mr-1" />
          Weight Limited
        </Badge>
      );
    case 'volume':
      return (
        <Badge className="bg-orange-500 hover:bg-orange-600">
          <Maximize className="h-3 w-3 mr-1" />
          Volume Limited
        </Badge>
      );
    case 'balanced':
      return (
        <Badge className="bg-green-500 hover:bg-green-600">
          <CheckCircle className="h-3 w-3 mr-1" />
          Balanced
        </Badge>
      );
  }
};

// Case Stacking View - Now with actual dimensions!
const CaseStackingView = ({ 
  products, 
  layer, 
  onLayerChange,
  palletConfig
}: { 
  products: ProductWeightInfo[];
  layer: number;
  onLayerChange: (layer: number) => void;
  palletConfig?: PalletConfig;
}) => {
  const caseFit = calculateCaseFit(products, palletConfig || STANDARD_EUROPALLET);
  const totalLayers = caseFit.maxLayers;
  const { casesAcross, casesDeep, casesPerLayer } = caseFit;
  
  // Calculate total cases needed for all products
  const totalCasesNeeded = products.reduce((sum, p) => {
    return sum + Math.ceil(p.quantity / p.packSize);
  }, 0);

  // Build case slots for current layer
  const getLayerCases = () => {
    const startCase = layer * casesPerLayer;
    const endCase = Math.min(startCase + casesPerLayer, totalCasesNeeded);
    const casesThisLayer = endCase - startCase;
    
    // Map products to case positions
    const caseSlots: (ProductWeightInfo | null)[] = [];
    let caseCounter = 0;
    
    for (const product of products) {
      const casesForProduct = Math.ceil(product.quantity / product.packSize);
      for (let i = 0; i < casesForProduct; i++) {
        if (caseCounter >= startCase && caseCounter < endCase) {
          caseSlots.push(product);
        }
        caseCounter++;
      }
    }
    
    // Fill remaining slots with null
    while (caseSlots.length < casesPerLayer) {
      caseSlots.push(null);
    }
    
    return caseSlots;
  };

  const layerCases = getLayerCases();
  const casesOnThisLayer = layerCases.filter(c => c !== null).length;
  
  // Calculate aspect ratio based on pallet dimensions
  const aspectRatio = caseFit.palletLength / caseFit.palletWidth;
  
  return (
    <div className="space-y-4">
      {/* Pallet info header */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge variant="outline" className="font-mono">
          Pallet: {caseFit.palletLength}×{caseFit.palletWidth} cm
        </Badge>
        {caseFit.hasDimensions ? (
          <Badge variant="outline" className="font-mono">
            Case: {caseFit.caseLength}×{caseFit.caseWidth}×{caseFit.caseHeight} cm
          </Badge>
        ) : (
          <Badge variant="secondary" className="text-yellow-600 dark:text-yellow-400">
            ⚠️ No case dimensions - estimated layout
          </Badge>
        )}
        <span className="text-muted-foreground">
          {casesAcross}×{casesDeep} = {casesPerLayer} cases/layer × {totalLayers} layers = {caseFit.totalCapacity} capacity
        </span>
      </div>
      
      <div className="text-sm text-muted-foreground">
        Layer {layer + 1} of {totalLayers} — {casesOnThisLayer} case{casesOnThisLayer !== 1 ? 's' : ''} on this layer
      </div>
      
      {/* Pallet footprint visualization - TRUE TO SCALE */}
      <div 
        className="relative bg-amber-100 dark:bg-amber-900/30 rounded-lg border-2 border-amber-300 dark:border-amber-700 p-2 overflow-hidden"
        style={{ 
          aspectRatio: `${aspectRatio}`,
          maxWidth: '100%'
        }}
      >
        {/* Pallet base slats pattern */}
        <div className="absolute inset-0 opacity-20 pointer-events-none">
          <div className="grid h-full" style={{ gridTemplateColumns: `repeat(${Math.ceil(caseFit.palletLength / 20)}, 1fr)` }}>
            {Array.from({ length: Math.ceil(caseFit.palletLength / 20) }).map((_, i) => (
              <div key={i} className="border-r border-amber-600 last:border-r-0" />
            ))}
          </div>
        </div>
        
        {/* Cases grid - matches actual arrangement */}
        <div 
          className="relative grid gap-1 h-full w-full"
          style={{ 
            gridTemplateColumns: `repeat(${casesAcross}, 1fr)`,
            gridTemplateRows: `repeat(${casesDeep}, 1fr)`
          }}
        >
          {layerCases.map((product, idx) => {
            if (!product) {
              return (
                <div 
                  key={`empty-${idx}`}
                  className="rounded border border-dashed border-muted-foreground/20 flex items-center justify-center text-muted-foreground/30 text-[10px]"
                >
                  –
                </div>
              );
            }
            
            const hue = (product.code.charCodeAt(0) * 137 + product.code.charCodeAt(1) * 73) % 360;
            return (
              <TooltipProvider key={idx}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div 
                      className="rounded flex items-center justify-center text-white font-bold text-[10px] sm:text-xs transition-all hover:scale-[1.02] hover:z-10 cursor-pointer shadow-sm border border-white/20"
                      style={{ backgroundColor: `hsl(${hue}, 55%, 45%)` }}
                    >
                      <span className="truncate px-0.5">{product.code}</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs">
                    <div className="text-xs space-y-1">
                      <p className="font-semibold">{product.name || product.code}</p>
                      <p>Total order: {product.quantity} units ({Math.ceil(product.quantity / product.packSize)} cases)</p>
                      {product.lengthCm && product.widthCm && product.heightCm ? (
                        <p className="text-green-600 dark:text-green-400">
                          ✓ Case: {product.lengthCm}×{product.widthCm}×{product.heightCm} cm
                        </p>
                      ) : (
                        <p className="text-yellow-600 dark:text-yellow-400">
                          ⚠️ No case dimensions in database
                        </p>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          })}
        </div>
        
        {/* Dimension labels */}
        <div className="absolute -bottom-5 left-0 right-0 text-center text-[10px] text-muted-foreground font-mono">
          {caseFit.palletLength} cm
        </div>
        <div className="absolute -right-8 top-0 bottom-0 flex items-center text-[10px] text-muted-foreground font-mono writing-mode-vertical">
          <span style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>{caseFit.palletWidth} cm</span>
        </div>
      </div>
      
      {/* Layer slider */}
      {totalLayers > 1 && (
        <div className="space-y-2 mt-8">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Layer 1 (Bottom)</span>
            <span>Layer {totalLayers} (Top)</span>
          </div>
          <Slider
            value={[layer]}
            onValueChange={([val]) => onLayerChange(val)}
            max={totalLayers - 1}
            step={1}
            className="w-full"
          />
        </div>
      )}
    </div>
  );
};

// Supplier Pallet Card
const SupplierPalletCard = ({ 
  config, 
  colorIndex 
}: { 
  config: SupplierPalletConfig; 
  colorIndex: number;
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [viewLayer, setViewLayer] = useState(0);
  const color = SUPPLIER_COLORS[colorIndex % SUPPLIER_COLORS.length];
  const isMobile = useIsMobile();
  
  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <Card className={cn(
        "transition-all duration-200",
        isExpanded && "ring-2 ring-primary/50"
      )}>
        <CollapsibleTrigger className="w-full text-left">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className={cn("w-4 h-4 rounded-full", color.bg)} />
                <div>
                  <CardTitle className="text-base">{config.supplierName}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {config.pallets} pallet{config.pallets !== 1 ? 's' : ''} • {config.products.length} product{config.products.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <LimitingFactorBadge factor={config.limitingFactor} />
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CardContent className="pt-0">
          {/* Weight metrics - always visible */}
          <div className="space-y-3">
            {/* Utilization bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Utilization</span>
                <span className={cn(
                  "font-medium",
                  config.utilizationPct < 50 && "text-red-500",
                  config.utilizationPct >= 50 && config.utilizationPct < 80 && "text-yellow-500",
                  config.utilizationPct >= 80 && "text-green-500"
                )}>
                  {config.utilizationPct.toFixed(1)}% - {getUtilizationLabel(config.utilizationPct)}
                </span>
              </div>
              <div className="h-2 bg-secondary rounded-full overflow-hidden">
                <div 
                  className={cn(
                    "h-full transition-all duration-500 rounded-full",
                    getUtilizationColor(config.utilizationPct)
                  )}
                  style={{ width: `${Math.min(config.utilizationPct, 100)}%` }}
                />
              </div>
            </div>
            
            {/* Weight breakdown - compact */}
            <div className={cn(
              "grid gap-2 text-sm",
              isMobile ? "grid-cols-1" : "grid-cols-3"
            )}>
              <div className="flex justify-between p-2 rounded bg-blue-50 dark:bg-blue-900/20">
                <span className="text-muted-foreground">Actual</span>
                <span className="font-medium">{config.totalActualWeight.toFixed(1)} kg</span>
              </div>
              <div className="flex justify-between p-2 rounded bg-orange-50 dark:bg-orange-900/20">
                <span className="text-muted-foreground">Volumetric</span>
                <span className="font-medium">{config.totalVolumetricWeight.toFixed(1)} kg</span>
              </div>
              <div className="flex justify-between p-2 rounded bg-purple-50 dark:bg-purple-900/20">
                <span className="text-muted-foreground">Chargeable</span>
                <span className="font-bold">{config.totalChargeableWeight.toFixed(1)} kg</span>
              </div>
            </div>
          </div>
          
          {/* Expanded content */}
          <CollapsibleContent className="pt-4 space-y-4">
            {/* Case stacking visualization */}
            <div className="border rounded-lg p-4 overflow-hidden">
              <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                <Layers className="h-4 w-4" />
                Case Arrangement (Top-Down View)
              </h4>
              <CaseStackingView 
                products={config.products}
                layer={viewLayer}
                onLayerChange={setViewLayer}
                palletConfig={config.palletDimensions}
              />
            </div>
            
            {/* Products table */}
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-muted/50 px-3 py-2 text-sm font-medium">
                Products on Pallet
              </div>
              <div className="divide-y max-h-48 overflow-y-auto">
                {config.products.map((product, idx) => (
                  <div key={idx} className="px-3 py-2 flex items-center justify-between text-sm">
                    <div>
                      <span className="font-medium">{product.code}</span>
                      {product.name && (
                        <span className="text-muted-foreground ml-2">{product.name}</span>
                      )}
                    </div>
                    <span className="text-muted-foreground">
                      {product.quantity} units
                    </span>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Optimization alerts */}
            {config.utilizationPct < 50 && (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
                <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                    Low Utilization Warning
                  </p>
                  <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                    This pallet is under 50% utilized. Consider consolidating with other shipments or adding more products to optimize freight costs.
                  </p>
                </div>
              </div>
            )}
          </CollapsibleContent>
        </CardContent>
      </Card>
    </Collapsible>
  );
};

// Pallet Grid View
const PalletGridView = ({ configs }: { configs: SupplierPalletConfig[] }) => {
  const isMobile = useIsMobile();
  
  return (
    <div className={cn(
      "grid gap-4",
      isMobile ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-2"
    )}>
      {configs.map((config, idx) => (
        <SupplierPalletCard 
          key={config.supplierId}
          config={config}
          colorIndex={idx}
        />
      ))}
    </div>
  );
};

// Supplier Weight Summary Table
const SupplierWeightTable = ({ configs }: { configs: SupplierPalletConfig[] }) => {
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-3 font-medium">Supplier</th>
              <th className="text-right p-3 font-medium">Pallets</th>
              <th className="text-right p-3 font-medium">Actual (kg)</th>
              <th className="text-right p-3 font-medium">Volumetric (kg)</th>
              <th className="text-right p-3 font-medium">Chargeable (kg)</th>
              <th className="text-center p-3 font-medium">Factor</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {configs.map((config, idx) => {
              const color = SUPPLIER_COLORS[idx % SUPPLIER_COLORS.length];
              return (
                <tr key={config.supplierId} className="hover:bg-muted/30">
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <div className={cn("w-3 h-3 rounded-full", color.bg)} />
                      <span>{config.supplierName}</span>
                    </div>
                  </td>
                  <td className="text-right p-3">{config.pallets}</td>
                  <td className="text-right p-3">{config.totalActualWeight.toFixed(1)}</td>
                  <td className="text-right p-3">{config.totalVolumetricWeight.toFixed(1)}</td>
                  <td className="text-right p-3 font-medium">{config.totalChargeableWeight.toFixed(1)}</td>
                  <td className="text-center p-3">
                    <LimitingFactorBadge factor={config.limitingFactor} />
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-muted/30 font-medium">
            <tr>
              <td className="p-3">Total</td>
              <td className="text-right p-3">
                {configs.reduce((sum, c) => sum + c.pallets, 0)}
              </td>
              <td className="text-right p-3">
                {configs.reduce((sum, c) => sum + c.totalActualWeight, 0).toFixed(1)}
              </td>
              <td className="text-right p-3">
                {configs.reduce((sum, c) => sum + c.totalVolumetricWeight, 0).toFixed(1)}
              </td>
              <td className="text-right p-3">
                {configs.reduce((sum, c) => sum + c.totalChargeableWeight, 0).toFixed(1)}
              </td>
              <td className="p-3" />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};

// Main Component
export const PalletVisualization = ({ palletConfig }: PalletVisualizationProps) => {
  const [selectedTab, setSelectedTab] = useState<string>('overview');

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
          {/* Overview Stats */}
          <PalletOverviewCards config={palletConfig} />
          
          {/* Weight Comparison */}
          <WeightComparisonBars config={palletConfig} />

          {/* Tabbed Content */}
          <Tabs value={selectedTab} onValueChange={setSelectedTab}>
            <TabsList className="mb-4 flex-wrap h-auto">
              <TabsTrigger value="overview">
                <Layers className="h-4 w-4 mr-2" />
                Pallet Grid
              </TabsTrigger>
              <TabsTrigger value="table">
                <Scale className="h-4 w-4 mr-2" />
                Weight Summary
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="animate-fade-in">
              <PalletGridView configs={palletConfig.supplierConfigs} />
            </TabsContent>

            <TabsContent value="table" className="animate-fade-in">
              <SupplierWeightTable configs={palletConfig.supplierConfigs} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};
