'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useStoreTheme } from '@/lib/hooks/useStoreTheme';
import { useCompanySettings } from '@/lib/hooks/useCompanySettings';
import { supabase } from '@/app/lib/supabase/client';

type OrderStatus = 'pending' | 'processing' | 'ready_for_pickup' | 'ready_for_shipping' | 'shipped' | 'delivered' | 'cancelled' | 'issue' | 'postponed';

const statusTranslations: Record<OrderStatus, string> = {
  pending: 'معلق',
  processing: 'يتم التحضير',
  ready_for_pickup: 'جاهز للاستلام',
  ready_for_shipping: 'جاهز للشحن',
  shipped: 'تم الشحن',
  delivered: 'تم التسليم',
  cancelled: 'ملغي',
  issue: 'مشكله',
  postponed: 'مؤجل',
};

const statusColors: Record<OrderStatus, string> = {
  pending: '#EF4444',
  processing: '#F59E0B',
  ready_for_pickup: '#86EFAC',
  ready_for_shipping: '#FB923C',
  shipped: '#3B82F6',
  delivered: '#059669',
  cancelled: '#6B7280',
  issue: '#8B5CF6',
  postponed: '#EC4899',
};

const statusIcons: Record<OrderStatus, string> = {
  pending: '\u23F3',
  processing: '\uD83D\uDC68\u200D\uD83C\uDF73',
  ready_for_pickup: '\u2705',
  ready_for_shipping: '\uD83D\uDCE6',
  shipped: '\uD83D\uDE9B',
  delivered: '\u2705',
  cancelled: '\u274C',
  issue: '\u26A0\uFE0F',
  postponed: '\u23F8\uFE0F',
};

interface OrderItem {
  id: string;
  product_id?: string;
  name: string;
  quantity: number;
  price: number;
  image?: string | null;
  notes?: string;
  isNew?: boolean;
}

interface TrackingOrder {
  id: string;
  orderId: string;
  date: string;
  status: OrderStatus;
  deliveryType: string;
  customerName: string;
  customerPhone?: string;
  customerAddress?: string;
  subtotal: number;
  shipping: number | null;
  total: number;
  items: OrderItem[];
  isEditable: boolean;
}

export default function TrackOrderPage() {
  const params = useParams();
  const token = params?.token as string;

  const { primaryColor, primaryHoverColor, buttonColor, buttonHoverColor } = useStoreTheme();
  const { companyName, logoUrl } = useCompanySettings();

  const [order, setOrder] = useState<TrackingOrder | null>(null);
  const [originalItems, setOriginalItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Product search states
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const fetchOrder = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/orders/track/${token}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'حدث خطأ');
        return;
      }
      setOrder(data);
      setOriginalItems(data.items.map((i: OrderItem) => ({ ...i })));
    } catch {
      setError('فشل في تحميل بيانات الطلب');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  // Product search
  const searchProducts = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, price, main_image_url, product_code, barcode')
        .eq('is_active', true)
        .or(`name.ilike.%${query}%,product_code.ilike.%${query}%,barcode.ilike.%${query}%`)
        .limit(10);

      if (!error && data) {
        setSearchResults(data);
      }
    } catch {
      // ignore
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Edit handlers
  const updateItemQuantity = (itemId: string, newQuantity: number) => {
    if (!order || newQuantity < 1) return;
    const updatedItems = order.items.map(item =>
      item.id === itemId ? { ...item, quantity: newQuantity } : item
    );
    const newSubtotal = updatedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const newTotal = newSubtotal + (order.shipping || 0);
    setOrder({ ...order, items: updatedItems, subtotal: newSubtotal, total: newTotal });
  };

  const updateItemNotes = (itemId: string, notes: string) => {
    if (!order) return;
    const updatedItems = order.items.map(item =>
      item.id === itemId ? { ...item, notes } : item
    );
    setOrder({ ...order, items: updatedItems });
  };

  const removeItem = (itemId: string) => {
    if (!order) return;
    const updatedItems = order.items.filter(item => item.id !== itemId);
    if (updatedItems.length === 0) return; // Don't allow empty order
    const newSubtotal = updatedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const newTotal = newSubtotal + (order.shipping || 0);
    setOrder({ ...order, items: updatedItems, subtotal: newSubtotal, total: newTotal });
  };

  const addProductToOrder = (product: any) => {
    if (!order) return;
    const existingItem = order.items.find(item => item.product_id === product.id);
    if (existingItem) {
      updateItemQuantity(existingItem.id, existingItem.quantity + 1);
    } else {
      const newItem: OrderItem = {
        id: `new_${Date.now()}_${product.id}`,
        product_id: product.id,
        name: product.name,
        price: parseFloat(product.price),
        quantity: 1,
        image: product.main_image_url,
        notes: '',
        isNew: true,
      };
      const updatedItems = [...order.items, newItem];
      const newSubtotal = updatedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const newTotal = newSubtotal + (order.shipping || 0);
      setOrder({ ...order, items: updatedItems, subtotal: newSubtotal, total: newTotal });
    }
    setSearchQuery('');
    setSearchResults([]);
    setShowAddProduct(false);
  };

  const cancelEdit = () => {
    if (!order) return;
    const restoredItems = originalItems.map(i => ({ ...i }));
    const newSubtotal = restoredItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const newTotal = newSubtotal + (order.shipping || 0);
    setOrder({ ...order, items: restoredItems, subtotal: newSubtotal, total: newTotal });
    setEditMode(false);
    setShowAddProduct(false);
    setSearchQuery('');
    setSearchResults([]);
  };

  const saveChanges = async () => {
    if (!order) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/orders/track/${token}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: order.items }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'فشل في حفظ التغييرات');
        return;
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      setEditMode(false);
      setShowAddProduct(false);
      // Refetch to get fresh data with proper IDs
      await fetchOrder();
    } catch {
      alert('فشل في حفظ التغييرات');
    } finally {
      setSaving(false);
    }
  };

  const formatPrice = (price: number) => `${price.toFixed(0)} جنيه`;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center" dir="rtl">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-gray-600 border-t-white rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400 text-lg">جاري تحميل بيانات الطلب...</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center" dir="rtl">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="text-6xl mb-4">😔</div>
          <h1 className="text-2xl font-bold text-white mb-2">الطلب غير موجود</h1>
          <p className="text-gray-400">{error || 'رابط التتبع غير صالح أو منتهي الصلاحية'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900" dir="rtl">
      {/* Header */}
      <header className="sticky top-0 z-10 shadow-lg" style={{ backgroundColor: primaryColor }}>
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          {logoUrl && (
            <img src={logoUrl} alt={companyName} className="w-10 h-10 rounded-full object-cover" />
          )}
          <div className="flex-1">
            <h1 className="text-white font-bold text-lg">{companyName || 'تتبع الطلب'}</h1>
            <p className="text-white/70 text-xs">تتبع الطلب</p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-4 space-y-4 pb-24">
        {/* Success toast */}
        {saveSuccess && (
          <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg font-medium animate-pulse">
            تم حفظ التغييرات بنجاح
          </div>
        )}

        {/* Order Status Card */}
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-white font-bold text-lg">طلب رقم {order.id}</h2>
            <span
              className="px-3 py-1 rounded-full text-sm font-bold text-white"
              style={{ backgroundColor: statusColors[order.status] }}
            >
              {statusIcons[order.status]} {statusTranslations[order.status]}
            </span>
          </div>
          <div className="space-y-1 text-sm">
            <p className="text-gray-400">
              <span className="text-gray-500">التاريخ:</span>{' '}
              {new Date(order.date).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
            <p className="text-gray-400">
              <span className="text-gray-500">العميل:</span> {order.customerName}
            </p>
            {order.customerPhone && (
              <p className="text-gray-400">
                <span className="text-gray-500">الهاتف:</span> {order.customerPhone}
              </p>
            )}
            {order.customerAddress && (
              <p className="text-gray-400">
                <span className="text-gray-500">العنوان:</span> {order.customerAddress}
              </p>
            )}
          </div>
        </div>

        {/* Edit Toggle */}
        {order.isEditable && !editMode && (
          <button
            onClick={() => {
              setOriginalItems(order.items.map(i => ({ ...i })));
              setEditMode(true);
            }}
            className="w-full py-3 rounded-xl text-white font-bold text-base transition-colors"
            style={{ backgroundColor: buttonColor }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = buttonHoverColor; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = buttonColor; }}
          >
            <span className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              تعديل الطلب
            </span>
          </button>
        )}

        {/* Add Product Section (Edit Mode) */}
        {editMode && (
          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-bold">عناصر الطلب</h3>
              <button
                onClick={() => setShowAddProduct(!showAddProduct)}
                className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm font-medium"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                اضافة منتج
              </button>
            </div>

            {showAddProduct && (
              <div className="mb-4 p-3 bg-gray-700/50 rounded-lg border border-gray-600">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    searchProducts(e.target.value);
                  }}
                  placeholder="ابحث بالاسم أو الكود..."
                  className="w-full px-4 py-2.5 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
                {isSearching && (
                  <div className="text-center py-3">
                    <div className="w-6 h-6 border-2 border-gray-600 border-t-white rounded-full animate-spin mx-auto"></div>
                  </div>
                )}
                {searchResults.length > 0 && (
                  <div className="mt-2 max-h-48 overflow-y-auto space-y-1">
                    {searchResults.map((product) => (
                      <div
                        key={product.id}
                        className="flex items-center gap-3 p-2 bg-gray-800 rounded-lg hover:bg-gray-700 cursor-pointer transition-colors"
                        onClick={() => addProductToOrder(product)}
                      >
                        <div className="w-10 h-10 bg-gray-700 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                          {product.main_image_url ? (
                            <img src={product.main_image_url} alt={product.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-gray-500 text-sm">📦</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-medium truncate">{product.name}</p>
                        </div>
                        <p className="text-green-400 text-sm font-bold">{formatPrice(product.price)}</p>
                      </div>
                    ))}
                  </div>
                )}
                {searchQuery.length >= 2 && !isSearching && searchResults.length === 0 && (
                  <p className="text-center text-gray-500 text-sm py-3">لم يتم العثور على منتجات</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Items List */}
        <div className="space-y-3">
          {order.items.map((item) => (
            <div
              key={item.id}
              className={`bg-gray-800 rounded-xl p-3 border ${item.isNew ? 'border-green-500' : 'border-gray-700'}`}
            >
              <div className="flex items-center gap-3">
                {/* Image */}
                <div className="w-16 h-16 bg-gray-700 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {item.image ? (
                    <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-gray-500 text-2xl">📦</span>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h4 className="text-white font-medium text-sm truncate">{item.name}</h4>
                      <p className="text-gray-500 text-xs">{formatPrice(item.price)} للقطعة</p>
                      {item.isNew && (
                        <span className="inline-block mt-1 px-2 py-0.5 bg-green-600 text-white text-[10px] rounded-full font-medium">جديد</span>
                      )}
                    </div>
                  </div>

                  {editMode ? (
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={() => updateItemQuantity(item.id, item.quantity - 1)}
                        className="w-7 h-7 bg-red-600 hover:bg-red-700 text-white rounded-full flex items-center justify-center text-sm font-bold transition-colors"
                      >
                        -
                      </button>
                      <span className="w-8 text-center font-bold text-white text-sm">{item.quantity}</span>
                      <button
                        onClick={() => updateItemQuantity(item.id, item.quantity + 1)}
                        className="w-7 h-7 bg-green-600 hover:bg-green-700 text-white rounded-full flex items-center justify-center text-sm font-bold transition-colors"
                      >
                        +
                      </button>
                      {order.items.length > 1 && (
                        <button
                          onClick={() => removeItem(item.id)}
                          className="mr-auto w-7 h-7 bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white rounded-full flex items-center justify-center transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                  ) : (
                    <p className="text-gray-400 text-xs mt-1">الكمية: {item.quantity}</p>
                  )}
                </div>

                {/* Item total */}
                <div className="text-left flex-shrink-0">
                  <p className="text-white font-bold text-sm">{formatPrice(item.price * item.quantity)}</p>
                </div>
              </div>

              {/* Notes */}
              {editMode ? (
                <div className="mt-2">
                  <input
                    type="text"
                    value={item.notes || ''}
                    onChange={(e) => updateItemNotes(item.id, e.target.value)}
                    placeholder="ملاحظات..."
                    className="w-full px-3 py-1.5 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs"
                  />
                </div>
              ) : (
                item.notes && (
                  <p className="mt-2 text-xs text-gray-500 bg-gray-700/50 rounded px-2 py-1">
                    📝 {item.notes}
                  </p>
                )
              )}
            </div>
          ))}
        </div>

        {/* Financial Summary */}
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          {order.shipping !== null && order.shipping !== undefined ? (
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-gray-400 text-sm">المنتجات</span>
                <span className="text-white font-medium text-sm">{formatPrice(order.subtotal)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400 text-sm">الشحن</span>
                <span className="text-white font-medium text-sm">{formatPrice(order.shipping)}</span>
              </div>
              <div className="border-t border-gray-700 pt-2 flex justify-between items-center">
                <span className="text-white font-bold">الإجمالي</span>
                <span className="text-white font-bold text-lg">{formatPrice(order.total)}</span>
              </div>
            </div>
          ) : (
            <div className="flex justify-between items-center">
              <span className="text-white font-bold">الإجمالي</span>
              <span className="text-white font-bold text-lg">{formatPrice(order.total)}</span>
            </div>
          )}
        </div>
      </main>

      {/* Edit Mode Footer */}
      {editMode && (
        <div className="fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 p-4 z-20">
          <div className="max-w-2xl mx-auto flex gap-3">
            <button
              onClick={saveChanges}
              disabled={saving}
              className="flex-1 py-3 rounded-xl text-white font-bold text-base transition-colors disabled:opacity-50"
              style={{ backgroundColor: buttonColor }}
              onMouseEnter={(e) => { if (!saving) e.currentTarget.style.backgroundColor = buttonHoverColor; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = buttonColor; }}
            >
              {saving ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  جاري الحفظ...
                </span>
              ) : (
                'حفظ التغييرات'
              )}
            </button>
            <button
              onClick={cancelEdit}
              className="px-6 py-3 rounded-xl text-gray-400 hover:text-white border border-gray-600 hover:border-gray-500 font-medium transition-colors"
            >
              إلغاء
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
