'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabase/client'

// Order status type
export type OrderStatus = 'pending' | 'processing' | 'ready_for_pickup' | 'ready_for_shipping' | 'shipped' | 'delivered' | 'cancelled' | 'issue' | 'postponed';

// Order delivery type
export type DeliveryType = 'pickup' | 'delivery';

// Order interface with customer info
export interface Order {
  id: string;
  orderId?: string; // UUID for database operations
  date: string;
  total: number;
  subtotal?: number | null;
  shipping?: number | null;
  status: OrderStatus;
  deliveryType: DeliveryType;
  customerName: string;
  customerPhone?: string;
  customerAddress?: string;
  created_at?: string;
  updated_at?: string;
  items: OrderItem[];
  preparationProgress?: number;
}

export interface OrderItem {
  id: string;
  product_id?: string;
  name: string;
  quantity: number;
  price: number;
  image?: string;
  barcode?: string;
  notes?: string;
  isPrepared?: boolean;
}

export function useOrders() {
  const [orders, setOrders] = useState<Order[]>([])
  const [branches, setBranches] = useState<any[]>([])
  const [records, setRecords] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastFetch, setLastFetch] = useState<number>(0)

  // ✨ OPTIMIZED: Memoized fetch function with caching
  const fetchOrders = useCallback(async (force = false) => {
    try {
      // Simple cache: don't refetch if less than 5 seconds since last fetch (unless forced)
      const now = Date.now()
      if (!force && lastFetch && now - lastFetch < 5000) {
        console.log('⚡ Using cached orders data (< 5s old)')
        return
      }

      setIsLoading(true)
      setError(null)

      console.time('⚡ Fetch orders with items')

      // ✨ Batch fetch all data in parallel
      const [ordersResult, branchesResult, recordsResult] = await Promise.all([
        // Get all orders with their items and product details
        supabase
          .from('orders')
          .select(`
            id,
            order_number,
            customer_name,
            customer_phone,
            customer_address,
            total_amount,
            subtotal_amount,
            shipping_amount,
            status,
            delivery_type,
            notes,
            created_at,
            updated_at,
            order_items (
              id,
              quantity,
              unit_price,
              notes,
              is_prepared,
              products (
                id,
                name,
                barcode,
                main_image_url
              )
            )
          `)
          .order('created_at', { ascending: false }),

        // Get active branches
        supabase
          .from('branches')
          .select('id, name')
          .eq('is_active', true)
          .order('name'),

        // Get active records
        supabase
          .from('records')
          .select('id, name')
          .eq('is_active', true)
          .order('name')
      ])

      if (ordersResult.error) throw ordersResult.error

      console.timeEnd('⚡ Fetch orders with items')

      // Transform data to match our Order interface and filter out orders with no items
      const transformedOrders: Order[] = (ordersResult.data || [])
        .filter((order: any) => order.order_items && order.order_items.length > 0)
        .map((order: any) => {
          // Map all items
          const rawItems = order.order_items.map((item: any) => ({
            id: item.id.toString(),
            product_id: item.products?.id,
            name: item.products?.name || 'منتج غير معروف',
            quantity: item.quantity,
            price: parseFloat(item.unit_price),
            image: item.products?.main_image_url || undefined,
            barcode: item.products?.barcode || null,
            notes: item.notes || '',
            isPrepared: item.is_prepared || false
          }));

          // Group items by product_id and combine quantities
          const groupedItemsMap = new Map();
          rawItems.forEach((item: any) => {
            const key = item.product_id || item.name;
            if (groupedItemsMap.has(key)) {
              const existingItem = groupedItemsMap.get(key);
              existingItem.quantity += item.quantity;
              existingItem.isPrepared = existingItem.isPrepared || item.isPrepared;
              if (item.notes && item.notes !== existingItem.notes) {
                existingItem.notes = existingItem.notes ? `${existingItem.notes}، ${item.notes}` : item.notes;
              }
            } else {
              groupedItemsMap.set(key, { ...item });
            }
          });

          const items = Array.from(groupedItemsMap.values());

          // Calculate preparation progress
          const preparedItems = items.filter((item: OrderItem) => item.isPrepared).length;
          const totalItems = items.length;
          const preparationProgress = totalItems > 0 ? (preparedItems / totalItems) * 100 : 0;

          const shipping = order.shipping_amount ? parseFloat(order.shipping_amount) : null;
          const calculatedSubtotal = items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);
          const calculatedTotal = calculatedSubtotal + (shipping || 0);

          return {
            id: order.order_number,
            orderId: order.id,
            date: order.created_at.split('T')[0],
            total: calculatedTotal,
            subtotal: shipping !== null ? calculatedSubtotal : null,
            shipping: shipping,
            status: order.status,
            deliveryType: order.delivery_type || 'pickup',
            customerName: order.customer_name || 'عميل غير محدد',
            customerPhone: order.customer_phone,
            customerAddress: order.customer_address,
            created_at: order.created_at,
            updated_at: order.updated_at,
            items,
            preparationProgress
          };
        });

      setOrders(transformedOrders)
      setBranches(branchesResult.data || [])
      setRecords(recordsResult.data || [])
      setLastFetch(now)
      setError(null)
    } catch (err) {
      console.error('❌ Error fetching orders:', err)
      setError('فشل في تحميل الطلبات')
      setOrders([])
    } finally {
      setIsLoading(false)
    }
  }, [lastFetch])

  // ✨ OPTIMIZED: Real-time handler for orders
  const handleOrderChange = useCallback((payload: any) => {
    console.log('📡 Order change detected:', payload.eventType)

    // Refetch all data when changes occur to maintain data consistency
    setTimeout(() => fetchOrders(true), 500)
  }, [fetchOrders])

  // ✨ OPTIMIZED: Real-time handler for order items
  const handleOrderItemChange = useCallback((payload: any) => {
    console.log('📡 Order item change detected:', payload.eventType)

    // Refetch when order items change
    setTimeout(() => fetchOrders(true), 500)
  }, [fetchOrders])

  // Initial fetch
  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  // ✨ OPTIMIZED: Real-time subscriptions
  useEffect(() => {
    console.log('🔴 Setting up orders real-time subscriptions')

    // Subscribe to orders table changes
    const ordersChannel = supabase
      .channel('orders_changes_optimized')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        handleOrderChange
      )
      .subscribe()

    // Subscribe to order_items table changes
    const orderItemsChannel = supabase
      .channel('order_items_changes_optimized')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'order_items' },
        handleOrderItemChange
      )
      .subscribe()

    return () => {
      console.log('🔴 Cleaning up orders subscriptions')
      ordersChannel.unsubscribe()
      orderItemsChannel.unsubscribe()
    }
  }, [handleOrderChange, handleOrderItemChange])

  return {
    orders,
    setOrders, // ✨ Expose for optimistic updates
    branches,
    records,
    isLoading,
    error,
    refetch: () => fetchOrders(true) // Force refetch
  }
}
