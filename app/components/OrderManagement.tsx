'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase/client'
import { 
  MagnifyingGlassIcon,
  DocumentTextIcon,
  EyeIcon,
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon
} from '@heroicons/react/24/outline'

interface Order {
  id: string
  order_number: string
  customer_id: string | null
  customer_name: string
  customer_phone: string
  customer_address: string | null
  total_amount: number
  time: string | null
  invoice_type: string | null
  branch_id: string | null
  notes: string | null
  created_at: string | null
  updated_at: string | null
  branch?: {
    name: string
  } | null
}

interface OrderItem {
  id: string
  order_id: string
  product_id: string
  quantity: number
  unit_price: number
  discount: number | null
  notes: string | null
  created_at: string | null
  product?: {
    name: string
    barcode: string | null
    category: {
      name: string
    } | null
  } | null
}

interface OrderManagementProps {
  className?: string
}

export default function OrderManagement({ className = "" }: OrderManagementProps) {
  const [orders, setOrders] = useState<Order[]>([])
  const [orderItems, setOrderItems] = useState<OrderItem[]>([])
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingItems, setIsLoadingItems] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch orders from database
  const fetchOrders = async () => {
    try {
      setIsLoading(true)
      setError(null)
      
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          customer_id,
          customer_name,
          customer_phone,
          customer_address,
          total_amount,
          time,
          invoice_type,
          branch_id,
          notes,
          created_at,
          updated_at,
          branch:branches(name)
        `)
        .order('created_at', { ascending: false })
        .limit(50)
      
      if (error) {
        console.error('Error fetching orders:', error)
        setError('فشل في تحميل الطلبات')
        return
      }
      
      setOrders((data as any) || [])
      
    } catch (error) {
      console.error('Error fetching orders:', error)
      setError('حدث خطأ أثناء تحميل الطلبات')
    } finally {
      setIsLoading(false)
    }
  }

  // Fetch order items for selected order
  const fetchOrderItems = async (orderId: string) => {
    try {
      setIsLoadingItems(true)
      
      const { data, error } = await supabase
        .from('order_items')
        .select(`
          id,
          order_id,
          product_id,
          quantity,
          unit_price,
          discount,
          notes,
          created_at,
          product:products(
            name,
            barcode,
            category:categories(name)
          )
        `)
        .eq('order_id', orderId)
        .order('created_at', { ascending: true })
      
      if (error) {
        console.error('Error fetching order items:', error)
        setOrderItems([])
        return
      }
      
      setOrderItems(data || [])
      
    } catch (error) {
      console.error('Error fetching order items:', error)
      setOrderItems([])
    } finally {
      setIsLoadingItems(false)
    }
  }

  // Handle order selection
  const handleOrderSelect = (order: Order) => {
    setSelectedOrder(order)
    fetchOrderItems(order.id)
  }


  // Setup real-time subscriptions
  useEffect(() => {
    fetchOrders()

    // Set up real-time subscription for orders
    const ordersChannel = supabase
      .channel('orders_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'elfaroukgroup', table: 'orders' },
        (payload: any) => {
          console.log('Orders real-time update:', payload)
          fetchOrders()
        }
      )
      .subscribe()

    // Set up real-time subscription for order_items
    const orderItemsChannel = supabase
      .channel('order_items_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'elfaroukgroup', table: 'order_items' },
        (payload: any) => {
          console.log('Order items real-time update:', payload)
          if (selectedOrder) {
            fetchOrderItems(selectedOrder.id)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(ordersChannel)
      supabase.removeChannel(orderItemsChannel)
    }
  }, [])

  // Update order items when selected order changes
  useEffect(() => {
    if (selectedOrder) {
      fetchOrderItems(selectedOrder.id)
    } else {
      setOrderItems([])
    }
  }, [selectedOrder])

  // Filter orders based on search query
  const filteredOrders = orders.filter(order =>
    order.order_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    order.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    order.customer_phone.includes(searchQuery) ||
    (order.invoice_type && order.invoice_type.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-'
    const date = new Date(dateString)
    return date.toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getInvoiceTypeText = (invoiceType: string | null) => {
    if (!invoiceType) return 'غير محدد'
    switch (invoiceType) {
      case 'Sale': return 'بيع'
      case 'Purchase': return 'شراء'
      case 'Sale Return': return 'مرتجع بيع'
      case 'Purchase Return': return 'مرتجع شراء'
      default: return invoiceType
    }
  }

  const getInvoiceTypeColor = (invoiceType: string | null) => {
    if (!invoiceType) return 'bg-gray-900 text-gray-300'
    switch (invoiceType) {
      case 'Sale': return 'bg-green-900 text-green-300'
      case 'Purchase': return 'bg-blue-900 text-blue-300'
      case 'Sale Return': return 'bg-orange-900 text-orange-300'
      case 'Purchase Return': return 'bg-purple-900 text-purple-300'
      default: return 'bg-gray-900 text-gray-300'
    }
  }

  const getInvoiceTypeIcon = (invoiceType: string | null) => {
    if (!invoiceType) return <DocumentTextIcon className="h-4 w-4" />
    switch (invoiceType) {
      case 'Sale': return <CheckCircleIcon className="h-4 w-4" />
      case 'Purchase': return <DocumentTextIcon className="h-4 w-4" />
      case 'Sale Return': return <XCircleIcon className="h-4 w-4" />
      case 'Purchase Return': return <ClockIcon className="h-4 w-4" />
      default: return <DocumentTextIcon className="h-4 w-4" />
    }
  }

  const formatTime = (timeString: string | null) => {
    if (!timeString) return '-'
    // Format time from HH:MM:SS to HH:MM format
    return timeString.substring(0, 5)
  }


  return (
    <div className={`flex flex-col h-full ${className}`} dir="rtl">
      {/* Search Bar */}
      <div className="p-4 border-b border-gray-600 bg-[#2B3544]">
        <div className="relative">
          <MagnifyingGlassIcon className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="البحث في رقم الطلب، اسم العميل، أو رقم الهاتف..."
            className="w-full pl-4 pr-10 py-2 bg-[#374151] border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto scrollbar-hide p-4">
        {/* Orders List - Card Format */}
        {isLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-4"></div>
            <p className="text-gray-400 text-lg">جاري تحميل الطلبات...</p>
          </div>
        ) : error ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8">
            <DocumentTextIcon className="h-16 w-16 text-red-500 mb-4" />
            <p className="text-red-400 text-lg mb-2">خطأ في التحميل</p>
            <p className="text-gray-500 text-sm mb-4">{error}</p>
            <button
              onClick={fetchOrders}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors"
            >
              إعادة المحاولة
            </button>
          </div>
        ) : filteredOrders.length > 0 ? (
          <div className="space-y-4">
            {filteredOrders.map((order, index) => (
              <div
                key={order.id}
                className={`bg-[#374151] rounded-lg overflow-hidden cursor-pointer transition-all ${
                  selectedOrder?.id === order.id ? 'ring-2 ring-blue-500 bg-blue-600/10' : 'hover:bg-[#4B5563]'
                }`}
                onClick={() => handleOrderSelect(order)}
              >
                {/* Order Header */}
                <div className="flex justify-between items-center p-4 border-b border-gray-600">
                  <div className="flex items-center gap-4">
                    <div>
                      <h3 className="text-lg font-semibold text-white">طلب رقم: {order.order_number}</h3>
                      <p className="text-gray-400 text-sm">العميل: {order.customer_name} - {order.customer_phone}</p>
                      <p className="text-gray-400 text-sm">التاريخ: {formatDate(order.created_at)}</p>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <p className="text-xl font-bold text-green-400">EGP {order.total_amount.toFixed(2)}</p>
                    <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold text-white mt-2 ${getInvoiceTypeColor(order.invoice_type)}`}>
                      {getInvoiceTypeText(order.invoice_type)}
                    </span>
                  </div>
                </div>

                {/* Order Items Preview */}
                {isLoadingItems && selectedOrder?.id === order.id ? (
                  <div className="p-4">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mr-3"></div>
                      <p className="text-gray-400">جاري تحميل عناصر الطلب...</p>
                    </div>
                  </div>
                ) : selectedOrder?.id === order.id && orderItems.length > 0 ? (
                  <div className="p-4">
                    {/* Table Header */}
                    <div className="grid grid-cols-7 gap-4 p-3 bg-gray-800 rounded-lg font-semibold text-gray-300 text-sm mb-3">
                      <div className="text-right">المنتج</div>
                      <div className="text-center">السعر</div>
                      <div className="text-center">الكمية</div>
                      <div className="text-center">الإجمالي</div>
                      <div className="text-center">ملاحظات</div>
                      <div className="text-center">الألوان</div>
                      <div className="text-center">الكود</div>
                    </div>

                    {/* Table Rows */}
                    <div className="space-y-2 max-h-64 overflow-auto scrollbar-hide">
                      {orderItems.map((item, index) => {
                        const itemTotal = (item.quantity * item.unit_price) - (item.discount || 0)
                        return (
                          <div key={item.id} className="grid grid-cols-7 gap-4 p-3 bg-gray-700 rounded-lg items-center">
                            {/* Product Image and Name */}
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 bg-gray-600 rounded-lg flex items-center justify-center flex-shrink-0">
                                <span className="text-gray-300 text-xl">📦</span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-white font-medium text-sm">
                                  {item.product?.name || 'منتج محذوف'}
                                </div>
                              </div>
                            </div>

                            {/* Price */}
                            <div className="text-center">
                              <p className="font-medium text-green-400 text-sm">{item.unit_price.toFixed(2)} جنيه</p>
                            </div>

                            {/* Quantity */}
                            <div className="text-center">
                              <p className="font-medium text-white">{item.quantity}</p>
                            </div>

                            {/* Total */}
                            <div className="text-center">
                              <p className="font-semibold text-green-400">{itemTotal.toFixed(2)} جنيه</p>
                            </div>

                            {/* Notes */}
                            <div className="text-center">
                              <p className="text-gray-400 text-sm">
                                {item.notes || '-'}
                              </p>
                            </div>

                            {/* Colors */}
                            <div className="text-center">
                              <p className="text-gray-400 text-sm">-</p>
                            </div>

                            {/* Product Code */}
                            <div className="text-center">
                              <p className="text-gray-300 text-xs font-mono">{item.product?.barcode || '-'}</p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8">
            <DocumentTextIcon className="h-16 w-16 text-gray-500 mb-4" />
            <p className="text-gray-400 text-lg mb-2">لا توجد طلبات</p>
            <p className="text-gray-500 text-sm">لا توجد طلبات مسجلة في قاعدة البيانات</p>
          </div>
        )}

        {/* Footer Stats */}
        <div className="mt-4 p-4 bg-[#2B3544] rounded-lg">
          <div className="flex justify-between items-center text-sm text-gray-400">
            <span>إجمالي الطلبات: {filteredOrders.length}</span>
            <span>إجمالي المبلغ: EGP {filteredOrders.reduce((sum, order) => sum + order.total_amount, 0).toFixed(2)}</span>
          </div>
        </div>
      </div>

    </div>
  )
}