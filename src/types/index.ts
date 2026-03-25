export interface Category {
  id: string;
  name: string;
  slug: string;
  order: number;
  imageUrl?: string;
}

export interface Product {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  prepTime?: number;
  isAvailable: boolean;
  isPopular: boolean;
}

export interface OrderItem {
  productId: string;
  quantity: number;
  name?: string;
  price?: number;
  subtotal?: number;
  _isDeliveryMetadata?: boolean;
  _isPaymentMetadata?: boolean;
  method?: string;
  address?: string | null;
  isPaidOnline?: boolean;
}

export interface Order {
  id: string;
  customerName?: string;
  customerPhone?: string;
  deliveryMethod?: 'pickup' | 'delivery';
  deliveryAddress?: string;
  items: OrderItem[];
  totalAmount?: number;
  status: 'pending' | 'preparing' | 'ready' | 'delivered' | 'cancelled';
  createdAt?: string;
  // Supabase specific Db mapping properties
  created_at?: string;
  customer_name?: string;
  branch_name?: string;
  total?: number;
}
