'use client'

import { supabase } from '../supabase/client'
import { getOrCreateCustomerForSupplier } from '../services/partyLinkingService'

export interface CartItem {
  id: string
  product: any
  quantity: number
  selectedColors?: { [key: string]: number } | null
  price: number
  total: number
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
  supplierName = null
}: CreateSalesInvoiceParams) {
  if (!selections.branch) {
    throw new Error('يجب تحديد الفرع قبل إنشاء الفاتورة')
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
      const itemProfit = (item.price - costPrice) * item.quantity
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

    // Start transaction
    const { data: salesData, error: salesError } = await supabase
      .from('sales')
      .insert({
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
        invoice_type: (isReturn ? 'Sale Return' : 'Sale Invoice') as any
      })
      .select()
      .single()

    if (salesError) {
      console.error('Sales creation error:', salesError)
      throw new Error(`خطأ في إنشاء الفاتورة: ${salesError.message}`)
    }

    console.log('Sales invoice created successfully:', salesData)

    // Create sale items (negative quantities for returns)
    const saleItems = cartItems.map(item => {
      // تنسيق النص العربي بشكل صحيح
      let notesText = null
      if (item.selectedColors && Object.keys(item.selectedColors).length > 0) {
        const colorEntries = Object.entries(item.selectedColors as Record<string, number>)
          .filter(([color, qty]) => qty > 0)
          .map(([color, qty]) => `${color}: ${qty}`)
          .join(', ')
        if (colorEntries) {
          notesText = `الألوان المحددة: ${colorEntries}`
        }
      }
      
      return {
        sale_id: salesData.id,
        product_id: item.product.id,
        quantity: isReturn ? -item.quantity : item.quantity,
        unit_price: item.price,
        cost_price: item.product.cost_price || 0,
        discount: 0,
        notes: notesText,
        branch_id: item.branch_id || selections.branch.id // الفرع الخاص بكل منتج أو الفرع المحدد في الفاتورة
      }
    })

    console.log('Attempting to insert sale items:', saleItems)
    
    const { data: saleItemsData, error: saleItemsError } = await supabase
      .from('sale_items')
      .insert(saleItems)
      .select()

    if (saleItemsError) {
      console.error('Sale items error:', saleItemsError)
      console.error('Sale items data that failed:', saleItems)
      // If sale items creation fails, we should clean up the sale record
      await supabase.from('sales').delete().eq('id', salesData.id)
      throw new Error(`خطأ في إضافة عناصر الفاتورة: ${saleItemsError.message}`)
    }

    console.log('Sale items created successfully:', saleItemsData)

    // Note: Invoices are only assigned to the selected safe - no duplication to main safe
    // Each safe shows only its own invoices

    // Update inventory quantities (parallel execution for better performance)
    // كل منتج يتم خصمه من فرعه المحدد (item.branch_id)
    const inventoryUpdatePromises = cartItems.map(async (item) => {
      try {
        // استخدام branch_id الخاص بكل منتج
        // استخدم branch_id من المنتج أو من الفرع المحدد في الفاتورة كـ fallback
        const itemBranchId = item.branch_id || selections.branch.id

        // First get current quantity, then update
        const { data: currentInventory, error: getError } = await supabase
          .from('inventory')
          .select('quantity')
          .eq('product_id', item.product.id)
          .eq('branch_id', itemBranchId)
          .single()

        if (getError) {
          console.warn(`Failed to get current inventory for product ${item.product.id} in branch ${itemBranchId}:`, getError.message)
          return
        }

        // For returns, add quantity back; for sales, subtract
        const quantityChange = isReturn ? item.quantity : -item.quantity
        const newQuantity = Math.max(0, (currentInventory?.quantity || 0) + quantityChange)

        const { error: inventoryError } = await supabase
          .from('inventory')
          .update({
            quantity: newQuantity
          })
          .eq('product_id', item.product.id)
          .eq('branch_id', itemBranchId)

        if (inventoryError) {
          console.warn(`Failed to update inventory for product ${item.product.id} in branch ${itemBranchId}:`, inventoryError.message)
        }
      } catch (err) {
        console.warn(`Error updating inventory for product ${item.product.id}:`, err)
      }
    })

    // Update product variant quantities in parallel
    // كل variant يتم خصمه من فرع المنتج المحدد (item.branch_id)
    const variantUpdatePromises = cartItems
      .filter(item => item.selectedColors && Object.keys(item.selectedColors).length > 0)
      .flatMap(item => {
        // استخدم branch_id من المنتج أو من الفرع المحدد في الفاتورة كـ fallback
        const itemBranchId = item.branch_id || selections.branch.id
        return Object.entries(item.selectedColors as Record<string, number>)
          .filter(([_, colorQuantity]) => colorQuantity > 0)
          .map(async ([colorName, colorQuantity]) => {
            try {
              // First, get the variant definition ID from product_color_shape_definitions
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

              // Get current quantity from product_variant_quantities
              const { data: currentQuantity, error: qtyGetError } = await supabase
                .from('product_variant_quantities')
                .select('quantity')
                .eq('variant_definition_id', variantDefinition.id)
                .eq('branch_id', itemBranchId)
                .single()

              if (qtyGetError && qtyGetError.code !== 'PGRST116') {
                console.warn(`Failed to get current quantity for variant ${variantDefinition.id}:`, qtyGetError.message)
                return
              }

              // For returns, add quantity back; for sales, subtract
              const variantQuantityChange = isReturn ? colorQuantity : -colorQuantity
              const newVariantQuantity = Math.max(0, (currentQuantity?.quantity || 0) + variantQuantityChange)

              // Update or insert quantity in product_variant_quantities
              const { error: qtyUpdateError } = await supabase
                .from('product_variant_quantities')
                .upsert({
                  variant_definition_id: variantDefinition.id,
                  branch_id: itemBranchId,
                  quantity: newVariantQuantity,
                  updated_at: new Date().toISOString()
                }, {
                  onConflict: 'variant_definition_id,branch_id'
                })

              if (qtyUpdateError) {
                console.warn(`Failed to update variant quantity for variant ${variantDefinition.id}:`, qtyUpdateError.message)
              }
            } catch (err) {
              console.warn(`Error updating variant for product ${item.product.id}, color ${colorName}:`, err)
            }
          })
      })

    // Execute all inventory and variant updates in parallel
    await Promise.all([...inventoryUpdatePromises, ...variantUpdatePromises])

    // Fetch all payment methods at once (optimization: single query instead of loop)
    const paymentMethodIds = paymentSplitData?.filter(p => p.paymentMethodId).map(p => p.paymentMethodId) || []
    let methodMap = new Map<string, string>()

    if (paymentMethodIds.length > 0) {
      const { data: allPaymentMethods } = await supabase
        .from('payment_methods')
        .select('id, name')
        .in('id', paymentMethodIds)

      methodMap = new Map(allPaymentMethods?.map(m => [m.id, m.name]) || [])
    }

    // Save payment split data to customer_payments table (batch insert instead of loop)
    if (!isReturn && paymentSplitData && paymentSplitData.length > 0) {
      const validPayments = paymentSplitData.filter(p => p.amount > 0 && p.paymentMethodId)

      if (validPayments.length > 0) {
        const allPayments = validPayments.map(payment => ({
          customer_id: customerId,
          amount: payment.amount,
          payment_method: methodMap.get(payment.paymentMethodId) || 'cash',
          notes: `دفعة من فاتورة رقم ${invoiceNumber}`,
          payment_date: new Date().toISOString().split('T')[0],
          created_by: userId || null,
          safe_id: hasNoSafe ? null : selections.record.id
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
    }

    // Always create a transaction record in cash_drawer_transactions
    // This allows all sales (including "لا يوجد") to appear in the records
    // But only update cash drawer balance when there IS a safe selected
    try {
      const transactionAmount = cashToDrawer
      let drawer: any = null
      let newBalance: number | null = null

      // Only get/create drawer and update balance if there's a safe selected
      if (!hasNoSafe) {
        // Get or create drawer for this record
        const { data: existingDrawer, error: drawerError } = await supabase
          .from('cash_drawers')
          .select('*')
          .eq('record_id', selections.record.id)
          .single()

        if (drawerError && drawerError.code === 'PGRST116') {
          // Drawer doesn't exist, create it
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
          // Calculate new balance (for returns, cashToDrawer is negative)
          newBalance = (drawer.current_balance || 0) + transactionAmount

          // Update drawer balance
          await supabase
            .from('cash_drawers')
            .update({
              current_balance: newBalance,
              updated_at: new Date().toISOString()
            })
            .eq('id', drawer.id)

          console.log(`✅ Cash drawer updated: ${transactionAmount >= 0 ? '+' : ''}${transactionAmount}, new balance: ${newBalance}`)
        }
      }

      // Always create transaction record (even for "لا يوجد" sales)
      // This ensures all sales appear in the general records
      const transactionData: any = {
        transaction_type: isReturn ? 'return' : 'sale',
        amount: transactionAmount,
        sale_id: salesData.id,
        notes: isReturn
          ? `مرتجع - فاتورة رقم ${invoiceNumber}`
          : `بيع - فاتورة رقم ${invoiceNumber}`,
        performed_by: userName || 'system'
      }

      // Only add drawer_id, record_id, and balance_after if there's a safe
      if (!hasNoSafe && drawer) {
        transactionData.drawer_id = drawer.id
        transactionData.record_id = selections.record.id
        transactionData.balance_after = newBalance
      }

      await supabase
        .from('cash_drawer_transactions')
        .insert(transactionData)

      if (hasNoSafe) {
        console.log('✅ Sale created without safe - transaction recorded but no drawer balance affected')
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
      message: 'تم إنشاء الفاتورة بنجاح'
    }

  } catch (error: any) {
    throw new Error(error.message || 'حدث خطأ أثناء إنشاء الفاتورة')
  }
}