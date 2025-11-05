import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import { format } from 'date-fns';

interface Product {
  code: string;
  name: string;
  category: string;
  categoryName: string;
}

interface Customer {
  id: string;
  name: string;
}

interface ProductionData {
  [customerId: string]: {
    [productCode: string]: number;
  };
}

const PRODUCT_CATEGORIES = {
  HERBS_PACKS: {
    name: 'HERBS PACKS (xcd 2.00)',
    codes: ['HP_MINT', 'HP_PEPPERMINT', 'HP_BASIL', 'HP_PURPLE_BASIL', 'HP_YERBI_HOLE', 'HP_LEMON_BASIL', 
            'HP_LEMONGRASS', 'HP_OREGANO', 'HP_LIPPIA_ALBA', 'HP_CILANTRO', 'HP_PARSLEY', 'HP_ROMERO', 
            'HP_THYME', 'HP_DILL', 'HP_SAGE', 'HP_CHIVES', 'HP_TARRAGON', 'HP_MORINGA', 'HP_EUCALYPTUS', 
            'HP_BAY', 'HP_GUASCA', 'HP_CALENDULA', 'HP_CAMOMILE', 'HP_MARJORAM', 'HP_RUDA', 'HP_PARSLEY_ITALIAN']
  },
  HERBS_BOX: {
    name: 'HERBS BOX (xcc 11.00)',
    codes: ['HB_MINT', 'HB_BASIL', 'HB_LEMONGRASS', 'HB_ROMERO', 'HB_THYME', 'HB_LIPPIA_ALBA']
  },
  MICROGREENS: {
    name: 'MICROGREENS (xcc 5.00)',
    codes: ['MG_AMARANTH', 'MG_ARUGULA', 'MG_ITALIAN_BASIL', 'MG_MIZUNA', 'MG_MUSTARD', 
            'MG_GREEN_RADISH', 'MG_RED_RADISH', 'MG_TENDRIL']
  },
  SPROUTS: {
    name: 'SPROUTS (xcc 3.5)',
    codes: ['SP_TAUGE', 'SP_ALFALFA']
  }
};

const CUSTOMER_NAMES = [
  'VDT ZEELANDIA', 'BOULEVARD', 'LUNA PARK', 'ESPERAMOS CCB', 'VDT JANTHIEL',
  'VREUGDENHIL', 'CARREFOUR', 'ESPERAMOS JN', 'MANGUSA RIO', 'GOISCO',
  'BON BINI', 'ARCO IRIS', 'MANGUSA HYPER', 'GOISCO 2'
];

const ProductionInput = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [deliveryDate, setDeliveryDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [productionData, setProductionData] = useState<ProductionData>({});
  const [loading, setLoading] = useState(true);
  const [currentCustomerIndex, setCurrentCustomerIndex] = useState(0);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Load products
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('code, name')
        .or(`code.like.HP_%,code.like.HB_%,code.like.MG_%,code.like.SP_%`)
        .order('code');

      if (productsError) throw productsError;

      // Map products to categories
      const mappedProducts: Product[] = (productsData || []).map(p => {
        let category = '';
        let categoryName = '';
        
        if (p.code.startsWith('HP_')) {
          category = 'HERBS_PACKS';
          categoryName = PRODUCT_CATEGORIES.HERBS_PACKS.name;
        } else if (p.code.startsWith('HB_')) {
          category = 'HERBS_BOX';
          categoryName = PRODUCT_CATEGORIES.HERBS_BOX.name;
        } else if (p.code.startsWith('MG_')) {
          category = 'MICROGREENS';
          categoryName = PRODUCT_CATEGORIES.MICROGREENS.name;
        } else if (p.code.startsWith('SP_')) {
          category = 'SPROUTS';
          categoryName = PRODUCT_CATEGORIES.SPROUTS.name;
        }

        return {
          code: p.code,
          name: p.name,
          category,
          categoryName
        };
      });

      setProducts(mappedProducts);

      // Load or create customers
      const { data: existingCustomers } = await supabase
        .from('customers')
        .select('id, name')
        .in('name', CUSTOMER_NAMES);

      const existingNames = new Set(existingCustomers?.map(c => c.name) || []);
      const missingCustomers = CUSTOMER_NAMES.filter(name => !existingNames.has(name));

      // Create missing customers
      if (missingCustomers.length > 0) {
        const newCustomers = missingCustomers.map(name => ({
          name,
          address: 'To be updated',
          email: null,
          phone: null
        }));

        await supabase.from('customers').insert(newCustomers);
      }

      // Reload all customers
      const { data: allCustomers, error: customersError } = await supabase
        .from('customers')
        .select('id, name')
        .in('name', CUSTOMER_NAMES)
        .order('name');

      if (customersError) throw customersError;

      setCustomers(allCustomers || []);

      // Initialize production data
      const initialData: ProductionData = {};
      (allCustomers || []).forEach(customer => {
        initialData[customer.id] = {};
        mappedProducts.forEach(product => {
          initialData[customer.id][product.code] = 0;
        });
      });
      setProductionData(initialData);

    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const updateQuantity = (customerId: string, productCode: string, quantity: number) => {
    setProductionData(prev => ({
      ...prev,
      [customerId]: {
        ...prev[customerId],
        [productCode]: quantity
      }
    }));
  };

  const handleNext = () => {
    if (currentCustomerIndex < customers.length - 1) {
      setCurrentCustomerIndex(currentCustomerIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentCustomerIndex > 0) {
      setCurrentCustomerIndex(currentCustomerIndex - 1);
    }
  };

  const handleSubmit = async () => {
    try {
      // Create production order
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data: orderData, error: orderError } = await supabase
        .from('production_orders')
        .insert({
          order_date: format(new Date(), 'yyyy-MM-dd'),
          delivery_date: deliveryDate,
          status: 'planned',
          created_by: user?.id,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create production items
      const items = [];
      for (const customerId of Object.keys(productionData)) {
        for (const productCode of Object.keys(productionData[customerId])) {
          const quantity = productionData[customerId][productCode];
          if (quantity > 0) {
            items.push({
              production_order_id: orderData.id,
              customer_id: customerId,
              product_code: productCode,
              predicted_quantity: quantity,
              actual_quantity: null,
            });
          }
        }
      }

      if (items.length === 0) {
        toast({
          title: 'Error',
          description: 'Please enter at least one quantity',
          variant: 'destructive',
        });
        return;
      }

      const { error: itemsError } = await supabase
        .from('production_items')
        .insert(items);

      if (itemsError) throw itemsError;

      toast({
        title: 'Success',
        description: 'Production order created successfully',
      });

      navigate('/production');
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-xl text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const currentCustomer = customers[currentCustomerIndex];
  const groupedProducts: { [key: string]: Product[] } = {};
  
  products.forEach(product => {
    if (!groupedProducts[product.category]) {
      groupedProducts[product.category] = [];
    }
    groupedProducts[product.category].push(product);
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20">
      {/* Header */}
      <div className="bg-card border-b shadow-sm">
        <div className="container mx-auto px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate('/production')}>
                <ArrowLeft className="h-6 w-6" />
              </Button>
              <div>
                <h1 className="text-4xl font-bold text-foreground">Production Input</h1>
                <p className="text-lg text-muted-foreground">Create production order</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div>
                <Label>Delivery Date</Label>
                <Input
                  type="date"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  className="w-48"
                />
              </div>
              <Button onClick={handleSubmit} size="lg">
                <Save className="mr-2 h-5 w-5" />
                Submit Production Order
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-8 py-8">
        {/* Customer Progress */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <Button
                onClick={handlePrevious}
                disabled={currentCustomerIndex === 0}
                variant="outline"
              >
                Previous Customer
              </Button>
              <div className="text-center">
                <h2 className="text-3xl font-bold text-primary">
                  {currentCustomer?.name}
                </h2>
                <p className="text-muted-foreground">
                  Customer {currentCustomerIndex + 1} of {customers.length}
                </p>
              </div>
              <Button
                onClick={handleNext}
                disabled={currentCustomerIndex === customers.length - 1}
                variant="outline"
              >
                Next Customer
              </Button>
            </div>
            <div className="w-full bg-muted h-2 rounded-full">
              <div
                className="bg-primary h-2 rounded-full transition-all"
                style={{
                  width: `${((currentCustomerIndex + 1) / customers.length) * 100}%`
                }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Product Categories */}
        <div className="space-y-6">
          {Object.entries(groupedProducts).map(([category, categoryProducts]) => (
            <Card key={category}>
              <CardHeader className="bg-primary/10">
                <CardTitle className="text-2xl">
                  {categoryProducts[0]?.categoryName}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {categoryProducts.map(product => (
                    <div key={product.code} className="space-y-2">
                      <Label className="text-base font-medium">
                        {product.name}
                      </Label>
                      <Input
                        type="number"
                        min="0"
                        value={productionData[currentCustomer?.id]?.[product.code] || 0}
                        onChange={(e) =>
                          updateQuantity(
                            currentCustomer?.id,
                            product.code,
                            parseInt(e.target.value) || 0
                          )
                        }
                        className="text-lg font-semibold"
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ProductionInput;
