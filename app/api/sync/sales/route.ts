import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { CLIENT_CONFIG } from '@/client.config'
import { roundMoney } from '@/app/lib/utils/money'

// Create Supabase client with service role for admin operations
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  db: { schema: CLIENT_CONFIG.schema }
})

interface PendingSaleItem {
  product_id: string
  product_name: string
  quantity: number
  unit_price: number
  cost_price: number
  discount: number
  branch_id: string
  notes: string | null
  selected_colors?: { [key: string]: number } | null
}

interface PaymentEntry {
  id: string
  amount: number
  paymentMethodId: string
  paymentMethodName?: string
}

interface PendingSale {
  local_id: string
  temp_invoice_number: string
  invoice_type: 'Sale Invoice' | 'Sale Return'
  total_amount: number
  tax_amount: number
  discount_amount: number
  profit: number
  payment_method: string
  branch_id: string
  customer_id: string
  record_id: string | null
  notes: string | null
  items: PendingSaleItem[]
  payment_split_data: PaymentEntry[]
  credit_amount: number
  user_id: string | null
  user_name: string | null
  created_at: string
  device_id: string
}

interface SyncResult {
  local_id: string
  success: boolean
  invoice_number?: string
  invoice_id?: string
  error?: string
}

// POST /api/sync/sales - Sync offline sales to database
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { sales } = body as { sales: PendingSale[] }

    if (!sales || !Array.isArray(sales) || sales.length === 0) {
      return NextResponse.json(
        { success: false, error: 'لا توجد فواتير للمزامنة' },
        { status: 400 }
      )
    }

    const results: SyncResult[] = []

    // Process each sale
    for (const sale of sales) {
      try {
        const result = await processSingleSale(sale)
        results.push(result)
      } catch (error: any) {
        results.push({
          local_id: sale.local_id,
          success: false,
          error: error.message || 'خطأ غير معروف'
        })
      }
    }

    const successCount = results.filter(r => r.success).length
    const failCount = results.filter(r => !r.success).length

    return NextResponse.json({
      success: failCount === 0,
      results,
      summary: {
        total: sales.length,
        synced: successCount,
        failed: failCount
      }
    })
  } catch (error: any) {
    console.error('Sync API error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'خطأ في معالجة الطلب' },
      { status: 500 }
    )
  }
}

async function processSingleSale(sale: PendingSale): Promise<SyncResult> {
  const isReturn = sale.invoice_type === 'Sale Return'

  // Generate official invoice number from database sequence
  // @ts-ignore - function exists in database
  const { data: seqData, error: seqError } = await supabase.rpc('get_next_sales_invoice_number')

  if (seqError) {
    console.error('Error generating invoice number:', seqError)
    throw new Error('فشل في توليد رقم الفاتورة')
  }

  const invoiceNumber = seqData as string

  // Extract time from created_at (preserving original sale time)
  const createdAt = new Date(sale.created_at)
  const timeString = createdAt.toTimeString().split(' ')[0]

  // Prepare notes with offline sync info
  let finalNotes = sale.notes || ''
  finalNotes = finalNotes
    ? `${finalNotes} | مزامنة offline: ${sale.temp_invoice_number}`
    : `مزامنة offline: ${sale.temp_invoice_number}`

  // Build sale data for atomic RPC
  const saleData = {
    invoice_number: invoiceNumber,
    total_amount: sale.total_amount,
    tax_amount: sale.tax_amount,
    discount_amount: sale.discount_amount,
    profit: sale.profit,
    payment_method: sale.payment_method,
    branch_id: sale.branch_id,
    customer_id: sale.customer_id,
    record_id: sale.record_id,
    notes: finalNotes,
    time: timeString,
    invoice_type: sale.invoice_type
  }

  // Build items array for atomic RPC
  const saleItems = sale.items.map(item => ({
    product_id: item.product_id,
    quantity: item.quantity,
    unit_price: item.unit_price,
    cost_price: item.cost_price,
    discount: item.discount,
    notes: item.notes,
    branch_id: item.branch_id
  }))

  // Atomic insert: sale + items in a single transaction
  // @ts-ignore - function exists in database but not in generated types
  const { data: rpcResult, error: rpcError } = await supabase.rpc(
    'create_sale_with_items',
    { p_sale_data: saleData, p_items: saleItems }
  )

  if (rpcError) {
    console.error('Sales creation error:', rpcError)
    throw new Error(`خطأ في إنشاء الفاتورة: ${rpcError.message}`)
  }

  const salesData = rpcResult as { id: string; invoice_number: string }

  // Update inventory atomically
  for (const item of sale.items) {
    try {
      // For sales subtract, for returns add back
      const quantityChange = isReturn ? Math.abs(item.quantity) : -Math.abs(item.quantity)

      await supabase.rpc(
        'atomic_adjust_inventory',
        {
          p_product_id: item.product_id,
          p_branch_id: item.branch_id,
          p_warehouse_id: null,
          p_change: quantityChange,
          p_allow_negative: true
        }
      )
    } catch (err) {
      console.warn(`Failed to update inventory for ${item.product_id}:`, err)
    }
  }

  // Fetch payment methods for payment processing
  const paymentMethodIds = sale.payment_split_data
    ?.filter(p => p.paymentMethodId)
    .map(p => p.paymentMethodId) || []

  let methodMap = new Map<string, string>()

  if (paymentMethodIds.length > 0) {
    const { data: allPaymentMethods } = await supabase
      .from('payment_methods')
      .select('id, name')
      .in('id', paymentMethodIds)

    methodMap = new Map(allPaymentMethods?.map(m => [m.id, m.name]) || [])
  }

  // Save payment split data
  if (!isReturn && sale.payment_split_data && sale.payment_split_data.length > 0) {
    const validPayments = sale.payment_split_data.filter(p => p.amount > 0 && p.paymentMethodId)

    if (validPayments.length > 0) {
      const allPayments = validPayments.map(payment => ({
        customer_id: sale.customer_id,
        amount: payment.amount,
        payment_method: methodMap.get(payment.paymentMethodId) || 'cash',
        notes: `دفعة من فاتورة رقم ${invoiceNumber} (offline: ${sale.temp_invoice_number})`,
        payment_date: sale.created_at.split('T')[0],
        created_by: sale.user_id || null,
        safe_id: sale.record_id,
        sale_id: salesData.id
      }))

      await supabase
        .from('customer_payments')
        .insert(allPayments)
    }
  }

  // Handle cash drawer
  const hasNoSafe = !sale.record_id
  const cashPaymentMethods = ['cash', 'نقدي', 'كاش']

  let cashToDrawer = 0
  if (sale.payment_split_data && sale.payment_split_data.length > 0) {
    cashToDrawer = sale.payment_split_data
      .filter(p => p.amount > 0 && p.paymentMethodId)
      .filter(p => {
        const methodName = methodMap.get(p.paymentMethodId)?.toLowerCase() || ''
        return cashPaymentMethods.includes(methodName)
      })
      .reduce((sum, p) => sum + p.amount, 0)

    if (isReturn) {
      cashToDrawer = -cashToDrawer
    }
  } else if (sale.payment_method === 'cash' || sale.payment_method === 'نقدي') {
    cashToDrawer = sale.total_amount - (sale.credit_amount || 0)
  }

  // Create cash drawer transaction
  try {
    let drawer: any = null
    let newBalance: number | null = null

    if (!hasNoSafe) {
      const { data: existingDrawer, error: drawerError } = await supabase
        .from('cash_drawers')
        .select('*')
        .eq('record_id', sale.record_id)
        .single()

      if (drawerError && drawerError.code === 'PGRST116') {
        const { data: newDrawer } = await supabase
          .from('cash_drawers')
          .insert({ record_id: sale.record_id, current_balance: 0 })
          .select()
          .single()
        drawer = newDrawer
      } else {
        drawer = existingDrawer
      }

      if (drawer) {
        newBalance = roundMoney((drawer.current_balance || 0) + cashToDrawer)
        await supabase
          .from('cash_drawers')
          .update({
            current_balance: newBalance,
            updated_at: new Date().toISOString()
          })
          .eq('id', drawer.id)
      }
    }

    const transactionData: any = {
      transaction_type: isReturn ? 'return' : 'sale',
      amount: cashToDrawer,
      sale_id: salesData.id,
      notes: `${isReturn ? 'مرتجع' : 'بيع'} - فاتورة رقم ${invoiceNumber} (offline sync)`,
      performed_by: sale.user_name || 'system'
    }

    if (!hasNoSafe && drawer) {
      transactionData.drawer_id = drawer.id
      transactionData.record_id = sale.record_id
      transactionData.balance_after = newBalance
    }

    await supabase
      .from('cash_drawer_transactions')
      .insert(transactionData)
  } catch (drawerError) {
    console.warn('Failed to create cash drawer transaction:', drawerError)
  }

  return {
    local_id: sale.local_id,
    success: true,
    invoice_number: invoiceNumber,
    invoice_id: salesData.id
  }
}

// GET /api/sync/sales - Get sync status
export async function GET(request: NextRequest) {
  return NextResponse.json({
    success: true,
    message: 'Sync API is ready',
    timestamp: new Date().toISOString()
  })
}
