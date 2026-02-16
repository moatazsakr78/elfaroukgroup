import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth.config'
import { supabaseAdmin } from '@/app/lib/supabase/admin'
import { roundMoney } from '@/app/lib/utils/money'

interface OrderItem {
  product_id: string
  quantity: number
  price: number
  notes?: string
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

    // ===== SERVER-SIDE PRICE VALIDATION =====
    // Fetch real prices from database to prevent client-side price manipulation
    const productIds = orderData.items.map(item => item.product_id)

    // Fetch product base prices
    const { data: products, error: productsError } = await supabaseAdmin
      .from('products')
      .select('id, price, is_active')
      .in('id', productIds)

    if (productsError || !products) {
      console.error('Error fetching products for price validation:', productsError)
      return NextResponse.json(
        { error: 'Failed to validate product prices' },
        { status: 500 }
      )
    }

    // Check all products exist and are active
    const productMap = new Map(products.map(p => [p.id, p]))
    for (const item of orderData.items) {
      const product = productMap.get(item.product_id)
      if (!product) {
        return NextResponse.json(
          { error: `المنتج غير موجود: ${item.product_id}` },
          { status: 400 }
        )
      }
      if (product.is_active === false) {
        return NextResponse.json(
          { error: `المنتج غير متاح حالياً` },
          { status: 400 }
        )
      }
    }

    // Calculate server-side subtotal using real prices
    let serverSubtotal = 0
    const validatedItems: OrderItem[] = []

    for (const item of orderData.items) {
      const product = productMap.get(item.product_id)!
      const realPrice = parseFloat(String(product.price))

      serverSubtotal += realPrice * item.quantity
      validatedItems.push({
        ...item,
        price: realPrice // Use server-verified price
      })
    }
    serverSubtotal = roundMoney(serverSubtotal)

    // Validate shipping cost server-side
    let serverShipping = 0
    if (orderData.delivery_method === 'delivery' && orderData.shipping_details) {
      const sd = orderData.shipping_details

      if (sd.area_id) {
        // Area-level shipping cost
        const { data: area } = await supabaseAdmin
          .from('shipping_areas')
          .select('price')
          .eq('id', sd.area_id)
          .single()

        if (area) {
          serverShipping = parseFloat(String(area.price)) || 0
        }
      } else if (sd.governorate_id) {
        // Governorate-level shipping cost
        const { data: gov } = await supabaseAdmin
          .from('shipping_governorates')
          .select('price')
          .eq('id', sd.governorate_id)
          .single()

        if (gov) {
          serverShipping = parseFloat(String(gov.price)) || 0
        }
      }
    }

    const serverTotal = roundMoney(serverSubtotal + serverShipping)

    // Log any price discrepancy for monitoring
    if (Math.abs(serverTotal - orderData.total) > 0.01) {
      console.warn('Price discrepancy detected!', {
        clientTotal: orderData.total,
        serverTotal,
        clientSubtotal: orderData.subtotal,
        serverSubtotal,
        clientShipping: orderData.shipping,
        serverShipping,
        userId
      })
    }

    // Use server-calculated values (ignore client-sent totals)
    const finalSubtotal = serverSubtotal
    const finalShipping = serverShipping
    const finalTotal = serverTotal
    // ===== END PRICE VALIDATION =====

    // Generate order number
    const orderNumber = 'ORD-' + Date.now().toString().slice(-8)

    // Find or create customer in customers table
    // Note: We search by email instead of user_id because user_id is uuid type
    // and NextAuth user.id is a text string
    let customerId = null

    // Check if customer already exists by email or phone
    const { data: existingCustomer, error: customerCheckError } = await supabaseAdmin
      .from('customers')
      .select('id')
      .or(`email.eq.${userEmail},phone.eq.${orderData.customer.phone}`)
      .limit(1)
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
      // Note: user_id is omitted because it's uuid type and we have text user ID
      const { data: newCustomer, error: createCustomerError } = await supabaseAdmin
        .from('customers')
        .insert({
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
    // Note: user_session is used instead of user_id because user_id is uuid type
    // and NextAuth user.id is a text string
    const { data: orderResult, error: orderError } = await supabaseAdmin
      .from('orders')
      .insert({
        order_number: orderNumber,
        customer_id: customerId,
        user_session: userId, // Store NextAuth user ID in user_session (text field)
        customer_name: orderData.customer.name,
        customer_phone: orderData.customer.phone,
        customer_address: orderData.customer.address || null,
        total_amount: finalTotal,
        subtotal_amount: finalSubtotal,
        shipping_amount: finalShipping,
        status: 'pending',
        delivery_type: orderData.delivery_method === 'delivery' ? 'delivery' : 'pickup',
        notes: notes
      } as any)
      .select('id, order_number')
      .single()

    if (orderError) {
      console.error('Error creating order:', orderError)
      return NextResponse.json(
        { error: 'Failed to create order' },
        { status: 500 }
      )
    }

    // Insert order items (using server-validated prices)
    const orderItems = validatedItems.map((item) => ({
      order_id: orderResult.id,
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.price,
      notes: item.notes || null
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
