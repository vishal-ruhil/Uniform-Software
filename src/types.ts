export interface SizePricing {
  [size: string]: number;
}

export interface Pricing {
  [item: string]: SizePricing;
}

export type PaymentMode = 'UPI' | 'Cash' | 'Pending';

export interface SaleRecord {
  id: string;
  srNo: number;
  name: string;
  studentClass: string;
  items: CartItem[];
  totalAmount: number;
  date: string;
  timestamp: string;
  paymentMode: PaymentMode;
  paidAmount?: number;
  paymentDate?: string;
  // Transaction-level notes and custom data (optional, depends on if they are shared)
  notes?: string;
  customData?: Record<string, any>;
}

export interface CartItem {
  id: string;
  item: string;
  size: string;
  qty: number;
  rate: number;
  notes?: string;
  customData?: Record<string, any>;
}

export interface CustomField {
  id: string;
  label: string;
  type: 'text' | 'number' | 'date';
  required: boolean;
}
