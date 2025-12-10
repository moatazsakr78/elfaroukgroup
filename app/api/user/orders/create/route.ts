import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth.config'
import { supabaseAdmin } from '@/app/lib/supabase/admin'

interface OrderItem {
  product_id: string
  quantity: number
  price: number
}

interface CustomerData {
  name: string
  phone: string
  altPhone: string
  address: string
}

interface ShippingDetails {
  company_id: string | null
  company_name: string
  governorate_id: string
  governorate_name: string
  governorate_type: string
  area_id: string | null
  area_name: string | null
  shipping_cost: number
}

interface OrderData {
  items: OrderItem[]
  customer: CustomerData
  delivery_method: 'pickup' | 'delivery'
  shipping_details: ShippingDetails | null
  subtotal: number
  shipping: number
  total: number
}

export async function POST(request: Request) {
  try {
    // Check authentication using NextAuth
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized - Please login first' },
        { status: 401 }
      )
    }

    const userId = session.user.id
    const userEmail = session.user.email

    // Parse request body
    const orderData: OrderData = await request.json()

    // Validate order data
    if (!orderData.items || orderData.items.length === 0) {
      return NextResponse.json(
        { error: 'Cart is empty' },
        { status: 400 }
      )
    }

    if (!orderData.customer.name || !orderData.customer.phone) {
      return NextResponse.json(
        { error: 'Customer name and phone are required' },
        { status: 400 }
      )
    }

    // Generate order number
    const orderNumber = 'ORD-' + Date.now().toString().slice(-8)

    // Find or create customer in customers table
    let customerId = null

    // Check if customer already exists for this user
    const { data: existingCustomer, error: customerCheckError } = await supabaseAdmin
      .from('customers')
      .select('id')
      .eq('user_id', userId)
      .single()

    if (customerCheckError && customerCheckError.code !== 'PGRST116') {
      console.error('Error checking existing customer:', customerCheckError)
    }

    if (existingCustomer) {
      // Customer exists, update their information
      customerId = existingCustomer.id
      const { error: updateError } = await supabaseAdmin
        .from('customers')
        .update({
          name: orderData.customer.name,
          phone: orderData.customer.phone,
          backup_phone: orderData.customer.altPhone || null,
          address: orderData.customer.address || null,
          email: userEmail,
          updated_at: new Date().toISOString()
        })
        .eq('id', customerId)

      if (updateError) {
        console.error('Error updating customer:', updateError)
      }
    } else {
      // Customer doesn't exist, create new one
      const { data: newCustomer, error: createCustomerError } = await supabaseAdmin
        .from('customers')
        .insert({
          user_id: userId,
          name: orderData.customer.name,
          phone: orderData.customer.phone,
          backup_phone: orderData.customer.altPhone || null,
          address: orderData.customer.address || null,
          email: userEmail,
          is_active: true,
          loyalty_points: 0,
          account_balance: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select('id')
        .single()

      if (createCustomerError) {
        console.error('Error creating customer:', createCustomerError)
      } else if (newCustomer) {
        customerId = newCustomer.id
      }
    }

    // Build notes string
    let notes = `الشحن: ${orderData.delivery_method === 'delivery' ? 'توصيل' : 'استلام من المتجر'}`
    if (orderData.shipping_details) {
      notes += ` - ${orderData.shipping_details.company_name} - ${orderData.shipping_details.governorate_name}`
      if (orderData.shipping_details.area_name) {
        notes += ` - ${orderData.shipping_details.area_name}`
      }
    }

    // Insert order into orders table
    const { data: orderResult, error: orderError } = await supabaseAdmin
      .from('orders')
      .insert({
        order_number: orderNumber,
        customer_id: customerId,
        user_id: userId, // This is now the correct NextAuth user ID
        customer_name: orderData.customer.name,
        customer_phone: orderData.customer.phone,
        customer_address: orderData.customer.address || null,
        total_amount: orderData.total,
        subtotal_amount: orderData.subtotal,
        shipping_amount: orderData.shipping,
        status: 'pending',
        delivery_type: orderData.delivery_method === 'delivery' ? 'delivery' : 'pickup',
        notes: notes
      })
      .select('id, order_number')
      .single()

    if (orderError) {
      console.error('Error creating order:', orderError)
      return NextResponse.json(
        { error: 'Failed to create order' },
        { status: 500 }
      )
    }

    // Insert order items
    const orderItems = orderData.items.map((item) => ({
      order_id: orderResult.id,
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.price
    }))

    const { error: itemsError } = await supabaseAdmin
      .from('order_items')
      .insert(orderItems)

    if (itemsError) {
      console.error('Error creating order items:', itemsError)
      // If order items failed, delete the order to keep data consistent
      await supabaseAdmin.from('orders').delete().eq('id', orderResult.id)
      return NextResponse.json(
        { error: 'Failed to create order items' },
        { status: 500 }
      )
    }

    console.log('✅ Order created successfully:', orderResult.order_number, 'for user:', userId)

    return NextResponse.json({
      success: true,
      orderId: orderResult.id,
      orderNumber: orderResult.order_number
    })

  } catch (error) {
    console.error('Error in create order API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
