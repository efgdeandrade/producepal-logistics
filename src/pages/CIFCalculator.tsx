import { useState } from 'react';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calculator, ArrowLeft } from 'lucide-react';
import { PRODUCTS, ProductCode } from '@/types/order';
import { useNavigate } from 'react-router-dom';

interface ProductInput {
  code: ProductCode;
  name: string;
  quantity: number;
  costPerUnit: number;
  weightPerUnit: number;
}

interface CIFResult {
  productCode: ProductCode;
  productName: string;
  quantity: number;
  costUSD: number;
  freightCost: number;
  cifUSD: number;
  cifXCG: number;
  wholesalePrice: number;
  retailPrice: number;
  wholesaleMargin: number;
  retailMargin: number;
}

const EXCHANGE_RATE_KEY = 'cif_exchange_rate';
const DEFAULT_EXCHANGE_RATE = 1.82;

export default function CIFCalculator() {
  const navigate = useNavigate();
  const [exchangeRate, setExchangeRate] = useState(() => {
    const saved = localStorage.getItem(EXCHANGE_RATE_KEY);
    return saved ? parseFloat(saved) : DEFAULT_EXCHANGE_RATE;
  });

  // Estimate version inputs
  const [estimateProducts, setEstimateProducts] = useState<ProductInput[]>([
    { code: 'STB_500', name: 'Strawberries 500g', quantity: 0, costPerUnit: 0, weightPerUnit: 0 }
  ]);

  // Actual version inputs
  const [actualProducts, setActualProducts] = useState<ProductInput[]>([
    { code: 'STB_500', name: 'Strawberries 500g', quantity: 0, costPerUnit: 0, weightPerUnit: 0 }
  ]);
  const [actualFreightChampion, setActualFreightChampion] = useState(0);
  const [actualSwissport, setActualSwissport] = useState(0);

  const handleExchangeRateChange = (value: string) => {
    const rate = parseFloat(value) || DEFAULT_EXCHANGE_RATE;
    setExchangeRate(rate);
    localStorage.setItem(EXCHANGE_RATE_KEY, rate.toString());
  };

  const addProduct = (isActual: boolean) => {
    const newProduct: ProductInput = {
      code: 'STB_500',
      name: 'Strawberries 500g',
      quantity: 0,
      costPerUnit: 0,
      weightPerUnit: 0
    };
    if (isActual) {
      setActualProducts([...actualProducts, newProduct]);
    } else {
      setEstimateProducts([...estimateProducts, newProduct]);
    }
  };

  const updateProduct = (index: number, field: keyof ProductInput, value: any, isActual: boolean) => {
    const products = isActual ? actualProducts : estimateProducts;
    const setProducts = isActual ? setActualProducts : setEstimateProducts;
    
    const updated = [...products];
    if (field === 'code') {
      const product = PRODUCTS.find(p => p.code === value);
      if (product) {
        updated[index] = {
          ...updated[index],
          code: product.code,
          name: product.name
        };
      }
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    setProducts(updated);
  };

  const removeProduct = (index: number, isActual: boolean) => {
    const products = isActual ? actualProducts : estimateProducts;
    const setProducts = isActual ? setActualProducts : setEstimateProducts;
    setProducts(products.filter((_, i) => i !== index));
  };

  const calculateCIF = (
    products: ProductInput[],
    freightChampionCost?: number,
    swissportCost?: number
  ): { byWeight: CIFResult[], byCost: CIFResult[], equally: CIFResult[] } => {
    const LOCAL_LOGISTICS_XCG = 50;
    const LOCAL_LOGISTICS_USD = 91;
    const LABOR_XCG = 50;
    const FREIGHT_CHAMPION_PER_KG = 2.46;
    const SWISSPORT_PER_KG = 0.41;
    const WHOLESALE_MULTIPLIER = 1.25;
    const RETAIL_MULTIPLIER = 1.786;

    const totalWeight = products.reduce((sum, p) => sum + (p.quantity * p.weightPerUnit), 0);
    const totalCost = products.reduce((sum, p) => sum + (p.quantity * p.costPerUnit), 0);

    const freightChampion = freightChampionCost ?? (totalWeight * FREIGHT_CHAMPION_PER_KG);
    const swissport = swissportCost ?? (totalWeight * SWISSPORT_PER_KG);
    const totalFreight = LOCAL_LOGISTICS_USD + freightChampion + swissport;

    const calculateResults = (distributionMethod: 'weight' | 'cost' | 'equal'): CIFResult[] => {
      return products.map(product => {
        const productWeight = product.quantity * product.weightPerUnit;
        const productCost = product.quantity * product.costPerUnit;

        let freightShare = 0;
        if (distributionMethod === 'weight') {
          freightShare = totalWeight > 0 ? (productWeight / totalWeight) * totalFreight : 0;
        } else if (distributionMethod === 'cost') {
          freightShare = totalCost > 0 ? (productCost / totalCost) * totalFreight : 0;
        } else {
          freightShare = totalFreight / products.length;
        }

        const cifUSD = productCost + freightShare;
        const cifXCG = (cifUSD * exchangeRate) + (LABOR_XCG / products.length);
        const cifPerUnit = product.quantity > 0 ? cifXCG / product.quantity : 0;
        
        const wholesalePrice = cifPerUnit * WHOLESALE_MULTIPLIER;
        const retailPrice = cifPerUnit * RETAIL_MULTIPLIER;
        const wholesaleMargin = wholesalePrice - cifPerUnit;
        const retailMargin = retailPrice - cifPerUnit;

        return {
          productCode: product.code,
          productName: product.name,
          quantity: product.quantity,
          costUSD: productCost,
          freightCost: freightShare,
          cifUSD,
          cifXCG,
          wholesalePrice,
          retailPrice,
          wholesaleMargin,
          retailMargin
        };
      });
    };

    return {
      byWeight: calculateResults('weight'),
      byCost: calculateResults('cost'),
      equally: calculateResults('equal')
    };
  };

  const renderResults = (results: CIFResult[], title: string) => {
    if (results.length === 0 || results.every(r => r.quantity === 0)) {
      return null;
    }

    return (
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-lg">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Product</th>
                  <th className="text-right p-2">Qty</th>
                  <th className="text-right p-2">CIF/Unit</th>
                  <th className="text-right p-2">Wholesale</th>
                  <th className="text-right p-2">Retail</th>
                  <th className="text-right p-2">W. Margin</th>
                  <th className="text-right p-2">R. Margin</th>
                </tr>
              </thead>
              <tbody>
                {results.map((result, idx) => (
                  <tr key={idx} className="border-b">
                    <td className="p-2">{result.productName}</td>
                    <td className="text-right p-2">{result.quantity}</td>
                    <td className="text-right p-2">cg {(result.cifXCG / result.quantity).toFixed(2)}</td>
                    <td className="text-right p-2">cg {result.wholesalePrice.toFixed(2)}</td>
                    <td className="text-right p-2">cg {result.retailPrice.toFixed(2)}</td>
                    <td className="text-right p-2">cg {result.wholesaleMargin.toFixed(2)}</td>
                    <td className="text-right p-2">cg {result.retailMargin.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderProductInputs = (products: ProductInput[], isActual: boolean) => {
    return (
      <div className="space-y-4">
        {products.map((product, index) => (
          <Card key={index}>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div>
                  <Label>Product</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={product.code}
                    onChange={(e) => updateProduct(index, 'code', e.target.value as ProductCode, isActual)}
                  >
                    {PRODUCTS.map(p => (
                      <option key={p.code} value={p.code}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>Quantity</Label>
                  <Input
                    type="number"
                    value={product.quantity || ''}
                    onChange={(e) => updateProduct(index, 'quantity', parseFloat(e.target.value) || 0, isActual)}
                  />
                </div>
                <div>
                  <Label>Cost/Unit (USD)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={product.costPerUnit || ''}
                    onChange={(e) => updateProduct(index, 'costPerUnit', parseFloat(e.target.value) || 0, isActual)}
                  />
                </div>
                <div>
                  <Label>Weight/Unit (kg)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={product.weightPerUnit || ''}
                    onChange={(e) => updateProduct(index, 'weightPerUnit', parseFloat(e.target.value) || 0, isActual)}
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => removeProduct(index, isActual)}
                    disabled={products.length === 1}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        <Button onClick={() => addProduct(isActual)} variant="outline">
          Add Product
        </Button>
      </div>
    );
  };

  const estimateResults = calculateCIF(estimateProducts);
  const actualResults = calculateCIF(actualProducts, actualFreightChampion, actualSwissport);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto py-8 px-4">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-4xl font-bold text-foreground flex items-center gap-2">
              <Calculator className="h-8 w-8 text-primary" />
              CIF Calculator
            </h1>
            <p className="text-muted-foreground mt-2">Calculate Cost, Insurance, and Freight pricing</p>
          </div>
          <div className="w-48 ml-auto">
            <Label>Exchange Rate (USD to Cg)</Label>
            <Input
              type="number"
              step="0.01"
              value={exchangeRate}
              onChange={(e) => handleExchangeRateChange(e.target.value)}
            />
          </div>
        </div>

        <Tabs defaultValue="estimate" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2 mb-8">
            <TabsTrigger value="estimate">Estimate</TabsTrigger>
            <TabsTrigger value="actual">Actual</TabsTrigger>
          </TabsList>

          <TabsContent value="estimate">
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>Estimate Version</CardTitle>
                <CardDescription>
                  Enter estimated product details. Freight costs will be calculated automatically.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {renderProductInputs(estimateProducts, false)}
              </CardContent>
            </Card>

            <div className="space-y-4">
              <h2 className="text-2xl font-bold">Results</h2>
              {renderResults(estimateResults.byWeight, 'Distribution by Weight')}
              {renderResults(estimateResults.byCost, 'Distribution by Cost')}
              {renderResults(estimateResults.equally, 'Equal Distribution')}
            </div>
          </TabsContent>

          <TabsContent value="actual">
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>Actual Version</CardTitle>
                <CardDescription>
                  Enter actual costs from your agents for precise calculations.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {renderProductInputs(actualProducts, true)}
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-6 border-t">
                  <div>
                    <Label>Freight Champion Total Cost (USD)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={actualFreightChampion || ''}
                      onChange={(e) => setActualFreightChampion(parseFloat(e.target.value) || 0)}
                      placeholder="Enter actual cost from agent"
                    />
                  </div>
                  <div>
                    <Label>Swissport Total Cost (USD)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={actualSwissport || ''}
                      onChange={(e) => setActualSwissport(parseFloat(e.target.value) || 0)}
                      placeholder="Enter actual cost from agent"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <h2 className="text-2xl font-bold">Results</h2>
              {renderResults(actualResults.byWeight, 'Distribution by Weight')}
              {renderResults(actualResults.byCost, 'Distribution by Cost')}
              {renderResults(actualResults.equally, 'Equal Distribution')}
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
