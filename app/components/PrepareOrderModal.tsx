'use client';

import { useState, useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { supabase } from '../lib/supabase/client';

// Order item interface with preparation status
interface OrderItem {
  id: string;
  product_id?: string;
  name: string;
  quantity: number;
  price: number;
  image?: string;
  isPrepared: boolean;
  preparedBy?: string;
  preparedAt?: string;
}

// Order interface 
interface Order {
  id: string;
  customerName: string;
  customerPhone?: string;
  total: number;
  items: OrderItem[];
}

interface PrepareOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
}

export default function PrepareOrderModal({ isOpen, onClose, orderId }: PrepareOrderModalProps) {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [preparationProgress, setPreparationProgress] = useState(0);

  // Load order data from database with real-time subscription
  useEffect(() => {
    if (!isOpen || !orderId) return;

    const loadOrder = async () => {
      try {
        // Get order with its items and product details
        const { data: orderData, error: orderError } = await supabase
          .from('orders')
          .select(`
            id,
            order_number,
            customer_name,
            customer_phone,
            total_amount,
            order_items (
              id,
              quantity,
              unit_price,
              is_prepared,
              prepared_by,
              prepared_at,
              products (
                id,
                name,
                main_image_url
              )
            )
          `)
          .eq('order_number', orderId)
          .single();

        if (orderError) {
          console.error('Error fetching order:', orderError);
          return;
        }

        // First, map all items
        const rawItems = orderData.order_items.map((item: any) => ({
          id: String(item.id),
          product_id: item.products?.id,
          name: item.products?.name || 'منتج غير معروف',
          quantity: item.quantity,
          price: Number(item.unit_price),
          image: item.products?.main_image_url || undefined,
          isPrepared: item.is_prepared || false,
          preparedBy: item.prepared_by,
          preparedAt: item.prepared_at
        }));

        // Group items by product_id and combine quantities
        const groupedItemsMap = new Map();
        rawItems.forEach((item: any) => {
          const key = item.product_id || item.name; // Use product_id as key, fallback to name
          if (groupedItemsMap.has(key)) {
            const existingItem = groupedItemsMap.get(key);
            existingItem.quantity += item.quantity;
            // Keep the prepared status as true if any of the items is prepared
            existingItem.isPrepared = existingItem.isPrepared || item.isPrepared;
            // Keep track of prepared times
            if (item.preparedAt && !existingItem.preparedAt) {
              existingItem.preparedAt = item.preparedAt;
            }
            if (item.preparedBy && !existingItem.preparedBy) {
              existingItem.preparedBy = item.preparedBy;
            }
          } else {
            groupedItemsMap.set(key, { ...item });
          }
        });

        // Convert back to array
        const groupedItems = Array.from(groupedItemsMap.values());

        // Transform data to match our Order interface
        const transformedOrder: Order = {
          id: orderData.order_number,
          customerName: orderData.customer_name || 'عميل غير محدد',
          customerPhone: orderData.customer_phone,
          total: Number(orderData.total_amount),
          items: groupedItems
        };

        setOrder(transformedOrder);
        setLoading(false);

      } catch (error) {
        console.error('Error loading order:', error);
        setLoading(false);
      }
    };

    loadOrder();
  }, [isOpen, orderId]);

  // Real-time subscription for order items preparation updates
  useEffect(() => {
    if (!isOpen || !orderId || !order) return;

    console.log('Setting up real-time subscription for order:', orderId);

    // Create channel for this specific order
    const channel = supabase
      .channel(`prepare_order_${orderId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'elfaroukgroup',
          table: 'order_items'
        },
        async (payload) => {
          console.log('Real-time item preparation update received:', payload);

          // Fetch the product_id for the updated item
          const { data: itemData } = await supabase
            .from('order_items')
            .select('product_id, order_id, is_prepared')
            .eq('id', payload.new.id)
            .single();

          if (!itemData) return;

          // Update the order items if this item belongs to the current order
          setOrder(prevOrder => {
            if (!prevOrder) return prevOrder;

            // Find the grouped item by product_id
            const updatedItems = prevOrder.items.map(item => {
              // Match by product_id (since items are grouped)
              if (item.product_id === itemData.product_id) {
                console.log(`Updating item ${item.name} preparation status to: ${itemData.is_prepared}`);
                return {
                  ...item,
                  isPrepared: itemData.is_prepared || false,
                  preparedAt: payload.new.prepared_at,
                  preparedBy: payload.new.prepared_by
                };
              }
              return item;
            });

            return {
              ...prevOrder,
              items: updatedItems
            };
          });
        }
      )
      .subscribe((status) => {
        console.log('Prepare order modal subscription status:', status);
      });

    // Cleanup subscription
    return () => {
      console.log('Cleaning up real-time subscription for order:', orderId);
      supabase.removeChannel(channel);
    };
  }, [isOpen, orderId, order]);

  // Calculate preparation progress
  useEffect(() => {
    if (order) {
      const preparedItems = order.items.filter(item => item.isPrepared).length;
      const totalItems = order.items.length;
      const progress = totalItems > 0 ? (preparedItems / totalItems) * 100 : 0;
      setPreparationProgress(progress);
    }
  }, [order]);

  // Toggle item preparation status with real-time update
  const toggleItemPreparation = async (itemId: string) => {
    if (!order) return;
    
    try {
      const item = order.items.find(i => i.id === itemId);
      if (!item) return;

      const newPreparedStatus = !item.isPrepared;
      const currentTime = new Date().toISOString();
      
      console.log('Toggling item preparation:', { itemId, newPreparedStatus });
      
      // Update in database with real-time sync
      const { error } = await supabase
        .from('order_items')
        .update({
          is_prepared: newPreparedStatus,
          prepared_by: newPreparedStatus ? 'current_user' : null,
          prepared_at: newPreparedStatus ? currentTime : null
        } as any)
        .eq('id', itemId);

      if (error) {
        console.error('Error updating item preparation status:', error);
        return;
      }

      // Update local state immediately for better UX
      setOrder(prevOrder => {
        if (!prevOrder) return prevOrder;
        
        return {
          ...prevOrder,
          items: prevOrder.items.map(orderItem => {
            if (orderItem.id === itemId) {
              return {
                ...orderItem,
                isPrepared: newPreparedStatus,
                preparedBy: newPreparedStatus ? 'current_user' : undefined,
                preparedAt: newPreparedStatus ? currentTime : undefined
              };
            }
            return orderItem;
          })
        };
      });
      
    } catch (error) {
      console.error('Error toggling item preparation:', error);
    }
  };

  // Complete order preparation - Move to correct next status
  const completeOrder = async () => {
    if (!order) return;
    
    try {
      
      // First, get the full order details to determine delivery type
      const { data: orderData, error: fetchError } = await supabase
        .from('orders')
        .select('delivery_type')
        .eq('order_number', orderId)
        .single() as { data: { delivery_type: string } | null, error: any };

      if (fetchError) {
        console.error('Error fetching order details:', fetchError);
        return;
      }

      // Determine next status based on delivery type
      let nextStatus: string;
      if (orderData?.delivery_type === 'pickup') {
        nextStatus = 'ready_for_pickup';
      } else if (orderData?.delivery_type === 'delivery') {
        nextStatus = 'ready_for_shipping';
      } else {
        // Default to pickup if delivery_type is null or undefined
        nextStatus = 'ready_for_pickup';
      }
      
      // Update order status to next logical step
      const { error } = await supabase
        .from('orders')
        .update({ 
          status: nextStatus,
          updated_at: new Date().toISOString()
        })
        .eq('order_number', orderId);

      if (error) {
        console.error('Error completing order:', error);
        return;
      }

      const statusMessage = nextStatus === 'ready_for_pickup' ? 'جاهز للاستلام' : 'جاهز للشحن';
      alert(`تم إكمال التحضير بنجاح! الطلب الآن ${statusMessage}`);
      onClose();
    } catch (error) {
      console.error('Error completing order:', error);
    }
  };

  if (!isOpen) return null;

  if (loading) {
    return (
      <div className="fixed inset-0 bg-gray-100 z-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
          <p className="text-gray-600">جاري تحميل الطلب...</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="fixed inset-0 bg-gray-100 z-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-800 mb-2">طلب غير موجود</h2>
          <p className="text-gray-600 mb-4">لم يتم العثور على الطلب المطلوب</p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
          >
            إغلاق
          </button>
        </div>
      </div>
    );
  }

  const allItemsPrepared = order.items.every(item => item.isPrepared);

  return (
    <div className="fixed inset-0 bg-gray-100 z-50" dir="rtl">
      {/* Header with close button */}
      <div className="bg-white p-4 flex justify-between items-center border-b border-gray-200">
        <h1 className="text-xl font-bold text-gray-800">تحضير الطلب</h1>
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <XMarkIcon className="w-6 h-6 text-gray-600" />
        </button>
      </div>

      {/* Progress Bar - Empty with Yellow/Green Progress */}
      <div className="bg-gray-300 h-2 w-full">
        <div 
          className={`h-full transition-all duration-300 ${
            preparationProgress === 100 ? 'bg-green-500' : 'bg-yellow-500'
          }`}
          style={{ width: `${preparationProgress}%` }}
        ></div>
      </div>
      
      {/* Progress Text */}
      <div className="bg-white px-4 py-2 text-left">
        <span className="text-sm text-gray-600">
          {Math.round(preparationProgress)}% مكتمل - {order.items.filter(item => item.isPrepared).length} من {order.items.length} منتج
        </span>
      </div>

      {/* Customer Information */}
      <div className="bg-white px-4 py-3 border-b border-gray-200">
        <div className="text-right">
          <h2 className="text-lg font-semibold text-gray-800">العميل: {order.customerName}</h2>
          <p className="text-gray-600 text-sm">رقم الطلب: {order.id}</p>
          {order.customerPhone && (
            <p className="text-gray-600 text-sm">الهاتف: {order.customerPhone}</p>
          )}
        </div>
      </div>

      {/* Products List */}
      <div className="p-4 overflow-y-auto h-[calc(100vh-300px)] scrollbar-hide">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 text-center">قائمة المنتجات للتحضير</h3>
        
        <div className="space-y-4 max-w-2xl mx-auto">
          {order.items.map((item) => (
            <div 
              key={item.id} 
              className={`bg-white rounded-lg p-4 shadow-sm border-2 transition-all cursor-pointer relative ${
                item.isPrepared 
                  ? 'border-green-400 bg-green-50' 
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => toggleItemPreparation(item.id)}
            >
              {/* Green checkmark overlay when prepared */}
              {item.isPrepared && (
                <div className="absolute top-3 right-3 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}

              <div className="flex items-center gap-4">
                {/* Product Image */}
                <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-200 flex-shrink-0">
                  {item.image ? (
                    <img 
                      src={item.image} 
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center">
                      <span className="text-gray-400 text-xl">📦</span>
                    </div>
                  )}
                </div>

                {/* Product Details */}
                <div className="flex-1">
                  <h4 className="font-bold text-gray-800 text-lg mb-1">{item.name}</h4>
                  <div className="text-sm text-gray-600 space-y-1">
                    <p>الكمية: <span className="font-medium">{item.quantity} قطعة</span></p>
                    <p>السعر الواحد: <span className="font-medium">{item.price.toFixed(2)} ريال</span></p>
                    <p>الإجمالي: <span className="font-medium">{(item.price * item.quantity).toFixed(2)} ريال</span></p>
                  </div>
                  
                  {item.isPrepared && (
                    <div className="mt-2">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        تم التحضير
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Complete Order Button - Fixed at bottom */}
      <div className="bg-white border-t border-gray-200 p-4">
        <div className="max-w-2xl mx-auto">
          <button
            onClick={completeOrder}
            disabled={!allItemsPrepared}
            className={`w-full py-4 rounded-lg font-bold text-white text-lg transition-all ${
              allItemsPrepared
                ? 'bg-green-600 hover:bg-green-700 cursor-pointer shadow-lg'
                : 'bg-gray-400 cursor-not-allowed'
            }`}
          >
            {allItemsPrepared ? (
              <div className="flex items-center justify-center gap-2">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                إتمام الطلب
              </div>
            ) : (
              'يرجى تحضير جميع المنتجات أولاً'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}