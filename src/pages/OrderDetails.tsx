import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Printer, Ban, Edit, Eye, Download, Receipt, ChevronDown, FileEdit, ExternalLink, Truck, RefreshCw, Calculator, Check, AlertCircle, Copy, LayoutTemplate, MoreVertical, Smartphone, History, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import LoadingBox from '@/components/LoadingBox';
import { ReceiptEditDialog } from '@/components/ReceiptEditDialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { CustomerPackingSlip } from '@/components/CustomerPackingSlip';
import { SupplierOrderList } from '@/components/SupplierOrderList';
import { RoundupTable } from '@/components/RoundupTable';
import { CustomerReceipt } from '@/components/CustomerReceipt';
import { PalletVisualization } from '@/components/PalletVisualization';
import { LandedCostPanel } from '@/components/import/LandedCostPanel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import html2pdf from 'html2pdf.js';
import { DriverAssignmentDialog } from '@/components/DriverAssignmentDialog';
import { DriverPackingSlip } from '@/components/DriverPackingSlip';
import { 
  generateReceiptNumber, 
  saveReceiptRecord, 
  generateReceiptPDF,
  generateMultipleReceiptsPDF,
  generateAndDownloadSupplierPDFs,
  downloadBlob,
  ReceiptData 
} from '@/utils/receiptGenerator';
import { calculateOrderPalletConfig, ProductWeightInfo } from '@/lib/weightCalculations';
import { formatCuracao } from '@/lib/dateUtils';
import { MTRExportDialog } from '@/components/fnb/MTRExportDialog';
import type { MTRReceiptData } from '@/utils/mtrExportEngine';
import { useReceiptVersions, type ReceiptVersion, type ReceiptLineItem } from '@/hooks/useReceiptVersions';
import { PackingSlipFromReceipts } from '@/components/PackingSlipFromReceipts';

interface OrderItem {
  id: string;
  customer_name: string;
  product_code: string;
  quantity: number;
  units_quantity?: number | null;
  po_number?: string;
  is_from_stock?: boolean;
  sale_price_xcg?: number | null;
  stock_quantity?: number | null;
}

interface Order {
  id: string;
  order_number: string;
  week_number: number;
  delivery_date: string;
  placed_by: string;
  status: string;
  created_at: string;
  notes?: string;
}

const OrderDetails = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [order, setOrder] = useState<Order | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewDialog, setViewDialog] = useState<'packing' | 'supplier' | 'roundup' | 'receipt' | 'driver' | null>(null);
  const [printFormat, setPrintFormat] = useState<'a4' | 'receipt'>('a4');
  const [showFormatDialog, setShowFormatDialog] = useState(false);
  const [pendingAction, setPendingAction] = useState<{type: 'packing' | 'supplier' | 'roundup' | 'receipt' | 'driver', action: 'view' | 'print' | 'download'} | null>(null);
  const [showReceiptCustomerDialog, setShowReceiptCustomerDialog] = useState(false);
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);
  const [receiptNumbers, setReceiptNumbers] = useState<Record<string, string>>({});
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [palletConfig, setPalletConfig] = useState<any>(null);
  const [orderItemsExpanded, setOrderItemsExpanded] = useState(false);
  const [showEditReceiptDialog, setShowEditReceiptDialog] = useState(false);
  const [editableReceiptItems, setEditableReceiptItems] = useState<OrderItem[]>([]);
  const [showSupplierSelectDialog, setShowSupplierSelectDialog] = useState(false);
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([]);
  const [availableSuppliers, setAvailableSuppliers] = useState<string[]>([]);
  const [showDriverAssignmentDialog, setShowDriverAssignmentDialog] = useState(false);
  const [driverAssignments, setDriverAssignments] = useState<{
    driver_name: string; 
    customer_names: string[]; 
    distribution_customer_ids?: string[];
    sequence_number: number;
    include_distribution?: boolean;
  }[]>([]);
  const printRef = useRef<HTMLDivElement>(null);
  const [showMTRDialog, setShowMTRDialog] = useState(false);
  const [mtrReceiptData, setMtrReceiptData] = useState<MTRReceiptData | null>(null);
  
  // Receipt versioning
  const { savedReceipts, loading: loadingReceipts, fetchSavedReceipts, fetchReceiptLineItems, saveReceiptVersion } = useReceiptVersions(orderId);
  const [showRecallDialog, setShowRecallDialog] = useState(false);
  const [recalledReceiptMeta, setRecalledReceiptMeta] = useState<ReceiptVersion | null>(null);
  const [recalledLineItems, setRecalledLineItems] = useState<ReceiptLineItem[]>([]);
  
  // Pre-loaded data for receipt generation to prevent race conditions
  const [preloadedProducts, setPreloadedProducts] = useState<any[]>([]);
  const [preloadedCompanyInfo, setPreloadedCompanyInfo] = useState<any>(null);
  const [receiptsReady, setReceiptsReady] = useState<Set<string>>(new Set());
  const [allReceiptsRendered, setAllReceiptsRendered] = useState(false);

  useEffect(() => {
    if (orderId) {
      fetchOrderDetails();
      fetchSavedReceipts();
    }
  }, [orderId, location.state]);

  // Preload data needed for receipt rendering to prevent race conditions
  const preloadReceiptData = async () => {
    try {
      const [productsResult, companyResult] = await Promise.all([
        supabase.from('products').select('code, name, pack_size, wholesale_price_xcg_per_unit'),
        supabase.from('settings').select('value').eq('key', 'company_info').single()
      ]);
      
      if (productsResult.data) setPreloadedProducts(productsResult.data);
      if (companyResult.data) setPreloadedCompanyInfo(companyResult.data.value);
      
      return { products: productsResult.data, companyInfo: companyResult.data?.value };
    } catch (error) {
      console.error('Error preloading receipt data:', error);
      return null;
    }
  };

  // Track when a receipt is ready for capture
  const handleReceiptReady = (customerName: string) => {
    setReceiptsReady(prev => {
      const newSet = new Set(prev);
      newSet.add(customerName);
      return newSet;
    });
  };

  // Check if all receipts are ready
  useEffect(() => {
    if (viewDialog === 'receipt' && selectedCustomers.length > 0) {
      const allReady = selectedCustomers.every(c => receiptsReady.has(c));
      setAllReceiptsRendered(allReady);
    }
  }, [receiptsReady, selectedCustomers, viewDialog]);

  const fetchOrderDetails = async () => {
    try {
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();

      if (orderError) throw orderError;

      const { data: itemsData, error: itemsError } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', orderId);

      if (itemsError) throw itemsError;

      setOrder(orderData);
      setOrderItems(itemsData || []);
      
      // Calculate pallet configuration for display
      await calculatePalletConfig(itemsData || []);
    } catch (error: any) {
      console.error('Error fetching order details:', error);
      toast.error('Failed to load order details');
    } finally {
      setLoading(false);
    }
  };

  const calculatePalletConfig = async (items: OrderItem[]) => {
    try {
      // Filter out stock items - they don't need pallet calculation (already in warehouse)
      const importItems = items.filter(item => !item.is_from_stock);
      
      // Consolidate items by product code
      const consolidated = importItems.reduce((acc, item) => {
        const existing = acc.find(i => i.product_code === item.product_code);
        if (existing) {
          existing.quantity += item.quantity;
          if (item.units_quantity != null) {
            existing.units_quantity = (existing.units_quantity || 0) + item.units_quantity;
          }
        } else {
          acc.push({ ...item });
        }
        return acc;
      }, [] as OrderItem[]);

      // Fetch product details
      const productCodes = [...new Set(consolidated.map(item => item.product_code))];
      const { data: products } = await supabase
        .from('products')
        .select(`
          code, name, gross_weight_per_unit, netto_weight_per_unit, 
          pack_size, empty_case_weight, length_cm, width_cm, height_cm, supplier_id,
          suppliers:supplier_id (id, name)
        `)
        .in('code', productCodes);

      if (!products) return;

      // Build product weight info for pallet calculation
      const productsWithWeight: Array<ProductWeightInfo & { supplierId: string; supplierName: string }> = consolidated
        .map(item => {
          const product = products.find(p => p.code === item.product_code);
          if (!product) return null;

          const supplier = product.suppliers as any;
          
          return {
            code: product.code,
            name: product.name,
            nettoWeightPerUnit: (product.netto_weight_per_unit || 0) / 1000,
            grossWeightPerUnit: (product.gross_weight_per_unit || 0) / 1000,
            packSize: product.pack_size || 1,
            emptyCaseWeight: (product.empty_case_weight || 0) / 1000,
            lengthCm: product.length_cm || 0,
            widthCm: product.width_cm || 0,
            heightCm: product.height_cm || 0,
            quantity: item.units_quantity ?? (item.quantity * (product.pack_size || 1)),
            supplierId: product.supplier_id || 'unknown',
            supplierName: supplier?.name || 'Unknown Supplier',
          };
        })
        .filter(Boolean) as Array<ProductWeightInfo & { supplierId: string; supplierName: string }>;

      // Calculate pallet configuration
      const palletConfiguration = calculateOrderPalletConfig(productsWithWeight);
      setPalletConfig(palletConfiguration);
    } catch (error) {
      console.error('Error calculating pallet config:', error);
    }
  };

  const handleVoidOrder = async () => {
    if (!order) return;
    
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: 'void' })
        .eq('id', order.id);

      if (error) throw error;

      toast.success('Order voided successfully');
      fetchOrderDetails();
    } catch (error: any) {
      console.error('Error voiding order:', error);
      toast.error('Failed to void order');
    }
  };

  const [isDuplicating, setIsDuplicating] = useState(false);

  const handleDuplicateOrder = async () => {
    if (!order || isDuplicating) return;
    setIsDuplicating(true);
    
    try {
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        toast.error('You must be logged in to duplicate an order');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .maybeSingle();

      // Generate new order number
      const now = new Date();
      const newOrderNumber = `ORD-${now.getTime()}`;
      const weekNumber = Math.ceil((now.getDate() + new Date(now.getFullYear(), now.getMonth(), 1).getDay()) / 7);
      
      // Create new order
      const { data: newOrder, error: orderError } = await supabase
        .from('orders')
        .insert({
          order_number: newOrderNumber,
          week_number: weekNumber,
          delivery_date: order.delivery_date,
          placed_by: profile?.full_name || user.email || 'Unknown',
          user_id: user.id,
          // Orders table enforces allowed statuses via DB constraint
          status: 'active',
          notes: `Duplicated from ${order.order_number}`
        })
        .select()
        .single();
      
      if (orderError) {
        console.error('Order insert error:', orderError);
        throw orderError;
      }

      if (!newOrder) {
        throw new Error('Failed to create new order - no data returned');
      }
      
      // Duplicate order items
      if (orderItems.length > 0) {
        const itemsToInsert = orderItems.map(item => ({
          order_id: newOrder.id,
          customer_name: item.customer_name,
          product_code: item.product_code,
          quantity: item.quantity,
          units_quantity: item.units_quantity ?? null,
          po_number: item.po_number ?? null,
          sale_price_xcg: item.sale_price_xcg ?? null,
          is_from_stock: item.is_from_stock ?? false,
          stock_quantity: (item as any).stock_quantity ?? 0,
        }));
        
        const { error: itemsError } = await supabase
          .from('order_items')
          .insert(itemsToInsert);
        
        if (itemsError) {
          console.error('Order items insert error:', itemsError);
          // Clean up the created order if items fail
          await supabase.from('orders').delete().eq('id', newOrder.id);
          throw itemsError;
        }
      }
      
      toast.success(`Order duplicated as ${newOrderNumber}`);
      navigate(`/import/orders/${newOrder.id}`);
    } catch (error: any) {
      console.error('Error duplicating order:', error);
      toast.error(`Failed to duplicate order: ${error.message || 'Unknown error'}`);
    } finally {
      setIsDuplicating(false);
    }
  };

  const handleCreateTemplate = async () => {
    if (!order || orderItems.length === 0) {
      toast.error('No items to create template from');
      return;
    }
    
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      
      // Create template with a default name
      const templateName = `Template from ${order.order_number}`;
      const dayOfWeek = new Date(order.delivery_date).getDay();
      
      const { data: template, error: templateError } = await supabase
        .from('day_order_templates')
        .insert({
          name: templateName,
          day_of_week: dayOfWeek,
          is_active: true,
          notes: `Created from order ${order.order_number}`,
          created_by: user?.id
        })
        .select()
        .single();
      
      if (templateError) throw templateError;
      
      // Get customer IDs for the template items
      const customerNames = [...new Set(orderItems.map(item => item.customer_name))];
      const { data: customers } = await supabase
        .from('customers')
        .select('id, name')
        .in('name', customerNames);
      
      const customerMap = new Map(customers?.map(c => [c.name, c.id]) || []);
      
      // Create template items
      const templateItems = orderItems
        .filter(item => customerMap.has(item.customer_name))
        .map((item, index) => ({
          template_id: template.id,
          customer_id: customerMap.get(item.customer_name)!,
          customer_name: item.customer_name,
          product_code: item.product_code,
          default_quantity: item.quantity,
          sort_order: index
        }));
      
      if (templateItems.length > 0) {
        const { error: itemsError } = await supabase
          .from('day_order_template_items')
          .insert(templateItems);
        
        if (itemsError) throw itemsError;
      }
      
      toast.success(`Template "${templateName}" created with ${templateItems.length} items`);
    } catch (error: any) {
      console.error('Error creating template:', error);
      toast.error('Failed to create template');
    }
  };

  const handleAction = (type: 'packing' | 'supplier' | 'roundup' | 'receipt', action: 'view' | 'print' | 'download') => {
    setPendingAction({ type, action });
    setShowFormatDialog(true);
  };

  const handleCreateReceipt = () => {
    setShowReceiptCustomerDialog(true);
  };

  const handleCustomerToggle = (customerName: string) => {
    setSelectedCustomers(prev => 
      prev.includes(customerName) 
        ? prev.filter(c => c !== customerName)
        : [...prev, customerName]
    );
  };

  const handleConfirmCustomers = () => {
    if (selectedCustomers.length === 0) {
      toast.error('Please select at least one customer');
      return;
    }
    setShowReceiptCustomerDialog(false);
    setPendingAction({ type: 'receipt', action: 'view' });
    setShowFormatDialog(true);
  };

  const handleEditBeforeReceipt = () => {
    if (selectedCustomers.length === 0) {
      toast.error('Please select at least one customer');
      return;
    }
    setShowReceiptCustomerDialog(false);
    setShowEditReceiptDialog(true);
  };

  const handleConfirmEditedReceipt = async (editedItems: OrderItem[]) => {
    setEditableReceiptItems(editedItems);
    setShowEditReceiptDialog(false);

    // If editing a recalled receipt, save as new version immediately
    if (recalledReceiptMeta) {
      try {
        const { data: productsData } = await supabase
          .from('products')
          .select('code, name, pack_size, wholesale_price_xcg_per_unit')
          .in('code', editedItems.map(i => i.product_code));

        const customerItems = editedItems.filter(i => i.customer_name === recalledReceiptMeta.customer_name);
        const amount = customerItems.reduce((sum, item) => {
          const product = productsData?.find(p => p.code === item.product_code);
          const packSize = product?.pack_size || 1;
          const unitPrice = item.sale_price_xcg ?? product?.wholesale_price_xcg_per_unit ?? 0;
          return sum + (item.quantity * packSize * unitPrice);
        }, 0);

        const versionItems = customerItems.map((item, idx) => {
          const product = productsData?.find(p => p.code === item.product_code);
          const packSize = product?.pack_size || 1;
          const unitPrice = item.sale_price_xcg ?? product?.wholesale_price_xcg_per_unit ?? 0;
          return {
            product_code: item.product_code,
            product_name: product?.name || item.product_code,
            quantity: item.quantity,
            unit_price: unitPrice,
            line_total: item.quantity * packSize * unitPrice,
            sort_order: idx,
          };
        });

        await saveReceiptVersion({
          receiptNumber: recalledReceiptMeta.receipt_number,
          orderId: recalledReceiptMeta.order_id,
          customerId: recalledReceiptMeta.customer_id,
          customerName: recalledReceiptMeta.customer_name,
          orderNumber: recalledReceiptMeta.order_number,
          amount,
          deliveryDate: recalledReceiptMeta.delivery_date || undefined,
          notes: 'Edited version',
          items: versionItems,
        });

        toast.success(`Saved new version for ${recalledReceiptMeta.receipt_number}`);
        fetchSavedReceipts();

        // Show updated receipt
        setReceiptNumbers({ [recalledReceiptMeta.customer_name]: recalledReceiptMeta.receipt_number });
        setSelectedCustomers([recalledReceiptMeta.customer_name]);
        await preloadReceiptData();
        setReceiptsReady(new Set());
        setAllReceiptsRendered(false);
        setViewDialog('receipt');
        setPendingAction({ type: 'receipt', action: 'view' });
        setRecalledReceiptMeta(null);
        return;
      } catch (err) {
        console.error('Error saving receipt version:', err);
        toast.error('Failed to save receipt version');
      }
    }

    setPendingAction({ type: 'receipt', action: 'view' });
    setShowFormatDialog(true);
  };

  const getUniqueCustomers = () => {
    return [...new Set(orderItems.map(item => item.customer_name))];
  };

  const fetchAvailableSuppliers = async () => {
    try {
      // Get unique product codes from order items (excluding stock items)
      const productCodes = [...new Set(orderItems.filter(item => !item.is_from_stock).map(item => item.product_code))];
      
      if (productCodes.length === 0) {
        setAvailableSuppliers([]);
        return;
      }
      
      // Fetch products with their suppliers
      const { data: products } = await supabase
        .from('products')
        .select('code, suppliers:supplier_id(id, name)')
        .in('code', productCodes);
      
      if (!products) {
        setAvailableSuppliers([]);
        return;
      }
      
      // Extract unique supplier names
      const supplierNames = products
        .map(p => (p.suppliers as any)?.name)
        .filter(Boolean);
      
      const uniqueSuppliers = [...new Set(supplierNames)].sort();
      setAvailableSuppliers(uniqueSuppliers);
      setSelectedSuppliers(uniqueSuppliers); // Select all by default
    } catch (error) {
      console.error('Error fetching suppliers:', error);
      setAvailableSuppliers([]);
    }
  };

  const handleSupplierToggle = (supplierName: string) => {
    setSelectedSuppliers(prev => 
      prev.includes(supplierName) 
        ? prev.filter(s => s !== supplierName)
        : [...prev, supplierName]
    );
  };

  const handleSelectAllSuppliers = () => {
    if (selectedSuppliers.length === availableSuppliers.length) {
      setSelectedSuppliers([]);
    } else {
      setSelectedSuppliers([...availableSuppliers]);
    }
  };

  const handleSupplierDownloadClick = async () => {
    await fetchAvailableSuppliers();
    setShowSupplierSelectDialog(true);
  };

  const handleConfirmSupplierDownload = () => {
    if (selectedSuppliers.length === 0) {
      toast.error('Please select at least one supplier');
      return;
    }
    setShowSupplierSelectDialog(false);
    setPendingAction({ type: 'supplier', action: 'download' });
    setShowFormatDialog(true);
  };

  const handleConfirmFormat = async (actionOverride?: 'view' | 'print' | 'download') => {
    setShowFormatDialog(false);
    
    if (!pendingAction) return;

    const { type, action: originalAction } = pendingAction;
    const action = actionOverride || originalAction;

    // Generate receipt numbers for receipts if needed
    if (type === 'receipt' && (action === 'print' || action === 'download')) {
      try {
        const numbers: Record<string, string> = {};
        
        // Use edited items if available, otherwise use original order items
        const itemsForReceipt = editableReceiptItems.length > 0 ? editableReceiptItems : orderItems;
        
        // Generate receipt numbers for selected customers
        for (const customerName of selectedCustomers) {
          const receiptNumber = await generateReceiptNumber();
          numbers[customerName] = receiptNumber;
          
          // Calculate customer total using the correct items source
          const customerItems = itemsForReceipt.filter(item => item.customer_name === customerName);
          const { data: productsData } = await supabase
            .from('products')
            .select('code, name, pack_size, wholesale_price_xcg_per_unit')
            .in('code', customerItems.map(item => item.product_code));
          
          const amount = customerItems.reduce((sum, item) => {
            const product = productsData?.find(p => p.code === item.product_code);
            if (!product || !product.wholesale_price_xcg_per_unit) return sum;
            const units = item.quantity * product.pack_size;
            return sum + (units * product.wholesale_price_xcg_per_unit);
          }, 0);
          
          // Get customer ID
          const { data: customerData } = await supabase
            .from('customers')
            .select('id')
            .eq('name', customerName)
            .maybeSingle();
          
          // Save receipt record (legacy table)
          await saveReceiptRecord({
            receiptNumber,
            customerName,
            customerId: customerData?.id,
            orderId: order!.id,
            orderNumber: order!.order_number,
            amount,
            deliveryDate: order!.delivery_date
          });

          // Save receipt version with line items (new versioned system)
          const versionItems = customerItems.map((item, idx) => {
            const product = productsData?.find(p => p.code === item.product_code);
            const packSize = product?.pack_size || 1;
            const unitPrice = item.sale_price_xcg ?? product?.wholesale_price_xcg_per_unit ?? 0;
            const units = item.quantity * packSize;
            return {
              product_code: item.product_code,
              product_name: product?.name || item.product_code,
              quantity: item.quantity,
              unit_price: unitPrice,
              line_total: units * unitPrice,
              sort_order: idx,
            };
          });

          await saveReceiptVersion({
            receiptNumber,
            orderId: order!.id,
            customerId: customerData?.id,
            customerName,
            orderNumber: order!.order_number,
            amount,
            deliveryDate: order!.delivery_date,
            items: versionItems,
          });
        }
        
        setReceiptNumbers(numbers);
        toast.success(`Generated ${selectedCustomers.length} receipt number${selectedCustomers.length !== 1 ? 's' : ''}`);
        // Refresh saved receipts list
        fetchSavedReceipts();
      } catch (error) {
        console.error('Error generating receipt numbers:', error);
        toast.error('Failed to generate receipt numbers');
        return;
      }
    }

    // Preload data for receipts to prevent race conditions during PDF capture
    if (type === 'receipt') {
      // Reset receipt ready tracking
      setReceiptsReady(new Set());
      setAllReceiptsRendered(false);
      
      // Preload products and company info
      await preloadReceiptData();
    }

    // Always show preview first for print and download
    if (action === 'print' || action === 'download') {
      setViewDialog(type);
      // Store the original action so we can execute it from the preview
      setPendingAction({ type, action });
    } else {
      // For view action, just show the dialog
      setViewDialog(type);
      setPendingAction(null);
      if (type === 'receipt') {
        setSelectedCustomers([]);
      }
    }
  };

  const handlePrintFromPreview = async () => {
    if (!printRef.current || !order) return;

    setGeneratingPDF(true);
    
    try {
      // Small delay to ensure DOM is fully rendered
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Generate a PDF from the preview DOM and print that PDF.
      // This avoids blank-page issues caused by print CSS + dialog/portal rendering.
      const filename = `${viewDialog || 'document'}-${order.order_number}.pdf`;
      const pdfBlob = await generateReceiptPDF(printRef.current, filename, printFormat);
      
      if (!pdfBlob || pdfBlob.size === 0) {
        throw new Error('Generated PDF is empty');
      }
      
      const url = URL.createObjectURL(pdfBlob);

      const printWindow = window.open(url, '_blank');
      if (!printWindow) {
        toast.error('Pop-up blocked. Please allow pop-ups to print.');
        URL.revokeObjectURL(url);
        return;
      }

      // Wait for the PDF to load, then open the print dialog.
      printWindow.addEventListener(
        'load',
        () => {
          printWindow.focus();
          printWindow.print();
          // Revoke later to allow the print dialog to complete.
          setTimeout(() => URL.revokeObjectURL(url), 10_000);
        },
        { once: true }
      );
    } catch (error) {
      console.error('Print failed:', error);
      toast.error('Failed to generate PDF. Please try again.');
    } finally {
      setGeneratingPDF(false);
    }
  };

  const handleDownloadFromPreview = async () => {
    if (!printRef.current || !order) return;
    
    // Handle receipts with multiple customers differently
    if (viewDialog === 'receipt' && selectedCustomers.length > 1) {
      setGeneratingPDF(true);
      
      try {
        // Wait for all receipts to be rendered with a timeout
        const maxWaitTime = 10000; // 10 seconds max
        const pollInterval = 200;
        let waited = 0;
        
        while (!allReceiptsRendered && waited < maxWaitTime) {
          await new Promise(resolve => setTimeout(resolve, pollInterval));
          waited += pollInterval;
        }
        
        if (!allReceiptsRendered) {
          console.warn('Not all receipts reported ready, proceeding anyway after timeout');
        }
        
        // Additional delay to ensure DOM is fully painted
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Use edited items if available
        const itemsForReceipt = editableReceiptItems.length > 0 ? editableReceiptItems : orderItems;
        
        // Create receipt data array
        const receipts = selectedCustomers.map((customerName) => {
          const receiptNumber = receiptNumbers[customerName];
          const customerItems = itemsForReceipt.filter(item => item.customer_name === customerName);
          
          // Calculate amount
          const amount = customerItems.reduce((sum, item) => {
            // We'll need to fetch product info for accurate pricing
            return sum; // Placeholder - will be calculated in receipt component
          }, 0);
          
          // Find the div for this customer
          const receiptDiv = printRef.current!.querySelector(`[data-customer="${customerName}"]`) as HTMLElement;
          
          return {
            element: receiptDiv,
            receiptNumber: receiptNumber || `${order.order_number}-${customerName.replace(/\s+/g, '-')}`,
            customerName
          };
        }).filter(r => r.element); // Filter out any that don't have elements
        
        if (receipts.length === 0) {
          throw new Error('No receipt elements found');
        }
        
        // Generate ZIP with all PDFs
        const zipBlob = await generateMultipleReceiptsPDF(
          receipts,
          printFormat,
          order.order_number,
          (current, total) => {
            toast.loading(`Generating receipt ${current} of ${total}...`, { id: 'receipt-progress' });
          }
        );
        
        // Dismiss progress toast
        toast.dismiss('receipt-progress');
        
        // Download as single multi-page PDF
        const zipFilename = `Receipts-${order.order_number}.pdf`;
        downloadBlob(zipBlob, zipFilename);
        
        toast.success(`Downloaded ${receipts.length} receipts as multi-page PDF`);
        setViewDialog(null);
        setPendingAction(null);
        setSelectedCustomers([]);
        setReceiptNumbers({});
        setEditableReceiptItems([]);
      } catch (error) {
        console.error('Error generating PDFs:', error);
        toast.error('Failed to generate PDFs');
      } finally {
        setGeneratingPDF(false);
      }
    } else if (viewDialog === 'supplier') {
      // Handle supplier orders - each supplier downloads as separate PDF
      setGeneratingPDF(true);
      
      try {
        // Find all supplier divs
        const supplierDivs = printRef.current.querySelectorAll('[data-supplier]');
        
        // Filter to only selected suppliers
        const suppliers = Array.from(supplierDivs)
          .filter(div => selectedSuppliers.includes(div.getAttribute('data-supplier') || ''))
          .map((div) => {
            const supplierName = div.getAttribute('data-supplier') || 'Unknown';
            return {
              element: div as HTMLElement,
              supplierName
            };
          });
        
        if (suppliers.length === 0) {
          toast.error('No matching suppliers found');
          setGeneratingPDF(false);
          return;
        }
        
        // Download each as separate PDF
        await generateAndDownloadSupplierPDFs(
          suppliers,
          printFormat,
          order.order_number,
          (current, total) => {
            toast.loading(`Downloading supplier order ${current} of ${total}...`, { id: 'supplier-progress' });
          }
        );
        
        // Dismiss progress toast
        toast.dismiss('supplier-progress');
        
        toast.success(`Downloaded ${suppliers.length} supplier order PDF${suppliers.length > 1 ? 's' : ''}`);
        
        setViewDialog(null);
        setPendingAction(null);
        setSelectedSuppliers([]);
      } catch (error) {
        console.error('Error generating supplier PDFs:', error);
        toast.error('Failed to generate supplier PDFs');
      } finally {
        setGeneratingPDF(false);
      }
    } else if (viewDialog === 'packing') {
      // Handle packing slips with multiple customers - each customer on separate page
      setGeneratingPDF(true);
      
      try {
        const customerDivs = printRef.current.querySelectorAll('[data-customer]');
        console.log('Found customer divs:', customerDivs.length);
        
        // Always use multi-page approach if we have customer divs
        if (customerDivs.length >= 1) {
          // Multiple customers - create multi-page PDF
          const customers = Array.from(customerDivs).map((div) => {
            const customerName = div.getAttribute('data-customer') || 'Unknown';
            console.log('Processing customer:', customerName);
            return {
              element: div as HTMLElement,
              receiptNumber: `${order.order_number}-${customerName.replace(/\s+/g, '-')}`,
              customerName
            };
          });
          
          console.log('Total customers to generate:', customers.length);
          
          // Generate multi-page PDF with each customer on their own page
          const pdfBlob = await generateMultipleReceiptsPDF(
            customers,
            printFormat,
            order.order_number,
            (current, total) => {
              toast.loading(`Generating packing slip ${current} of ${total}...`, { id: 'packing-progress' });
            }
          );
          
          toast.dismiss('packing-progress');
          
          const pdfFilename = `PackingSlips-${order.order_number}.pdf`;
          downloadBlob(pdfBlob, pdfFilename);
          
          toast.success(`Downloaded ${customers.length} packing slips as multi-page PDF`);
        } else {
          // Fallback - no customer divs found, use entire container
          console.warn('No customer divs found, falling back to single PDF');
          const opt = {
            margin: printFormat === 'receipt' ? 0.2 : 0.5,
            filename: `packing-${order.order_number}.pdf`,
            image: { type: 'jpeg' as const, quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { 
              unit: 'in', 
              format: printFormat === 'receipt' ? [3.15, 11] as [number, number] : 'a4',
              orientation: 'portrait' as const
            }
          };
          
          await html2pdf().set(opt).from(printRef.current).save();
          toast.success('PDF downloaded successfully');
        }
        
        setViewDialog(null);
        setPendingAction(null);
      } catch (error) {
        console.error('Error generating packing slip PDFs:', error);
        toast.error('Failed to generate packing slip PDFs');
      } finally {
        setGeneratingPDF(false);
      }
    } else if (viewDialog === 'driver') {
      // Handle driver packing slips - each driver on separate page
      setGeneratingPDF(true);
      
      try {
        const driverDivs = printRef.current.querySelectorAll('[data-driver]');
        console.log('Found driver divs:', driverDivs.length);
        
        if (driverDivs.length >= 1) {
          const drivers = Array.from(driverDivs).map((div) => {
            const driverName = div.getAttribute('data-driver') || 'Unknown';
            console.log('Processing driver:', driverName);
            return {
              element: div as HTMLElement,
              receiptNumber: `${order.order_number}-${driverName.replace(/\s+/g, '-')}`,
              customerName: driverName
            };
          });
          
          console.log('Total drivers to generate:', drivers.length);
          
          // Generate multi-page PDF with each driver on their own page
          const pdfBlob = await generateMultipleReceiptsPDF(
            drivers,
            printFormat,
            order.order_number,
            (current, total) => {
              toast.loading(`Generating driver slip ${current} of ${total}...`, { id: 'driver-progress' });
            }
          );
          
          toast.dismiss('driver-progress');
          
          const pdfFilename = `DriverPackingSlips-${order.order_number}.pdf`;
          downloadBlob(pdfBlob, pdfFilename);
          
          toast.success(`Downloaded ${drivers.length} driver packing slips as multi-page PDF`);
        } else {
          console.warn('No driver divs found, falling back to single PDF');
          const opt = {
            margin: printFormat === 'receipt' ? 0.2 : 0.5,
            filename: `driver-${order.order_number}.pdf`,
            image: { type: 'jpeg' as const, quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { 
              unit: 'in', 
              format: printFormat === 'receipt' ? [3.15, 11] as [number, number] : 'a4',
              orientation: 'portrait' as const
            }
          };
          
          await html2pdf().set(opt).from(printRef.current).save();
          toast.success('PDF downloaded successfully');
        }
        
        setViewDialog(null);
        setPendingAction(null);
      } catch (error) {
        console.error('Error generating driver packing slip PDFs:', error);
        toast.error('Failed to generate driver packing slip PDFs');
      } finally {
        setGeneratingPDF(false);
      }
    } else {
      // Single document download (supplier list, roundup, or single receipt)

      // IMPORTANT: Single-customer receipt downloads must use our isolated-canvas workflow.
      // The generic html2pdf path is what causes the persistent right-edge clipping on 80mm.
      if (viewDialog === 'receipt' && selectedCustomers.length === 1) {
        setGeneratingPDF(true);

        try {
          // Ensure the receipt is painted
          await new Promise(resolve => setTimeout(resolve, 150));

          const customerName = selectedCustomers[0];
          const receiptDiv = printRef.current.querySelector(
            `[data-customer="${customerName}"]`
          ) as HTMLElement | null;

          if (!receiptDiv) {
            throw new Error('Receipt element not found');
          }

          const filename = `Receipt-${order.order_number}-${customerName.replace(/\s+/g, '-')}.pdf`;
          const pdfBlob = await generateReceiptPDF(receiptDiv, filename, printFormat);

          if (!pdfBlob || pdfBlob.size === 0) {
            throw new Error('Generated PDF is empty');
          }

          downloadBlob(pdfBlob, filename);
          toast.success('PDF downloaded successfully');

          setViewDialog(null);
          setPendingAction(null);
          setSelectedCustomers([]);
          setReceiptNumbers({});
          setEditableReceiptItems([]);
        } catch (error) {
          console.error('Error generating receipt PDF:', error);
          toast.error('Failed to generate PDF');
        } finally {
          setGeneratingPDF(false);
        }

        return;
      }

      const opt = {
        margin: printFormat === 'receipt' ? 0.2 : 0.5,
        filename: `${viewDialog}-${order.order_number}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: {
          unit: 'in',
          format: printFormat === 'receipt' ? [3.15, 11] as [number, number] : 'a4',
          orientation: 'portrait' as const
        }
      };

      try {
        await html2pdf().set(opt).from(printRef.current).save();
        toast.success('PDF downloaded successfully');
        setViewDialog(null);
        setPendingAction(null);
        setSelectedCustomers([]);
        setReceiptNumbers({});
      } catch (error) {
        console.error('Error generating PDF:', error);
        toast.error('Failed to generate PDF');
      }
    }
  };

  if (loading) {
    return (
      <div className="container py-8">
        <LoadingBox />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="container py-8">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Order not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container py-8">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate('/import/orders')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-4xl font-bold text-foreground mb-2">Order Details</h1>
            <p className="text-muted-foreground">View and manage order {order.order_number}</p>
          </div>
        </div>

        <div className="grid gap-6 mb-6">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-2xl">{order.order_number}</CardTitle>
                  <div className="mt-2 space-y-1">
                    <p className="text-sm text-muted-foreground">
                      Week {order.week_number} • Delivery: {formatCuracao(order.delivery_date, 'PPP')}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Placed by: {order.placed_by} • Created: {new Date(order.created_at).toLocaleDateString()}
                    </p>
                    <span className={`inline-block text-xs font-medium px-3 py-1 rounded-full ${
                      order.status === 'completed' ? 'bg-success/10 text-success' :
                      order.status === 'void' ? 'bg-destructive/10 text-destructive' :
                      'bg-primary/10 text-primary'
                    }`}>
                      {order.status}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  {order.status !== 'void' && (
                    <>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={handleCreateReceipt}
                      >
                        <Receipt className="mr-2 h-4 w-4" />
                        Create Receipt
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => navigate(`/import/orders/edit/${order.id}`)}
                      >
                        <Edit className="mr-2 h-4 w-4" />
                        Edit Order
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={handleDuplicateOrder} disabled={isDuplicating}>
                            <Copy className="mr-2 h-4 w-4" />
                            {isDuplicating ? 'Duplicating...' : 'Duplicate Order'}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={handleCreateTemplate}>
                            <LayoutTemplate className="mr-2 h-4 w-4" />
                            Create Template
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={handleVoidOrder}
                            className="text-destructive focus:text-destructive"
                          >
                            <Ban className="mr-2 h-4 w-4" />
                            Void Order
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {order.notes && (
                <div className="mt-4 p-4 bg-muted rounded-lg">
                  <p className="text-sm font-medium mb-1">Notes:</p>
                  <p className="text-sm text-muted-foreground">{order.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Document Options</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold">Customer Packing Slips</h3>
                      <p className="text-xs text-muted-foreground">
                        {savedReceipts.length > 0 
                          ? `Based on ${savedReceipts.length} saved receipt${savedReceipts.length !== 1 ? 's' : ''}`
                          : 'Separate slip per customer (create receipts first for accurate data)'}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleAction('packing', 'view')}
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      View
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleAction('packing', 'print')}
                    >
                      <Printer className="mr-2 h-4 w-4" />
                      Print
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleAction('packing', 'download')}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Download
                    </Button>
                  </div>
                </div>

                <div className="border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold">Supplier Order Lists</h3>
                      <p className="text-xs text-muted-foreground">Separate list per supplier</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleAction('supplier', 'view')}
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      View
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleAction('supplier', 'print')}
                    >
                      <Printer className="mr-2 h-4 w-4" />
                      Print
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={handleSupplierDownloadClick}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Download
                    </Button>
                  </div>
                </div>

                <div className="border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold">Total Roundup Table</h3>
                      <p className="text-xs text-muted-foreground">Complete summary for receiving</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleAction('roundup', 'view')}
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      View
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleAction('roundup', 'print')}
                    >
                      <Printer className="mr-2 h-4 w-4" />
                      Print
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleAction('roundup', 'download')}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Download
                    </Button>
                  </div>
                </div>

                <div className="border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold flex items-center gap-2">
                        <Truck className="h-4 w-4" />
                        Driver Packing Slips
                      </h3>
                      <p className="text-xs text-muted-foreground">Aggregated products per driver route</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setShowDriverAssignmentDialog(true)}
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      View / Assign
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={async () => {
                        // Fetch existing assignments and show dialog if none
                        const { data } = await supabase
                          .from('import_order_driver_assignments')
                          .select('*')
                          .eq('order_id', orderId)
                          .order('sequence_number');
                        
                        if (!data || data.length === 0) {
                          setShowDriverAssignmentDialog(true);
                        } else {
                          setDriverAssignments(data.map(d => ({
                            driver_name: d.driver_name,
                            customer_names: d.customer_names || [],
                            sequence_number: d.sequence_number || 0
                          })));
                          setPendingAction({ type: 'driver' as const, action: 'download' });
                          setShowFormatDialog(true);
                        }
                      }}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Download
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Saved Receipts Section */}
          {savedReceipts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Saved Receipts ({savedReceipts.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {savedReceipts.map((receipt) => (
                    <div key={receipt.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors">
                      <div>
                        <p className="font-medium">{receipt.customer_name}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{receipt.receipt_number}</span>
                          <span>•</span>
                          <span>v{receipt.version_number}</span>
                          <span>•</span>
                          <Clock className="h-3 w-3" />
                          <span>{new Date(receipt.created_at).toLocaleString()}</span>
                        </div>
                        <p className="text-sm font-medium mt-0.5">Cg {Number(receipt.amount).toFixed(2)}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            try {
                              const items = await fetchReceiptLineItems(receipt.id);
                              setRecalledReceiptMeta(receipt);
                              setRecalledLineItems(items);
                              
                              // Convert to OrderItem format for the edit dialog
                              const editItems: OrderItem[] = items.map((li, idx) => ({
                                id: `recalled-${li.id}`,
                                customer_name: receipt.customer_name,
                                product_code: li.product_code,
                                quantity: li.quantity,
                                sale_price_xcg: li.unit_price,
                              }));
                              
                              setEditableReceiptItems(editItems);
                              setSelectedCustomers([receipt.customer_name]);
                              setShowEditReceiptDialog(true);
                            } catch (err) {
                              toast.error('Failed to load receipt items');
                            }
                          }}
                        >
                          <Edit className="mr-1 h-3.5 w-3.5" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            try {
                              const items = await fetchReceiptLineItems(receipt.id);
                              setRecalledReceiptMeta(receipt);
                              setRecalledLineItems(items);
                              
                              // Convert to OrderItem format for viewing
                              const viewItems: OrderItem[] = items.map((li) => ({
                                id: `recalled-${li.id}`,
                                customer_name: receipt.customer_name,
                                product_code: li.product_code,
                                quantity: li.quantity,
                                sale_price_xcg: li.unit_price,
                              }));
                              
                              setEditableReceiptItems(viewItems);
                              setSelectedCustomers([receipt.customer_name]);
                              setReceiptNumbers({ [receipt.customer_name]: receipt.receipt_number });
                              
                              // Preload + show
                              await preloadReceiptData();
                              setReceiptsReady(new Set());
                              setAllReceiptsRendered(false);
                              setViewDialog('receipt');
                              setPendingAction({ type: 'receipt', action: 'view' });
                            } catch (err) {
                              toast.error('Failed to load receipt');
                            }
                          }}
                        >
                          <Eye className="mr-1 h-3.5 w-3.5" />
                          View / Print
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Collapsible
            open={orderItemsExpanded}
            onOpenChange={setOrderItemsExpanded}
          >
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <CardTitle>Order Items ({orderItems.length})</CardTitle>
                    <ChevronDown 
                      className={`h-5 w-5 transition-transform duration-200 ${
                        orderItemsExpanded ? 'transform rotate-180' : ''
                      }`}
                    />
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0">
                  <div className="space-y-4">
                    {Object.entries(
                      orderItems.reduce((acc, item) => {
                        if (!acc[item.customer_name]) {
                          acc[item.customer_name] = [];
                        }
                        acc[item.customer_name].push(item);
                        return acc;
                      }, {} as Record<string, OrderItem[]>)
                    ).map(([customerName, items]) => (
                      <div key={customerName} className="border rounded-lg p-4">
                        <h3 className="font-semibold mb-3">{customerName}</h3>
                        <div className="space-y-2">
                          {items.map((item) => (
                            <div key={item.id} className="flex justify-between text-sm">
                              <span className="text-muted-foreground">{item.product_code}</span>
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{item.quantity} trays</span>
                                {(item.stock_quantity ?? 0) > 0 && (
                                  <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300">
                                    +{item.stock_quantity} stock
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        </div>

        <div className="space-y-4">
          <Tabs defaultValue="pallets" className="w-full">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="pallets">Pallets</TabsTrigger>
              <TabsTrigger value="costs">Landed Cost</TabsTrigger>
            </TabsList>

            <TabsContent value="pallets" className="space-y-4">
              <PalletVisualization palletConfig={palletConfig} />
            </TabsContent>

            <TabsContent value="costs" className="space-y-4">
              <LandedCostPanel orderId={orderId!} />
            </TabsContent>
          </Tabs>
        </div>

      <Dialog open={showFormatDialog} onOpenChange={setShowFormatDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Select Format & Action</DialogTitle>
            <DialogDescription>
              Choose the format and how you want to handle the document
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium mb-2">Format:</p>
              <div className="grid grid-cols-3 gap-4">
                <Button
                  variant={printFormat === 'a4' ? 'default' : 'outline'}
                  onClick={() => setPrintFormat('a4')}
                >
                  A4 Format
                </Button>
                <Button
                  variant={printFormat === 'receipt' ? 'default' : 'outline'}
                  onClick={() => setPrintFormat('receipt')}
                >
                  80mm Receipt
                </Button>
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={async () => {
                    setShowFormatDialog(false);
                    // Build MTR receipt data from selected customers
                    if (!order) return;
                    const itemsForReceipt = editableReceiptItems.length > 0 ? editableReceiptItems : orderItems;
                    const preloaded = await preloadReceiptData();
                    const products = preloaded?.products || preloadedProducts;
                    const companyInfo = preloaded?.companyInfo || preloadedCompanyInfo;
                    const company = typeof companyInfo === 'string' ? JSON.parse(companyInfo) : companyInfo;

                    // Use first selected customer or all items
                    const customerName = selectedCustomers.length > 0 ? selectedCustomers[0] : getUniqueCustomers()[0];
                    const customerItems = customerName
                      ? itemsForReceipt.filter(item => item.customer_name === customerName)
                      : itemsForReceipt;

                    const mtrItems = customerItems.map(item => {
                      const product = products?.find((p: any) => p.code === item.product_code);
                      const packSize = product?.pack_size || 1;
                      const unitPrice = item.sale_price_xcg != null ? item.sale_price_xcg : (product?.wholesale_price_xcg_per_unit || 0);
                      const qty = item.quantity * packSize;
                      return {
                        name: product?.name || item.product_code,
                        qty,
                        rate: unitPrice,
                        amount: qty * unitPrice,
                      };
                    });

                    const subtotal = mtrItems.reduce((s, i) => s + i.amount, 0);

                    setMtrReceiptData({
                      storeName: company?.name || 'FUIK COMPANY B.V.',
                      storeAddress: company?.address || '',
                      storePhone: company?.phone || '',
                      storeEmail: company?.email || '',
                      storeCrib: company?.crib || '',
                      title: 'RECEIPT',
                      date: formatCuracao(order.delivery_date, 'd MMM yyyy'),
                      customerName: customerName || 'Customer',
                      items: mtrItems,
                      subtotal,
                      obTax: 0,
                      total: subtotal,
                      orderRefs: [order.order_number],
                      footer: 'Thank you for your business!',
                    });
                    setShowMTRDialog(true);
                  }}
                >
                  <Smartphone className="h-4 w-4" />
                  MTR Mobile
                </Button>
              </div>
            </div>
            {pendingAction?.type === 'receipt' ? (
              <div>
                <p className="text-sm font-medium mb-2">Action:</p>
                <div className="grid grid-cols-3 gap-3">
                  <Button 
                    onClick={() => handleConfirmFormat('view')}
                    variant="outline"
                    className="w-full"
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    View
                  </Button>
                  <Button 
                    onClick={() => handleConfirmFormat('print')}
                    className="w-full"
                  >
                    <Printer className="mr-2 h-4 w-4" />
                    Print
                  </Button>
                  <Button 
                    onClick={() => handleConfirmFormat('download')}
                    className="w-full"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download
                  </Button>
                </div>
              </div>
            ) : (
              <Button onClick={() => handleConfirmFormat()} className="w-full">
                Continue
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showReceiptCustomerDialog} onOpenChange={setShowReceiptCustomerDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Select Customers for Receipt</DialogTitle>
            <DialogDescription>
              Choose which customers to generate receipts for
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {getUniqueCustomers().map((customerName) => (
                <div key={customerName} className="flex items-center space-x-2 p-2 border rounded-lg hover:bg-accent">
                  <Checkbox
                    id={customerName}
                    checked={selectedCustomers.includes(customerName)}
                    onCheckedChange={() => handleCustomerToggle(customerName)}
                  />
                  <label
                    htmlFor={customerName}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1"
                  >
                    {customerName}
                  </label>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={handleConfirmCustomers} className="w-full">
                <Receipt className="mr-2 h-4 w-4" />
                Create Receipt
              </Button>
              <Button onClick={handleEditBeforeReceipt} variant="outline" className="w-full">
                <FileEdit className="mr-2 h-4 w-4" />
                Edit Before Creating
              </Button>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              {selectedCustomers.length} customer{selectedCustomers.length !== 1 ? 's' : ''} selected
            </p>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showSupplierSelectDialog} onOpenChange={setShowSupplierSelectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Select Suppliers to Download</DialogTitle>
            <DialogDescription>
              Choose which suppliers to download as separate PDFs
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center space-x-2 p-2 border rounded-lg hover:bg-accent">
              <Checkbox
                id="select-all-suppliers"
                checked={selectedSuppliers.length === availableSuppliers.length && availableSuppliers.length > 0}
                onCheckedChange={handleSelectAllSuppliers}
              />
              <label
                htmlFor="select-all-suppliers"
                className="text-sm font-semibold leading-none cursor-pointer flex-1"
              >
                Select All
              </label>
            </div>
            <div className="space-y-2 max-h-[300px] overflow-y-auto border-t pt-2">
              {availableSuppliers.map((supplierName) => (
                <div key={supplierName} className="flex items-center space-x-2 p-2 border rounded-lg hover:bg-accent">
                  <Checkbox
                    id={`supplier-${supplierName}`}
                    checked={selectedSuppliers.includes(supplierName)}
                    onCheckedChange={() => handleSupplierToggle(supplierName)}
                  />
                  <label
                    htmlFor={`supplier-${supplierName}`}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1"
                  >
                    {supplierName}
                  </label>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setShowSupplierSelectDialog(false)} variant="outline" className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleConfirmSupplierDownload} className="flex-1">
                <Download className="mr-2 h-4 w-4" />
                Download PDFs
              </Button>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              {selectedSuppliers.length} supplier{selectedSuppliers.length !== 1 ? 's' : ''} selected
            </p>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={viewDialog !== null} onOpenChange={() => {
        setViewDialog(null);
        setPendingAction(null);
        setSelectedCustomers([]);
        setEditableReceiptItems([]);
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>
                {viewDialog === 'packing' && 'Customer Packing Slips'}
                {viewDialog === 'supplier' && 'Supplier Order Lists'}
                {viewDialog === 'roundup' && 'Total Roundup Table'}
                {viewDialog === 'receipt' && 'Customer Receipts'}
              </DialogTitle>
              {pendingAction && (
                <div className="flex gap-2">
                  {pendingAction.action === 'view' && (
                    <>
                      <Button onClick={handlePrintFromPreview} size="sm" variant="outline">
                        <Printer className="mr-2 h-4 w-4" />
                        Print
                      </Button>
                      <Button onClick={handleDownloadFromPreview} size="sm" disabled={generatingPDF}>
                        <Download className="mr-2 h-4 w-4" />
                        {generatingPDF ? 'Generating...' : 'Download PDF'}
                      </Button>
                    </>
                  )}
                  {pendingAction.action === 'print' && (
                    <Button onClick={handlePrintFromPreview} size="sm">
                      <Printer className="mr-2 h-4 w-4" />
                      Print Now
                    </Button>
                  )}
                  {pendingAction.action === 'download' && (
                    <Button onClick={handleDownloadFromPreview} size="sm" disabled={generatingPDF}>
                      <Download className="mr-2 h-4 w-4" />
                      {generatingPDF ? 'Generating...' : 'Download PDF'}
                    </Button>
                  )}
                </div>
              )}
            </div>
          </DialogHeader>
          <div ref={printRef} className="print-container print:block">
            {viewDialog === 'packing' && order && (
              <PackingSlipFromReceipts
                order={order}
                orderItems={orderItems}
                savedReceipts={savedReceipts}
                format={printFormat}
                fetchReceiptLineItems={fetchReceiptLineItems}
              />
            )}
            {viewDialog === 'supplier' && order && (
              <SupplierOrderList 
                order={order} 
                orderItems={orderItems} 
                format={printFormat}
                selectedSuppliers={selectedSuppliers}
              />
            )}
            {viewDialog === 'roundup' && order && (
              <RoundupTable 
                order={order} 
                orderItems={orderItems} 
                format={printFormat}
              />
            )}
            {viewDialog === 'receipt' && order && (
              <div className="space-y-8">
                {selectedCustomers.map((customerName, index) => (
                  <div 
                    key={customerName}
                    data-customer={customerName}
                    className={index < selectedCustomers.length - 1 ? 'print:page-break-after-always' : ''}
                    // Critical for 80mm PDFs: constrain the capture node to the target paper width.
                    // Otherwise html2canvas captures the full dialog width (with lots of whitespace),
                    // which then gets scaled into 80mm and looks off-center / out of proportion.
                    style={printFormat === 'receipt' ? { width: '80mm', margin: '0 auto' } : undefined}
                  >
                    <CustomerReceipt
                      order={order}
                      orderItems={editableReceiptItems.length > 0 ? editableReceiptItems : orderItems}
                      customerName={customerName}
                      format={printFormat}
                      receiptNumber={receiptNumbers[customerName]}
                      preloadedProducts={preloadedProducts.length > 0 ? preloadedProducts : undefined}
                      preloadedCompanyInfo={preloadedCompanyInfo || undefined}
                      onDataReady={() => handleReceiptReady(customerName)}
                      receiptCreatedAt={recalledReceiptMeta?.created_at}
                      receiptModifiedAt={new Date().toISOString()}
                      receiptVersion={recalledReceiptMeta?.version_number}
                    />
                  </div>
                ))}
              </div>
            )}
            {viewDialog === 'driver' && order && (
              <DriverPackingSlip
                order={order}
                orderItems={orderItems}
                driverAssignments={driverAssignments}
                format={printFormat}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      <ReceiptEditDialog
        open={showEditReceiptDialog}
        onOpenChange={(open) => {
          setShowEditReceiptDialog(open);
          if (!open) {
            setRecalledReceiptMeta(null);
            setRecalledLineItems([]);
          }
        }}
        orderItems={editableReceiptItems.length > 0 ? editableReceiptItems : orderItems}
        selectedCustomers={selectedCustomers}
        onConfirm={handleConfirmEditedReceipt}
      />

      <DriverAssignmentDialog
        open={showDriverAssignmentDialog}
        onOpenChange={setShowDriverAssignmentDialog}
        orderId={orderId!}
        orderItems={orderItems}
        deliveryDate={order?.delivery_date || ''}
        onConfirm={(assignments) => {
          setDriverAssignments(assignments.map(a => ({
            driver_name: a.driver_name,
            customer_names: a.customer_names,
            distribution_customer_ids: a.distribution_customer_ids || [],
            sequence_number: a.sequence_number,
            include_distribution: a.include_distribution || false
          })));
          setShowDriverAssignmentDialog(false);
          setPendingAction({ type: 'driver', action: 'view' });
          setShowFormatDialog(true);
        }}
      />

      <MTRExportDialog
        open={showMTRDialog}
        onOpenChange={setShowMTRDialog}
        receiptData={mtrReceiptData}
        filename={order ? `Receipt-${order.order_number}` : 'receipt'}
      />
    </div>
  );
};

export default OrderDetails;
