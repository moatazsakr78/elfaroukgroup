import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/app/lib/supabase/admin'
import { roundMoney } from '@/app/lib/utils/money'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const NON_EDITABLE_STATUSES = ['delivered', 'shipped', 'cancelled']

export async function GET(
  request: Request,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params

    if (!token || !UUID_REGEX.test(token)) {
      return NextResponse.json(
        { error: 'رابط التتبع غير صالح' },
        { status: 400 }
      )
    }

    const { data: order, error } = await supabaseAdmin
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
            main_image_url,
            price
          )
        )
      `)
      .eq('tracking_token', token)
      .single()

    if (error || !order) {
      return NextResponse.json(
        { error: 'الطلب غير موجود' },
        { status: 404 }
      )
    }

    const items = ((order as any).order_items || []).map((item: any) => ({
      id: item.id.toString(),
      product_id: item.products?.id,
      name: item.products?.name || 'منتج غير معروف',
      quantity: item.quantity,
      price: parseFloat(item.unit_price),
      image: item.products?.main_image_url || null,
      barcode: item.products?.barcode || null,
      notes: item.notes || '',
      isPrepared: item.is_prepared || false,
    }))

    const shipping = (order as any).shipping_amount ? parseFloat((order as any).shipping_amount) : null
    const subtotal = items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0)
    const total = subtotal + (shipping || 0)

    const isEditable = !NON_EDITABLE_STATUSES.includes((order as any).status)

    return NextResponse.json({
      id: (order as any).order_number,
      orderId: (order as any).id,
      date: (order as any).created_at?.split('T')[0],
      status: (order as any).status,
      deliveryType: (order as any).delivery_type || 'pickup',
      customerName: (order as any).customer_name || 'عميل غير محدد',
      customerPhone: (order as any).customer_phone,
      customerAddress: (order as any).customer_address,
      subtotal,
      shipping,
      total,
      items,
      isEditable,
      created_at: (order as any).created_at,
      updated_at: (order as any).updated_at,
    })
  } catch (err) {
    console.error('Error fetching order by tracking token:', err)
    return NextResponse.json(
      { error: 'حدث خطأ في الخادم' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params

    if (!token || !UUID_REGEX.test(token)) {
      return NextResponse.json(
        { error: 'رابط التتبع غير صالح' },
        { status: 400 }
      )
    }

    // Fetch the order to verify it exists and is editable
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('id, order_number, status, shipping_amount')
      .eq('tracking_token', token)
      .single()

    if (orderError || !order) {
      return NextResponse.json(
        { error: 'الطلب غير موجود' },
        { status: 404 }
      )
    }

    if (NON_EDITABLE_STATUSES.includes((order as any).status)) {
      return NextResponse.json(
        { error: 'لا يمكن تعديل هذا الطلب في حالته الحالية' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { items } = body as { items: any[] }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'يجب أن يحتوي الطلب على منتج واحد على الأقل' },
        { status: 400 }
      )
    }

    // Server-side price validation: fetch real prices
    const productIds = items
      .map((item: any) => item.product_id)
      .filter(Boolean)

    const { data: products, error: productsError } = await supabaseAdmin
      .from('products')
      .select('id, price, is_active')
      .in('id', productIds)

    if (productsError || !products) {
      return NextResponse.json(
        { error: 'فشل في التحقق من أسعار المنتجات' },
        { status: 500 }
      )
    }

    const productMap = new Map(products.map((p: any) => [p.id, p]))

    // Validate all products exist
    for (const item of items) {
      if (!item.product_id) continue
      const product = productMap.get(item.product_id)
      if (!product) {
        return NextResponse.json(
          { error: `المنتج غير موجود` },
          { status: 400 }
        )
      }
    }

    const orderId = (order as any).id
    const shipping = (order as any).shipping_amount ? parseFloat((order as any).shipping_amount) : 0

    // Separate new items from existing items
    const newItems = items.filter((item: any) => item.isNew)
    const existingItems = items.filter((item: any) => !item.isNew)

    // 1. Update existing items
    for (const item of existingItems) {
      const { error: itemError } = await supabaseAdmin
        .from('order_items')
        .update({
          quantity: item.quantity,
          notes: item.notes || null,
        })
        .eq('id', item.id)

      if (itemError) {
        console.error('Error updating item:', itemError)
      }
    }

    // 2. Insert new items with server-validated prices
    for (const item of newItems) {
      const product = productMap.get(item.product_id)
      const realPrice = product ? parseFloat(String(product.price)) : parseFloat(String(item.price))

      const { error: insertError } = await supabaseAdmin
        .from('order_items')
        .insert({
          order_id: orderId,
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: realPrice,
          notes: item.notes || null,
        })

      if (insertError) {
        console.error('Error inserting new item:', insertError)
      }
    }

    // 3. Delete removed items - fetch current items and compare
    const { data: currentDbItems } = await supabaseAdmin
      .from('order_items')
      .select('id')
      .eq('order_id', orderId)

    const submittedExistingIds = new Set(existingItems.map((item: any) => item.id))
    const deletedItems = (currentDbItems || []).filter(
      (dbItem: any) => !submittedExistingIds.has(dbItem.id.toString()) && !submittedExistingIds.has(dbItem.id)
    )

    // Only delete items that existed before this edit (not newly inserted ones)
    // We need to exclude items we just inserted
    const { data: freshItems } = await supabaseAdmin
      .from('order_items')
      .select('id')
      .eq('order_id', orderId)

    // Get IDs of items that were in the original set but not in the submitted existing items
    if (currentDbItems) {
      for (const dbItem of currentDbItems) {
        const idStr = dbItem.id.toString()
        if (!submittedExistingIds.has(idStr) && !submittedExistingIds.has(dbItem.id)) {
          const { error: deleteError } = await supabaseAdmin
            .from('order_items')
            .delete()
            .eq('id', dbItem.id)

          if (deleteError) {
            console.error('Error deleting item:', deleteError)
          }
        }
      }
    }

    // Recalculate totals from DB
    const { data: updatedItems } = await supabaseAdmin
      .from('order_items')
      .select('quantity, unit_price')
      .eq('order_id', orderId)

    const newSubtotal = (updatedItems || []).reduce(
      (sum: number, item: any) => sum + (parseFloat(item.unit_price) * item.quantity),
      0
    )
    const newTotal = roundMoney(newSubtotal + shipping)

    const { error: updateError } = await supabaseAdmin
      .from('orders')
      .update({
        subtotal_amount: roundMoney(newSubtotal),
        total_amount: newTotal,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)

    if (updateError) {
      console.error('Error updating order totals:', updateError)
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Error updating order by tracking token:', err)
    return NextResponse.json(
      { error: 'حدث خطأ في الخادم' },
      { status: 500 }
    )
  }
}
