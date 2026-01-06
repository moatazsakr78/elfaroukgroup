import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth.config'
import { supabaseAdmin } from '@/app/lib/supabase/admin'

export async function GET() {
  try {
    // Check authentication
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Fetch orders for the authenticated user
    const { data: ordersData, error: ordersError } = await supabaseAdmin
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
        order_items (
          id,
          quantity,
          unit_price,
          products (
            id,
            name,
            barcode,
            main_image_url
          )
        )
      `)
      .eq('user_session', session.user.id)
      .order('created_at', { ascending: false })

    if (ordersError) {
      console.error('Error fetching orders:', ordersError)
      return NextResponse.json(
        { error: 'Failed to fetch orders' },
        { status: 500 }
      )
    }

    return NextResponse.json(ordersData || [])
  } catch (error) {
    console.error('Error in orders API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
