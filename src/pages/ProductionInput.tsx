import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { Separator } from '@/components/ui/separator';

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
    name: 'HERBS PACKS',
    price: 'xcd 2.00',
    codes: ['HP_MINT', 'HP_PEPPERMINT', 'HP_BASIL', 'HP_PURPLE_BASIL', 'HP_YERBI_HOLE', 'HP_LEMON_BASIL', 
            'HP_LEMONGRASS', 'HP_OREGANO', 'HP_LIPPIA_ALBA', 'HP_CILANTRO', 'HP_PARSLEY', 'HP_ROMERO', 
            'HP_THYME', 'HP_DILL', 'HP_SAGE', 'HP_CHIVES', 'HP_TARRAGON', 'HP_MORINGA', 'HP_EUCALYPTUS', 
            'HP_BAY', 'HP_GUASCA', 'HP_CALENDULA', 'HP_CAMOMILE', 'HP_MARJORAM', 'HP_RUDA', 'HP_PARSLEY_ITALIAN']
  },
  HERBS_BOX: {
    name: 'HERBS BOX',
    price: 'xcc 11.00',
    codes: ['HB_MINT', 'HB_BASIL', 'HB_LEMONGRASS', 'HB_ROMERO', 'HB_THYME', 'HB_LIPPIA_ALBA']
  },
  MICROGREENS: {
    name: 'MICROGREENS',
    price: 'xcc 5.00',
    codes: ['MG_AMARANTH', 'MG_ARUGULA', 'MG_ITALIAN_BASIL', 'MG_MIZUNA', 'MG_MUSTARD', 
            'MG_GREEN_RADISH', 'MG_RED_RADISH', 'MG_TENDRIL']
  },
  SPROUTS: {
    name: 'SPROUTS',
    price: 'xcc 3.50',
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
    checkAuthAndLoadData();
  }, []);

  const checkAuthAndLoadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({
          title: 'Authentication Required',
          description: 'Please log in to access production input',
          variant: 'destructive',
        });
        navigate('/auth');
        return;
      }
      
      await loadData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
      navigate('/auth');
    }
  };

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

      // Load customers
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
      <div className="bg-card border-b shadow-sm sticky top-0 z-10">
        <div className="container mx-auto px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate('/production')}>
                <ArrowLeft className="h-6 w-6" />
              </Button>
              <div>
                <h1 className="text-3xl font-bold text-foreground">Production Input</h1>
                <p className="text-sm text-muted-foreground">Enter quantities for {currentCustomer?.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div>
                <Label className="text-xs">Delivery Date</Label>
                <Input
                  type="date"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  className="w-44"
                />
              </div>
              <Button onClick={handleSubmit} size="lg" className="h-auto py-3">
                <Save className="mr-2 h-5 w-5" />
                Submit Order
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-8 py-6">
        {/* Customer Navigation */}
        <Card className="mb-6 border-2 border-primary/20">
          <CardContent className="py-6">
            <div className="flex items-center justify-between">
              <Button
                onClick={handlePrevious}
                disabled={currentCustomerIndex === 0}
                size="lg"
                variant="outline"
              >
                <ChevronLeft className="mr-2 h-5 w-5" />
                Previous
              </Button>
              
              <div className="text-center flex-1 mx-8">
                <h2 className="text-4xl font-bold text-primary mb-2">
                  {currentCustomer?.name}
                </h2>
                <p className="text-lg text-muted-foreground mb-4">
                  Customer {currentCustomerIndex + 1} of {customers.length}
                </p>
                <div className="w-full bg-muted h-3 rounded-full overflow-hidden">
                  <div
                    className="bg-primary h-3 transition-all duration-300"
                    style={{
                      width: `${((currentCustomerIndex + 1) / customers.length) * 100}%`
                    }}
                  />
                </div>
              </div>
              
              <Button
                onClick={handleNext}
                disabled={currentCustomerIndex === customers.length - 1}
                size="lg"
                variant="outline"
              >
                Next
                <ChevronRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Product Categories */}
        <div className="grid gap-6 md:grid-cols-2">
          {Object.entries(groupedProducts).map(([category, categoryProducts]) => {
            const categoryInfo = PRODUCT_CATEGORIES[category as keyof typeof PRODUCT_CATEGORIES];
            return (
              <Card key={category} className="border-2">
                <CardHeader className="bg-primary/5 border-b-2 border-primary/10">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-2xl font-bold">
                      {categoryInfo?.name}
                    </CardTitle>
                    <span className="text-sm font-semibold text-muted-foreground bg-background px-3 py-1 rounded-full">
                      {categoryInfo?.price}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-2 gap-4">
                    {categoryProducts.map(product => {
                      const currentQty = productionData[currentCustomer?.id]?.[product.code] || 0;
                      return (
                        <div key={product.code} className="space-y-2">
                          <Label className="text-sm font-medium text-muted-foreground">
                            {product.name}
                          </Label>
                          <Input
                            type="number"
                            min="0"
                            value={currentQty || ''}
                            onChange={(e) =>
                              updateQuantity(
                                currentCustomer?.id,
                                product.code,
                                parseInt(e.target.value) || 0
                              )
                            }
                            placeholder="0"
                            className={`text-xl font-bold text-center h-12 ${
                              currentQty > 0 ? 'border-primary border-2' : ''
                            }`}
                          />
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ProductionInput;
