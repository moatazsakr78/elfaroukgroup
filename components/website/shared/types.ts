import { Currency } from '@/lib/constants/currencies';

export interface UserInfo {
  id?: string;
  name?: string;
  email?: string;
  phone?: string;
  cart?: CartItem[];
  cartCount?: number;
  preferences?: UserPreferences;
}

export interface CartItem {
  id: string | number;
  name: string;
  price: number;
  quantity?: number;
  image?: string;
  description?: string;
  category?: string;
}

export interface UserPreferences {
  language?: 'ar' | 'en';
  currency?: Currency;
  notifications?: boolean;
  theme?: 'dark' | 'light';
}

export interface ProductColor {
  id: string;
  name: string;
  hex: string;
  image_url?: string;
  quantity?: number;
  barcode?: string | null;
}

export interface ProductShape {
  id: string;
  name: string;
  image_url?: string;
  quantity?: number;
  barcode?: string | null;
}

export interface ProductSize {
  id: string;
  name: string;
  product: {
    id: string;
    name: string;
    main_image_url?: string;
    price: number;
    description?: string;
  };
}

export interface Product {
  id: string | number;
  name: string;
  description?: string;
  price: number;
  wholesale_price?: number;
  originalPrice?: number;
  image?: string;
  images?: string[];
  colors?: ProductColor[];
  selectedColor?: ProductColor | null;
  shapes?: ProductShape[];
  selectedShape?: ProductShape | null;
  sizes?: ProductSize[];
  selectedSize?: ProductSize | null;
  category?: string;
  brand?: string;
  stock?: number;
  totalQuantity?: number;
  rating?: number;
  reviews?: number;
  isOnSale?: boolean;
  discount?: number;
  tags?: string[];
  specifications?: Record<string, string>;
  isFeatured?: boolean;
  suggestedProducts?: string[];
  note?: string; // Customer note for the product
}

export interface Category {
  id: string | number;
  name: string;
  description?: string;
  icon?: string;
  image?: string;
  productCount?: number;
  parentId?: string | number;
  children?: Category[];
}

export interface Order {
  id: string;
  userId: string;
  items: CartItem[];
  total: number;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
  shippingAddress?: Address;
  billingAddress?: Address;
  paymentMethod?: string;
  trackingNumber?: string;
}

export interface Address {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

export interface ApiResponse<T> {
  data: T;
  success: boolean; 
  message?: string;
  error?: string;
}