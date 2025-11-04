export type ProductCode = 'STB_500' | 'STB_250' | 'BLB_125' | 'CTO_250' | 'CTO_500' | 'CTO_PKG';

export interface Product {
  code: ProductCode;
  name: string;
  packSize: number; // items per tray/case
}

export interface OrderItem {
  productCode: ProductCode;
  quantity: number; // number of trays/cases
}

export interface CustomerOrder {
  customerId: string;
  customerName: string;
  items: OrderItem[];
  poNumber?: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  weekNumber: number;
  deliveryDate: string;
  placedBy: string;
  createdAt: string;
  status: 'active' | 'completed' | 'void';
  customerOrders: CustomerOrder[];
  notes?: string;
}

export interface OrderRoundup {
  productCode: ProductCode;
  totalTrays: number;
  totalUnits: number;
}

export const PRODUCTS: Product[] = [
  { code: 'STB_500', name: 'Strawberries 500g', packSize: 10 },
  { code: 'STB_250', name: 'Strawberries 250g', packSize: 20 },
  { code: 'BLB_125', name: 'Blueberries 125g', packSize: 12 },
  { code: 'CTO_250', name: 'Cherry Tomatoes 250g', packSize: 20 },
  { code: 'CTO_500', name: 'Cherry Tomatoes 500g', packSize: 10 },
  { code: 'CTO_PKG', name: 'Cherry Tomatoes per KG', packSize: 1 },
];
