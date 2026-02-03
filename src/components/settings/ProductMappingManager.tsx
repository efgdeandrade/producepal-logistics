import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Trash2, Link as LinkIcon, Search, ArrowRight, Loader2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ImportProduct {
  code: string;
  name: string;
}

interface DistributionProduct {
  id: string;
  name: string;
  code: string;
}

interface ProductMapping {
  id: string;
  import_product_code: string;
  distribution_product_id: string;
  conversion_factor: number;
  import_product_name?: string;
  distribution_product_name?: string;
}

export const ProductMappingManager = () => {
  const [importProducts, setImportProducts] = useState<ImportProduct[]>([]);
  const [distributionProducts, setDistributionProducts] = useState<DistributionProduct[]>([]);
  const [mappings, setMappings] = useState<ProductMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // New mapping form state
  const [selectedImportProduct, setSelectedImportProduct] = useState<string>('');
  const [selectedDistProduct, setSelectedDistProduct] = useState<string>('');
  const [conversionFactor, setConversionFactor] = useState<string>('1');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [importRes, distRes, mappingsRes] = await Promise.all([
        supabase.from('products').select('code, name').order('name'),
        supabase.from('distribution_products').select('id, name, code').eq('is_active', true).order('name'),
        supabase.from('cross_department_product_mappings').select('*')
      ]);

      if (importRes.data) setImportProducts(importRes.data);
      if (distRes.data) setDistributionProducts(distRes.data);
      
      if (mappingsRes.data) {
        // Enrich mappings with product names
        const enrichedMappings = mappingsRes.data.map(m => ({
          ...m,
          import_product_name: importRes.data?.find(p => p.code === m.import_product_code)?.name,
          distribution_product_name: distRes.data?.find(p => p.id === m.distribution_product_id)?.name
        }));
        setMappings(enrichedMappings);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load product data');
    } finally {
      setLoading(false);
    }
  };

  const handleAddMapping = async () => {
    if (!selectedImportProduct || !selectedDistProduct) {
      toast.error('Please select both an Import product and a Distribution product');
      return;
    }

    // Check for existing mapping
    const exists = mappings.some(
      m => m.import_product_code === selectedImportProduct && m.distribution_product_id === selectedDistProduct
    );
    if (exists) {
      toast.error('This mapping already exists');
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('cross_department_product_mappings')
        .insert({
          import_product_code: selectedImportProduct,
          distribution_product_id: selectedDistProduct,
          conversion_factor: parseFloat(conversionFactor) || 1
        })
        .select()
        .single();

      if (error) throw error;

      const importProduct = importProducts.find(p => p.code === selectedImportProduct);
      const distProduct = distributionProducts.find(p => p.id === selectedDistProduct);

      setMappings(prev => [...prev, {
        ...data,
        import_product_name: importProduct?.name,
        distribution_product_name: distProduct?.name
      }]);

      setSelectedImportProduct('');
      setSelectedDistProduct('');
      setConversionFactor('1');
      toast.success('Product mapping created');
    } catch (error) {
      console.error('Error creating mapping:', error);
      toast.error('Failed to create mapping');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteMapping = async (mappingId: string) => {
    try {
      const { error } = await supabase
        .from('cross_department_product_mappings')
        .delete()
        .eq('id', mappingId);

      if (error) throw error;

      setMappings(prev => prev.filter(m => m.id !== mappingId));
      toast.success('Mapping removed');
    } catch (error) {
      console.error('Error deleting mapping:', error);
      toast.error('Failed to remove mapping');
    }
  };

  // Get unmapped Import products
  const unmappedImportProducts = importProducts.filter(
    ip => !mappings.some(m => m.import_product_code === ip.code)
  );

  // Filter products by search term
  const filteredMappings = mappings.filter(m =>
    (m.import_product_name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (m.distribution_product_name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    m.import_product_code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LinkIcon className="h-5 w-5" />
          Cross-Department Product Mappings
        </CardTitle>
        <CardDescription>
          Link Import products to their Distribution equivalents. This enables unified driver packing slips 
          that combine orders from both departments.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Add New Mapping */}
        <div className="p-4 border rounded-lg bg-muted/30 space-y-4">
          <h4 className="font-medium">Create New Mapping</h4>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="space-y-2">
              <Label>Import Product</Label>
              <Select value={selectedImportProduct} onValueChange={setSelectedImportProduct}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Import product..." />
                </SelectTrigger>
                <SelectContent>
                  {importProducts.map(p => (
                    <SelectItem key={p.code} value={p.code}>
                      {p.name} ({p.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-center">
              <ArrowRight className="h-5 w-5 text-muted-foreground" />
            </div>

            <div className="space-y-2">
              <Label>Distribution Product</Label>
              <Select value={selectedDistProduct} onValueChange={setSelectedDistProduct}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Distribution product..." />
                </SelectTrigger>
                <SelectContent>
                  {distributionProducts.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} ({p.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Conversion Factor</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={conversionFactor}
                  onChange={(e) => setConversionFactor(e.target.value)}
                  className="w-24"
                />
                <Button onClick={handleAddMapping} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add'}
                </Button>
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Conversion factor: 1 Import unit = X Distribution units (e.g., 1 case = 10 pieces)
          </p>
        </div>

        {/* Search existing mappings */}
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search mappings..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-xs"
          />
          <Badge variant="secondary">{mappings.length} mapping{mappings.length !== 1 ? 's' : ''}</Badge>
        </div>

        {/* Existing Mappings */}
        <div className="space-y-2">
          {filteredMappings.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <LinkIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No product mappings found</p>
              <p className="text-sm">Create your first mapping above to link Import and Distribution products</p>
            </div>
          ) : (
            filteredMappings.map(mapping => (
              <div
                key={mapping.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-4 flex-1">
                  <div className="flex-1">
                    <p className="font-medium">{mapping.import_product_name || mapping.import_product_code}</p>
                    <p className="text-xs text-muted-foreground">Import: {mapping.import_product_code}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="font-medium">{mapping.distribution_product_name || 'Unknown'}</p>
                    <p className="text-xs text-muted-foreground">Distribution</p>
                  </div>
                  <Badge variant="outline">×{mapping.conversion_factor}</Badge>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteMapping(mapping.id)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))
          )}
        </div>

        {/* Unmapped products hint */}
        {unmappedImportProducts.length > 0 && (
          <div className="text-sm text-muted-foreground">
            <strong>{unmappedImportProducts.length}</strong> Import product{unmappedImportProducts.length !== 1 ? 's' : ''} not yet mapped to Distribution
          </div>
        )}
      </CardContent>
    </Card>
  );
};
