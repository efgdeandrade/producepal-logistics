import { useState } from 'react';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Product, PRODUCTS } from '@/types/order';
import { PlusCircle, Pencil, Trash2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

const Products = () => {
  const [products, setProducts] = useState<Product[]>(PRODUCTS);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    packSize: '',
    supplierId: '',
    price: '',
    weight: '',
    unit: '',
  });

  // Mock suppliers - in real app, fetch from Suppliers page
  const suppliers = [
    { id: '1', name: 'Fresh Farms Co.' },
    { id: '2', name: 'Berry Suppliers Ltd.' },
  ];

  const handleOpenDialog = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        code: product.code,
        name: product.name,
        packSize: product.packSize.toString(),
        supplierId: product.supplierId || '',
        price: product.price?.toString() || '',
        weight: product.weight?.toString() || '',
        unit: product.unit || '',
      });
    } else {
      setEditingProduct(null);
      setFormData({ code: '', name: '', packSize: '', supplierId: '', price: '', weight: '', unit: '' });
    }
    setIsDialogOpen(true);
  };

  const handleSave = () => {
    if (!formData.code.trim() || !formData.name.trim() || !formData.packSize) {
      toast({
        title: 'Error',
        description: 'Product code, name, and pack size are required',
        variant: 'destructive',
      });
      return;
    }

    const productData: Product = {
      code: formData.code as any,
      name: formData.name,
      packSize: parseInt(formData.packSize),
      supplierId: formData.supplierId || undefined,
      price: formData.price ? parseFloat(formData.price) : undefined,
      weight: formData.weight ? parseFloat(formData.weight) : undefined,
      unit: formData.unit || undefined,
    };

    if (editingProduct) {
      setProducts(products.map(p => 
        p.code === editingProduct.code ? productData : p
      ));
      toast({
        title: 'Success',
        description: 'Product updated successfully',
      });
    } else {
      setProducts([...products, productData]);
      toast({
        title: 'Success',
        description: 'Product added successfully',
      });
    }
    setIsDialogOpen(false);
  };

  const handleDelete = (code: string) => {
    setProducts(products.filter(p => p.code !== code));
    toast({
      title: 'Success',
      description: 'Product deleted successfully',
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Products</h1>
            <p className="text-muted-foreground">Manage your product catalog, pricing, and supplier information</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Add Product
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingProduct ? 'Edit Product' : 'Add New Product'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="code">Product Code *</Label>
                    <Input
                      id="code"
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                      placeholder="e.g., STB_500"
                      disabled={!!editingProduct}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="name">Product Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g., Strawberries 500g"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="packSize">Pack Size (units per tray) *</Label>
                    <Input
                      id="packSize"
                      type="number"
                      value={formData.packSize}
                      onChange={(e) => setFormData({ ...formData, packSize: e.target.value })}
                      placeholder="e.g., 10"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="supplier">Supplier</Label>
                    <Select
                      value={formData.supplierId}
                      onValueChange={(value) => setFormData({ ...formData, supplierId: value })}
                    >
                      <SelectTrigger id="supplier">
                        <SelectValue placeholder="Select supplier" />
                      </SelectTrigger>
                      <SelectContent>
                        {suppliers.map((supplier) => (
                          <SelectItem key={supplier.id} value={supplier.id}>
                            {supplier.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="price">Price per Tray</Label>
                    <Input
                      id="price"
                      type="number"
                      step="0.01"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="weight">Weight</Label>
                    <Input
                      id="weight"
                      type="number"
                      step="0.01"
                      value={formData.weight}
                      onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="unit">Unit</Label>
                    <Input
                      id="unit"
                      value={formData.unit}
                      onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                      placeholder="e.g., kg, g"
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSave}>
                  {editingProduct ? 'Update' : 'Add'} Product
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <Card key={product.code}>
              <CardHeader>
                <CardTitle>{product.name}</CardTitle>
                <CardDescription>Code: {product.code}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm mb-4">
                  <p className="text-muted-foreground">
                    <span className="font-medium">Pack Size:</span> {product.packSize} units/tray
                  </p>
                  {product.price && (
                    <p className="text-muted-foreground">
                      <span className="font-medium">Price:</span> ${product.price.toFixed(2)}/tray
                    </p>
                  )}
                  {product.weight && product.unit && (
                    <p className="text-muted-foreground">
                      <span className="font-medium">Weight:</span> {product.weight}{product.unit}
                    </p>
                  )}
                  {product.supplierId && (
                    <p className="text-muted-foreground">
                      <span className="font-medium">Supplier:</span> {
                        suppliers.find(s => s.id === product.supplierId)?.name || 'Unknown'
                      }
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenDialog(product)}
                  >
                    <Pencil className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(product.code)}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
};

export default Products;
