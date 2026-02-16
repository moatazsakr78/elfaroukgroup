'use client'

import { supabase } from '../supabase/client'
import { getOrCreateCustomerForSupplier } from '../services/partyLinkingService'
import { roundMoney } from '../utils/money'
import {
  createOfflineSalesInvoice,
  shouldUseOfflineMode,
  type OfflineCartItem,
  type OfflineInvoiceSelections
} from '../offline/offlineSales'

export interface CartItem {
  id: string
  product: any
  quantity: number
  selectedColors?: { [key: string]: number } | null
  selectedShapes?: { [key: string]: number } | null
  price: number
  total: number
  discount?: number
  discountType?: 'percentage' | 'fixed'
  branch_id?: string      // الفرع اللي اتباع منه المنتج (مطلوب للبيع، اختياري للشراء)
  branch_name?: string   // اسم الفرع للعرض
}

export interface InvoiceSelections {
  customer: any
  branch: any
  record: any
}

export interface PaymentEntry {
  id: string
  amount: number
  paymentMethodId: string
  paymentMethodName?: string
}

export interface CreateSalesInvoiceParams {
  cartItems: CartItem[]
  selections: InvoiceSelections
  paymentMethod?: string
  notes?: string
  isReturn?: boolean
  paymentSplitData?: PaymentEntry[]
  creditAmount?: number
  userId?: string | null
  userName?: string | null
  // Party type support (customer or supplier)
  partyType?: 'customer' | 'supplier'
  supplierId?: string | null
  supplierName?: string | null
  // Sale type (ground = أرضي, online = أون لاين)
  saleType?: 'ground' | 'online'
  shippingAmount?: number
  orderId?: string | null
}

export async function createSalesInvoice({
  cartItems,
  selections,
  paymentMethod = 'cash',
  notes,
  isReturn = false,
  paymentSplitData = [],
  creditAmount = 0,
  userId = null,
  userName = null,
  partyType = 'customer',
  supplierId = null,
  supplierName = null,
  saleType = 'ground',
  shippingAmount = 0,
  orderId = null
}: CreateSalesInvoiceParams) {
  if (!selections.branch) {
    throw new Error('يجب تحديد الفرع قبل إنشاء الفاتورة')
  }

  // Check if we should use offline mode
  if (shouldUseOfflineMode()) {
    console.log('Offline mode detected - creating offline invoice')

    // Convert to offline format
    const offlineCartItems: OfflineCartItem[] = cartItems.map(item => ({
      product: {
        id: item.product.id,
        name: item.product.name,
        cost_price: item.product.cost_price || 0
      },
      quantity: item.quantity,
      price: item.price,
      total: item.total,
      branch_id: item.branch_id || selections.branch?.id || '',
      branch_name: item.branch_name,
      selectedColors: item.selectedColors,
      selectedShapes: item.selectedShapes
    }))

    const offlineSelections: OfflineInvoiceSelections = {
      customer: selections.customer ? {
        id: selections.customer.id,
        name: selections.customer.name
      } : null,
      branch: {
        id: selections.branch.id,
        name: selections.branch.name
      },
      record: selections.record ? {
        id: selections.record.id,
        name: selections.record.name
      } : null
    }

    const offlineResult = await createOfflineSalesInvoice({
      cartItems: offlineCartItems,
      selections: offlineSelections,
      paymentMethod: paymentMethod,
      notes: notes,
      isReturn: isReturn,
      paymentSplitData: paymentSplitData?.map(p => ({
        id: p.id,
        amount: p.amount,
        paymentMethodId: p.paymentMethodId
      })),
      creditAmount: creditAmount,
      userId: userId,
      userName: userName
    })

    return {
      success: offlineResult.success,
      invoiceId: offlineResult.localId,
      invoiceNumber: offlineResult.tempInvoiceNumber,
      totalAmount: offlineResult.totalAmount,
      message: offlineResult.message,
      isOffline: true
    }
  }

  // "No safe" record ID - a special record for transactions without a specific safe
  const NO_SAFE_RECORD_ID = '00000000-0000-0000-0000-000000000000'

  // Check if "no safe" option was selected (record.id is null or empty)
  const hasNoSafe = !selections.record || !selections.record.id;

  // Get the effective record ID - use NO_SAFE_RECORD_ID if no safe selected
  const effectiveRecordId = hasNoSafe ? NO_SAFE_RECORD_ID : selections.record.id;

  if (!cartItems || cartItems.length === 0) {
    throw new Error('لا يمكن إنشاء فاتورة بدون منتجات')
  }

  // Use default customer if none selected (for customer sales)
  const DEFAULT_CUSTOMER_ID = '00000000-0000-0000-0000-000000000001' // The default customer from database

  // Determine customer_id and supplier_id based on party type
  let customerId: string | null = null
  let effectiveSupplierId: string | null = null

  if (partyType === 'supplier' && supplierId) {
    // البيع لمورد - إنشاء/ربط عميل للمورد تلقائياً
    const linkResult = await getOrCreateCustomerForSupplier(supplierId)
    if (linkResult.success && linkResult.id) {
      customerId = linkResult.id
      effectiveSupplierId = supplierId
      console.log('Auto-linked customer for supplier:', { supplierId, linkedCustomerId: linkResult.id, isNew: linkResult.isNew })
    } else {
      // Fallback to default customer if linking fails
      console.warn('Failed to link customer for supplier, using default:', linkResult.error)
      customerId = DEFAULT_CUSTOMER_ID
      effectiveSupplierId = supplierId
    }
  } else {
    // البيع العادي لعميل
    customerId = (selections.customer && selections.customer.id) ? selections.customer.id : DEFAULT_CUSTOMER_ID
    effectiveSupplierId = null
  }

  console.log('Party selection debug:', {
    partyType: partyType,
    hasCustomer: !!selections.customer,
    customerId: customerId,
    supplierId: effectiveSupplierId,
    supplierName: supplierName,
    rawCustomer: selections.customer
  })

  // Validate that customerId is a valid UUID and not null/undefined
  if (!customerId || typeof customerId !== 'string' || customerId.trim() === '') {
    throw new Error(`خطأ في معرف العميل: ${customerId}`)
  }

  // Track if sale was created on server (used in catch block to prevent offline duplicates)
  let createdSaleId: string | null = null

  try {
    // Validate cart items
    for (const item of cartItems) {
      if (!item.product || !item.product.id) {
        throw new Error(`منتج غير صالح في السلة: ${JSON.stringify(item)}`)
      }
      if (typeof item.quantity !== 'number' || item.quantity <= 0) {
        throw new Error(`كمية غير صالحة للمنتج ${item.product.name}: ${item.quantity}`)
      }
      if (typeof item.price !== 'number' || item.price < 0) {
        throw new Error(`سعر غير صالح للمنتج ${item.product.name}: ${item.price}`)
      }
    }

    // Calculate totals (negative for returns)
    const baseTotal = cartItems.reduce((sum, item) => sum + item.total, 0)
    const totalAmount = isReturn ? -baseTotal : baseTotal
    const taxAmount = 0 // You can add tax calculation here if needed
    const discountAmount = 0 // You can add discount calculation here if needed
    const profit = cartItems.reduce((sum, item) => {
      const costPrice = item.product.cost_price || 0
      // حساب الربح بعد الخصم: الربح = إجمالي البيع بعد الخصم - التكلفة
      const itemProfit = item.total - (costPrice * item.quantity)
      return sum + (isReturn ? -itemProfit : itemProfit)
    }, 0)

    // Generate unique invoice number using database sequence (atomic operation)
    // @ts-ignore - function exists in database but not in generated types
    const { data: seqData, error: seqError } = await supabase.rpc('get_next_sales_invoice_number' as any)
    if (seqError) {
      console.error('Error generating invoice number:', seqError)
      throw new Error('فشل في توليد رقم الفاتورة')
    }
    const invoiceNumber = seqData as string

    // Get current time
    const now = new Date()
    const timeString = now.toTimeString().split(' ')[0] // HH:MM:SS format

    // Prepare notes with supplier info if selling to supplier
    let finalNotes = notes || null
    if (partyType === 'supplier' && supplierName) {
      const supplierNote = `بيع لمورد: ${supplierName}`
      finalNotes = notes ? `${supplierNote} | ${notes}` : supplierNote
    }

    console.log('Creating sales invoice with data:', {
      invoice_number: invoiceNumber,
      total_amount: totalAmount,
      tax_amount: taxAmount,
      discount_amount: discountAmount,
      profit: profit,
      payment_method: paymentMethod,
      branch_id: selections.branch.id,
      customer_id: customerId,
      supplier_id: effectiveSupplierId,
      record_id: hasNoSafe ? null : selections.record.id,
      notes: finalNotes,
      time: timeString,
      invoice_type: (isReturn ? 'Sale Return' : 'Sale Invoice'),
      no_safe_selected: hasNoSafe,
      partyType: partyType
    })

    // Fetch all payment methods at once (needed before saleData to compute payment_method summary)
    const paymentMethodIds = paymentSplitData?.filter(p => p.paymentMethodId).map(p => p.paymentMethodId) || []
    let methodMap = new Map<string, string>()

    if (paymentMethodIds.length > 0) {
      const { data: allPaymentMethods } = await supabase
        .from('payment_methods')
        .select('id, name')
        .in('id', paymentMethodIds)

      methodMap = new Map(allPaymentMethods?.map(m => [m.id, m.name]) || [])
    }

    // Compute payment method summary from split data
    let paymentMethodSummary = paymentMethod // fallback
    const validPayments = (paymentSplitData || []).filter(p => p.amount > 0 && p.paymentMethodId)
    if (validPayments.length > 0) {
      const methodNames = Array.from(new Set(
        validPayments.map(p => methodMap.get(p.paymentMethodId) || 'cash')
      ))
      paymentMethodSummary = methodNames.join(', ')
    }

    // Prepare sale data for atomic insertion
    const saleData: any = {
      invoice_number: invoiceNumber,
      total_amount: totalAmount,
      tax_amount: taxAmount,
      discount_amount: discountAmount,
      profit: profit,
      payment_method: paymentMethodSummary,
      branch_id: selections.branch.id,
      customer_id: customerId,
      supplier_id: effectiveSupplierId || '',
      record_id: hasNoSafe ? '' : selections.record.id,
      notes: finalNotes || '',
      time: timeString,
      invoice_type: (isReturn ? 'Sale Return' : 'Sale Invoice'),
      sale_type: saleType,
      shipping_amount: shippingAmount || 0,
      order_id: orderId || ''
    }

    // Prepare sale items for atomic insertion (negative quantities for returns)
    const saleItems = cartItems.map(item => {
      let notesText = ''
      if (item.selectedColors && Object.keys(item.selectedColors).length > 0) {
        const colorEntries = Object.entries(item.selectedColors as Record<string, number>)
          .filter(([color, qty]) => qty > 0)
          .map(([color, qty]) => `${color}: ${qty}`)
          .join(', ')
        if (colorEntries) {
          notesText = `الألوان المحددة: ${colorEntries}`
        }
      }
      if (item.selectedShapes && Object.keys(item.selectedShapes).length > 0) {
        const shapeEntries = Object.entries(item.selectedShapes as Record<string, number>)
          .filter(([shape, qty]) => qty > 0)
          .map(([shape, qty]) => `${shape}: ${qty}`)
          .join(', ')
        if (shapeEntries) {
          notesText += (notesText ? ' | ' : '') + `الأشكال المحددة: ${shapeEntries}`
        }
      }

      return {
        product_id: item.product.id,
        quantity: isReturn ? -item.quantity : item.quantity,
        unit_price: item.price,
        cost_price: item.product.cost_price || 0,
        discount: 0,
        notes: notesText,
        branch_id: item.branch_id || selections.branch.id
      }
    })

    console.log('Creating sale atomically with items:', { saleData, itemCount: saleItems.length })

    // Atomic insert: sale + items in a single transaction
    // If items fail, the entire sale is rolled back - no orphaned sales
    // @ts-ignore - function exists in database but not in generated types
    const { data: rpcResult, error: rpcError } = await supabase.rpc('create_sale_with_items' as any, {
      p_sale_data: saleData,
      p_items: saleItems
    })

    if (rpcError) {
      console.error('Atomic sale creation error:', rpcError)
      throw new Error(`خطأ في إنشاء الفاتورة: ${rpcError.message}`)
    }

    const salesData = { id: rpcResult.id, invoice_number: rpcResult.invoice_number }
    createdSaleId = salesData.id

    console.log('Sale + items created atomically:', salesData)

    // Note: Invoices are only assigned to the selected safe - no duplication to main safe
    // Each safe shows only its own invoices

    // Update inventory quantities atomically (parallel execution for better performance)
    // كل منتج يتم خصمه من فرعه المحدد (item.branch_id)
    const inventoryWarnings: string[] = []
    const inventoryUpdatePromises = cartItems.map(async (item) => {
      try {
        const itemBranchId = item.branch_id || selections.branch.id

        // For returns, add quantity back; for sales, subtract
        const quantityChange = isReturn ? item.quantity : -item.quantity

        // Atomic update: quantity = quantity + change (no read-modify-write race)
        const { data: invResult, error: invError } = await supabase.rpc(
          'atomic_adjust_inventory' as any,
          {
            p_product_id: item.product.id,
            p_branch_id: itemBranchId,
            p_warehouse_id: null,
            p_change: quantityChange,
            p_allow_negative: true
          }
        )

        if (invError) {
          console.warn(`Failed to update inventory for product ${item.product.id} in branch ${itemBranchId}:`, invError.message)
          return
        }

        // Track negative inventory warnings
        if (invResult && invResult[0]?.went_negative) {
          inventoryWarnings.push(`المنتج "${item.product.name}" أصبح المخزون سالب (${invResult[0].new_quantity})`)
        }
      } catch (err) {
        console.warn(`Error updating inventory for product ${item.product.id}:`, err)
      }
    })

    // Update product variant quantities atomically in parallel
    // كل variant يتم خصمه من فرع المنتج المحدد (item.branch_id)
    const variantUpdatePromises = cartItems
      .filter(item => item.selectedColors && Object.keys(item.selectedColors).length > 0)
      .flatMap(item => {
        const itemBranchId = item.branch_id || selections.branch.id
        return Object.entries(item.selectedColors as Record<string, number>)
          .filter(([_, colorQuantity]) => colorQuantity > 0)
          .map(async ([colorName, colorQuantity]) => {
            try {
              const { data: variantDefinition, error: defError } = await supabase
                .from('product_color_shape_definitions')
                .select('id')
                .eq('product_id', item.product.id)
                .eq('name', colorName)
                .eq('variant_type', 'color')
                .single()

              if (defError || !variantDefinition) {
                console.warn(`Failed to get variant definition for product ${item.product.id}, color ${colorName}:`, defError?.message)
                return
              }

              const variantQuantityChange = isReturn ? colorQuantity : -colorQuantity

              const { error: qtyUpdateError } = await supabase.rpc(
                'atomic_adjust_variant_quantity' as any,
                {
                  p_variant_definition_id: variantDefinition.id,
                  p_branch_id: itemBranchId,
                  p_change: variantQuantityChange,
                  p_allow_negative: true
                }
              )

              if (qtyUpdateError) {
                console.warn(`Failed to update variant quantity for variant ${variantDefinition.id}:`, qtyUpdateError.message)
              }
            } catch (err) {
              console.warn(`Error updating variant for product ${item.product.id}, color ${colorName}:`, err)
            }
          })
      })

    // Update shape variant quantities atomically in parallel (same logic as colors but variant_type='shape')
    const shapeUpdatePromises = cartItems
      .filter(item => item.selectedShapes && Object.keys(item.selectedShapes).length > 0)
      .flatMap(item => {
        const itemBranchId = item.branch_id || selections.branch.id
        return Object.entries(item.selectedShapes as Record<string, number>)
          .filter(([_, shapeQuantity]) => shapeQuantity > 0)
          .map(async ([shapeName, shapeQuantity]) => {
            try {
              const { data: variantDefinition, error: defError } = await supabase
                .from('product_color_shape_definitions')
                .select('id')
                .eq('product_id', item.product.id)
                .eq('name', shapeName)
                .eq('variant_type', 'shape')
                .single()

              if (defError || !variantDefinition) {
                console.warn(`Failed to get variant definition for product ${item.product.id}, shape ${shapeName}:`, defError?.message)
                return
              }

              const variantQuantityChange = isReturn ? shapeQuantity : -shapeQuantity

              const { error: qtyUpdateError } = await supabase.rpc(
                'atomic_adjust_variant_quantity' as any,
                {
                  p_variant_definition_id: variantDefinition.id,
                  p_branch_id: itemBranchId,
                  p_change: variantQuantityChange,
                  p_allow_negative: true
                }
              )

              if (qtyUpdateError) {
                console.warn(`Failed to update shape variant quantity for variant ${variantDefinition.id}:`, qtyUpdateError.message)
              }
            } catch (err) {
              console.warn(`Error updating shape variant for product ${item.product.id}, shape ${shapeName}:`, err)
            }
          })
      })

    // Execute all inventory and variant updates in parallel
    await Promise.all([...inventoryUpdatePromises, ...variantUpdatePromises, ...shapeUpdatePromises])

    // Save payment split data to customer_payments table (batch insert instead of loop)
    if (!isReturn && validPayments.length > 0) {
      if (validPayments.length > 0) {
        const allPayments = validPayments.map(payment => ({
          customer_id: customerId,
          amount: payment.amount,
          payment_method: methodMap.get(payment.paymentMethodId) || 'cash',
          notes: `دفعة من فاتورة رقم ${invoiceNumber}`,
          payment_date: new Date().toISOString().split('T')[0],
          created_by: userId || null,
          safe_id: hasNoSafe ? null : selections.record.id,
          sale_id: salesData.id
        }))

        const { error: paymentError } = await supabase
          .from('customer_payments')
          .insert(allPayments)

        if (paymentError) {
          console.warn('Failed to save payment entries:', paymentError.message)
          console.error('Payment error details:', paymentError)
        } else {
          console.log(`✅ ${allPayments.length} payments saved successfully`)
        }
      }
    }

    // Note: Customer balance is calculated dynamically as:
    // Balance = (Total Sales) - (Total Payments)
    // No need to update account_balance in customers table
    // The balance is computed in real-time from sales and customer_payments tables

    // Calculate cash amount from payments (cash payments go to drawer)
    // Using methodMap from above instead of querying again (optimization)
    let cashToDrawer = 0
    const cashPaymentMethods = ['cash', 'نقدي', 'كاش']

    if (paymentSplitData && paymentSplitData.length > 0) {
      // Use the methodMap we already fetched (no additional queries needed)
      cashToDrawer = paymentSplitData
        .filter(p => p.amount > 0 && p.paymentMethodId)
        .filter(p => {
          const methodName = methodMap.get(p.paymentMethodId)?.toLowerCase() || ''
          return cashPaymentMethods.includes(methodName)
        })
        .reduce((sum, p) => sum + p.amount, 0)

      // للمرتجعات: الفلوس تخرج من الخزنة (قيمة سالبة)
      if (isReturn) {
        cashToDrawer = -cashToDrawer
      }
    } else if (paymentMethod === 'cash' || paymentMethod === 'نقدي') {
      // If no split payment and payment method is cash, entire amount goes to drawer
      // For returns, this will be negative (money out of drawer)
      cashToDrawer = totalAmount - (creditAmount || 0)
      // Guard: if totalAmount is 0 but creditAmount > 0, something is wrong
      if (totalAmount === 0 && (creditAmount || 0) > 0) {
        console.error('BUG: totalAmount is 0 but creditAmount > 0, skipping drawer update')
        cashToDrawer = 0
      }
    }

    // Create transaction records in cash_drawer_transactions - one per payment method
    // Cash payments update the drawer balance, non-cash payments are recorded without affecting balance
    try {
      let drawer: any = null
      let currentBalance: number = 0

      // Only get/create drawer if there's a safe selected
      if (!hasNoSafe) {
        const { data: existingDrawer, error: drawerError } = await supabase
          .from('cash_drawers')
          .select('*')
          .eq('record_id', selections.record.id)
          .single()

        if (drawerError && drawerError.code === 'PGRST116') {
          const { data: newDrawer, error: createError } = await supabase
            .from('cash_drawers')
            .insert({ record_id: selections.record.id, current_balance: 0 })
            .select()
            .single()

          if (!createError) {
            drawer = newDrawer
          }
        } else {
          drawer = existingDrawer
        }

        if (drawer) {
          currentBalance = drawer.current_balance || 0
        }
      }

      // Build per-payment-method transactions
      const cashPaymentMethods = ['cash', 'نقدي', 'كاش']
      const transactionsToInsert: any[] = []

      if (validPayments.length > 0) {
        // Split payment mode - create one transaction per payment method
        for (const payment of validPayments) {
          const methodName = methodMap.get(payment.paymentMethodId) || 'cash'
          const isCash = cashPaymentMethods.includes(methodName.toLowerCase())
          let amount = isReturn ? -payment.amount : payment.amount

          const txData: any = {
            transaction_type: isReturn ? 'return' : 'sale',
            amount: amount,
            sale_id: salesData.id,
            payment_method: methodName,
            notes: isReturn
              ? `مرتجع - فاتورة رقم ${invoiceNumber} (${methodName})`
              : `بيع - فاتورة رقم ${invoiceNumber} (${methodName})`,
            performed_by: userName || 'system'
          }

          if (!hasNoSafe && drawer) {
            txData.drawer_id = drawer.id
            txData.record_id = selections.record.id
            if (isCash) {
              // Cash payments update drawer balance
              currentBalance = roundMoney(currentBalance + amount)
              txData.balance_after = currentBalance
            } else {
              // Non-cash payments: record but don't affect drawer balance
              txData.balance_after = null
            }
          }

          transactionsToInsert.push(txData)
        }
      } else {
        // Single payment (no split) - single transaction
        const amount = cashToDrawer
        const txData: any = {
          transaction_type: isReturn ? 'return' : 'sale',
          amount: amount,
          sale_id: salesData.id,
          payment_method: paymentMethodSummary,
          notes: isReturn
            ? `مرتجع - فاتورة رقم ${invoiceNumber}`
            : `بيع - فاتورة رقم ${invoiceNumber}`,
          performed_by: userName || 'system'
        }

        if (!hasNoSafe && drawer) {
          txData.drawer_id = drawer.id
          txData.record_id = selections.record.id
          currentBalance = roundMoney(currentBalance + amount)
          txData.balance_after = currentBalance
        }

        transactionsToInsert.push(txData)
      }

      // Update drawer balance with only the cash portion
      if (!hasNoSafe && drawer) {
        await supabase
          .from('cash_drawers')
          .update({
            current_balance: currentBalance,
            updated_at: new Date().toISOString()
          })
          .eq('id', drawer.id)

        console.log(`✅ Cash drawer updated: new balance: ${currentBalance}`)
      }

      // Insert all transaction records
      if (transactionsToInsert.length > 0) {
        await supabase
          .from('cash_drawer_transactions')
          .insert(transactionsToInsert)

        console.log(`✅ ${transactionsToInsert.length} transaction(s) recorded`)
      }

      if (hasNoSafe) {
        console.log('✅ Sale created without safe - transaction(s) recorded but no drawer balance affected')
      }
    } catch (drawerError) {
      console.warn('Failed to create cash drawer transaction:', drawerError)
      // Don't throw error here as the sale was created successfully
    }

    return {
      success: true,
      invoiceId: salesData.id,
      invoiceNumber: invoiceNumber,
      totalAmount: totalAmount,
      message: 'تم إنشاء الفاتورة بنجاح',
      inventoryWarnings: inventoryWarnings.length > 0 ? inventoryWarnings : undefined
    }

  } catch (error: any) {
    // تحقق إذا كان الخطأ بسبب مشكلة في الاتصال - حاول الوضع الـ offline
    const isNetworkError = (
      !navigator.onLine ||
      error.message?.includes('network') ||
      error.message?.includes('fetch') ||
      error.message?.includes('فشل في توليد') ||
      error.message?.includes('Failed to fetch') ||
      error.message?.includes('ERR_NAME_NOT_RESOLVED') ||
      error.message?.includes('timeout') ||
      error.message?.includes('ENOTFOUND') ||
      error.message?.includes('ECONNREFUSED')
    )

    if (isNetworkError) {
      // If the sale was already created on the server, DON'T create an offline duplicate
      if (createdSaleId) {
        console.error('Sale was already created on server (id:', createdSaleId, ') but a later step failed. DO NOT create offline duplicate.')
        throw new Error('الفاتورة اتعملت جزئياً - برجاء المراجعة')
      }

      console.log('Network error detected in createSalesInvoice, falling back to offline mode...')

      try {
        // Convert to offline format
        const offlineCartItems: OfflineCartItem[] = cartItems.map(item => ({
          product: {
            id: item.product.id,
            name: item.product.name,
            cost_price: item.product.cost_price || 0
          },
          quantity: item.quantity,
          price: item.price,
          total: item.total,
          branch_id: item.branch_id || selections.branch?.id || '',
          branch_name: item.branch_name,
          selectedColors: item.selectedColors
        }))

        const offlineSelections: OfflineInvoiceSelections = {
          customer: selections.customer ? {
            id: selections.customer.id,
            name: selections.customer.name
          } : null,
          branch: {
            id: selections.branch.id,
            name: selections.branch.name
          },
          record: selections.record ? {
            id: selections.record.id,
            name: selections.record.name
          } : null
        }

        const offlineResult = await createOfflineSalesInvoice({
          cartItems: offlineCartItems,
          selections: offlineSelections,
          paymentMethod: paymentMethod,
          notes: notes,
          isReturn: isReturn,
          paymentSplitData: paymentSplitData?.map(p => ({
            id: p.id,
            amount: p.amount,
            paymentMethodId: p.paymentMethodId
          })),
          creditAmount: creditAmount,
          userId: userId,
          userName: userName
        })

        return {
          success: offlineResult.success,
          invoiceId: offlineResult.localId,
          invoiceNumber: offlineResult.tempInvoiceNumber,
          totalAmount: offlineResult.totalAmount,
          message: offlineResult.message + ' (فشل الاتصال)',
          isOffline: true
        }
      } catch (offlineError: any) {
        console.error('Offline fallback also failed:', offlineError)
        throw new Error(offlineError.message || 'فشل في حفظ الفاتورة محلياً')
      }
    }

    throw new Error(error.message || 'حدث خطأ أثناء إنشاء الفاتورة')
  }
}