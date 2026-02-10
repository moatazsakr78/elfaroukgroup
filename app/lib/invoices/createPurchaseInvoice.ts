'use client'

import { supabase } from '../supabase/client'
import { CartItem } from './createSalesInvoice'
import { updateProductCostAfterPurchase, recalculateProductCostFromHistory } from '../utils/purchase-cost-management'
import { roundMoney } from '../utils/money'

export interface PurchaseInvoiceSelections {
  supplier: any
  warehouse: any
  record: any
}

export interface CreatePurchaseInvoiceParams {
  cartItems: CartItem[]
  selections: PurchaseInvoiceSelections
  paymentMethod?: string
  notes?: string
  isReturn?: boolean
  paidAmount?: number
  userId?: string
}

// Helper function to create new products in database
async function createNewProductInDatabase(product: any): Promise<string> {
  const { data, error } = await supabase
    .from('products')
    .insert({
      name: product.name,
      price: product.price || 0,
      cost_price: product.cost_price || 0,
      wholesale_price: product.wholesale_price || 0,
      price1: product.price_1 || 0,
      price2: product.price_2 || 0,
      price3: product.price_3 || 0,
      price4: product.price_4 || 0,
      barcode: product.barcode || null,
      product_code: product.product_code || null,
      description: product.description || null,
      main_image_url: product.main_image_url || null,
      category_id: product.category_id || null,
      is_active: true
    })
    .select('id')
    .single()

  if (error) {
    throw new Error(`فشل في إنشاء المنتج "${product.name}": ${error.message}`)
  }

  return data.id
}

export async function createPurchaseInvoice({
  cartItems,
  selections,
  paymentMethod = 'cash',
  notes,
  isReturn = false,
  paidAmount = 0,
  userId
}: CreatePurchaseInvoiceParams) {
  if (!selections.supplier || !selections.warehouse) {
    throw new Error('يجب تحديد المورد والمخزن قبل إنشاء فاتورة الشراء')
  }

  // Check if "no safe" option was selected (record.id is null)
  const hasNoSafe = !selections.record || !selections.record.id;

  if (!cartItems || cartItems.length === 0) {
    throw new Error('لا يمكن إنشاء فاتورة شراء بدون منتجات')
  }

  try {
    // First, handle new products (those with temp- IDs)
    // Create them in database and update their IDs
    const processedCartItems = await Promise.all(
      cartItems.map(async (item) => {
        const productId = String(item.product.id)

        // Check if this is a temporary product (new product from QuickAddProductModal)
        if (productId.startsWith('temp-')) {
          console.log(`🆕 Creating new product in database: ${item.product.name}`)

          // Create the product in database and get real ID
          const realProductId = await createNewProductInDatabase(item.product)

          console.log(`✅ Product created with ID: ${realProductId}`)

          // Return updated cart item with real product ID
          return {
            ...item,
            product: {
              ...item.product,
              id: realProductId
            }
          }
        }

        // Return unchanged item for existing products
        return item
      })
    )

    // Use processed cart items with real product IDs
    const finalCartItems = processedCartItems

    // Calculate totals (negative for returns)
    const baseTotal = finalCartItems.reduce((sum, item) => sum + item.total, 0)
    const totalAmount = isReturn ? -baseTotal : baseTotal
    const taxAmount = 0 // You can add tax calculation here if needed
    const discountAmount = 0 // You can add discount calculation here if needed
    const netAmount = totalAmount - discountAmount + taxAmount

    // Generate unique invoice number using database sequence (atomic operation)
    // @ts-ignore - function exists in database but not in generated types
    const { data: seqData, error: seqError } = await supabase.rpc('get_next_purchase_invoice_number' as any)
    if (seqError) {
      console.error('Error generating purchase invoice number:', seqError)
      throw new Error('فشل في توليد رقم فاتورة الشراء')
    }
    const invoiceNumber = seqData as string

    // Get current time
    const now = new Date()
    const timeString = now.toTimeString().split(' ')[0] // HH:MM:SS format

    // Determine location IDs based on warehouse selection
    const branchId = selections.warehouse.locationType === 'branch' ? selections.warehouse.id : null
    const warehouseId = selections.warehouse.locationType === 'warehouse' ? selections.warehouse.id : null

    // Build invoice data for atomic RPC
    const invoiceData = {
      invoice_number: invoiceNumber,
      supplier_id: selections.supplier.id,
      invoice_date: now.toISOString().split('T')[0],
      total_amount: totalAmount,
      tax_amount: taxAmount,
      discount_amount: discountAmount,
      net_amount: netAmount,
      payment_status: 'pending',
      notes: hasNoSafe ? `${notes || ''} [بدون خزنة]`.trim() : (notes || null),
      branch_id: branchId,
      warehouse_id: warehouseId,
      record_id: hasNoSafe ? null : selections.record.id,
      time: timeString,
      invoice_type: isReturn ? 'Purchase Return' : 'Purchase Invoice',
      is_active: true
    }

    // Build items array for atomic RPC
    const purchaseItems = finalCartItems.map(item => ({
      product_id: item.product.id,
      quantity: item.quantity,
      unit_purchase_price: item.price,
      total_price: item.total,
      discount_amount: 0,
      tax_amount: 0,
      notes: item.selectedColors ? `الألوان: ${Object.entries(item.selectedColors).map(([color, qty]) => `${color} (${qty})`).join(', ')}` : 'غير محدد - وضع الشراء'
    }))

    // Atomic insert: invoice + items in a single transaction
    // @ts-ignore - function exists in database but not in generated types
    const { data: rpcResult, error: rpcError } = await supabase.rpc(
      'create_purchase_invoice_with_items' as any,
      { p_invoice_data: invoiceData, p_items: purchaseItems }
    )

    if (rpcError) {
      throw new Error(`خطأ في إنشاء فاتورة الشراء: ${rpcError.message}`)
    }

    const purchaseData = rpcResult as { id: string; invoice_number: string }

    // NOTE: Removed the logic that creates a copy in the main record
    // Now purchase invoices only appear in the explicitly selected safe
    // If "no safe" is selected (hasNoSafe = true), record_id will be null and won't appear in any safe

    // Update inventory quantities atomically (increase for purchases)
    // Track pre-update quantities for cost calculation (Bug 7 fix)
    const preUpdateQuantities = new Map<string, number>()

    for (const item of finalCartItems) {
      // Read current quantity BEFORE atomic update (for cost calculation)
      const { data: preInventory } = await supabase
        .from('inventory')
        .select('quantity')
        .eq('product_id', item.product.id)

      const currentTotal = preInventory?.reduce((sum, inv) => sum + (inv.quantity || 0), 0) || 0
      preUpdateQuantities.set(item.product.id, currentTotal)

      // For returns, subtract; for purchases, add
      const quantityChange = isReturn ? -item.quantity : item.quantity

      // Atomic update: quantity = quantity + change (no read-modify-write race)
      const { error: invError } = await supabase.rpc(
        'atomic_adjust_inventory' as any,
        {
          p_product_id: item.product.id,
          p_branch_id: branchId,
          p_warehouse_id: warehouseId,
          p_change: quantityChange,
          p_allow_negative: true
        }
      )

      if (invError) {
        console.warn(`Failed to update inventory for product ${item.product.id}:`, invError.message)
      }

      // In purchase mode, we store quantities as "unspecified" variant
      // Only track variant quantities for branches (not warehouses)
      if (branchId) {
        // First, check if an "غير محدد" definition exists for this product
        const { data: unspecifiedDef, error: defError } = await supabase
          .from('product_color_shape_definitions')
          .select('id')
          .eq('product_id', item.product.id)
          .eq('name', 'غير محدد')
          .eq('variant_type', 'color')
          .single()

        let unspecifiedDefId: string

        if (defError || !unspecifiedDef) {
          // Create the "غير محدد" definition if it doesn't exist
          const { data: newDef, error: createDefError } = await supabase
            .from('product_color_shape_definitions')
            .insert({
              product_id: item.product.id,
              variant_type: 'color',
              name: 'غير محدد',
              color_hex: '#6B7280',
              sort_order: 9999
            })
            .select('id')
            .single()

          if (createDefError || !newDef) {
            console.warn(`Failed to create unspecified definition for product ${item.product.id}:`, createDefError?.message)
            continue
          }
          unspecifiedDefId = newDef.id
        } else {
          unspecifiedDefId = unspecifiedDef.id
        }

        const variantQuantityChange = isReturn ? -item.quantity : item.quantity

        const { error: qtyUpsertError } = await supabase.rpc(
          'atomic_adjust_variant_quantity' as any,
          {
            p_variant_definition_id: unspecifiedDefId,
            p_branch_id: branchId,
            p_change: variantQuantityChange,
            p_allow_negative: true
          }
        )

        if (qtyUpsertError) {
          console.warn(`Failed to upsert quantity for unspecified variant:`, qtyUpsertError.message)
        }
      }
    }

    // Update product costs using weighted average cost method
    // Track failures to return as warnings (Bug 6 fix)
    console.log('🔄 Updating product costs after purchase...')
    const costUpdateWarnings: string[] = []
    for (const item of finalCartItems) {
      try {
        if (isReturn) {
          // مرتجع شراء: لا نغيّر التكلفة - المرتجع ينقّص المخزون فقط
          // المتوسط المرجح لا يتأثر بالمرتجعات (محاسبياً)
          console.log(`⏭️ Skipping cost update for return - product ${item.product.id}`)
          continue
        } else {
          // شراء عادي: حساب المتوسط المرجح التراكمي
          const preQty = preUpdateQuantities.get(item.product.id) ?? undefined
          const costUpdate = await updateProductCostAfterPurchase(
            item.product.id,
            item.quantity,
            item.price,
            preQty
          )

          if (costUpdate) {
            console.log(`💰 Updated cost for product ${item.product.id}:`, {
              oldCost: 'calculated from previous data',
              newCost: costUpdate.newAverageCost,
              quantity: item.quantity,
              unitPrice: item.price
            })
          } else {
            const productName = item.product.name || item.product.id
            costUpdateWarnings.push(`فشل تحديث تكلفة المنتج: ${productName}`)
            console.warn(`⚠️  Failed to update cost for product ${item.product.id}`)
          }
        }
      } catch (costError: any) {
        const productName = item.product.name || item.product.id
        costUpdateWarnings.push(`خطأ في تحديث تكلفة المنتج: ${productName}`)
        console.error(`❌ Error updating cost for product ${item.product.id}:`, costError.message)
        // Don't fail the entire invoice creation if cost update fails
      }
    }

    // Track payment status
    let paymentCreated = false
    let paymentErrorMsg: string | null = null

    // Handle payment if paidAmount > 0
    if (paidAmount > 0 && !isReturn) {
      console.log('💳 Processing supplier payment:', paidAmount)

      // Log payment data for debugging
      console.log('📦 Payment data to insert:', {
        supplier_id: selections.supplier.id,
        amount: paidAmount,
        payment_method: paymentMethod,
        safe_id: hasNoSafe ? null : selections.record?.id,
        hasNoSafe,
        recordExists: !!selections.record
      })

      // Create supplier payment record
      const { error: paymentError } = await supabase
        .from('supplier_payments')
        .insert({
          supplier_id: selections.supplier.id,
          amount: paidAmount,
          payment_method: paymentMethod,
          notes: `دفعة من فاتورة رقم ${invoiceNumber}`,
          payment_date: now.toISOString().split('T')[0],
          created_by: userId || null,
          safe_id: hasNoSafe ? null : selections.record?.id,
          purchase_invoice_id: purchaseData.id
        })

      if (paymentError) {
        console.error('❌ Error creating supplier payment:', paymentError)
        paymentErrorMsg = paymentError.message
        // Don't fail the entire invoice, just log the error
      } else {
        paymentCreated = true
        console.log('✅ Supplier payment created successfully')

        // Update safe balance (deduct payment amount)
        if (!hasNoSafe && selections.record?.id) {
          // Get current balance
          const { data: safeData, error: safeGetError } = await supabase
            .from('records')
            .select('balance')
            .eq('id', selections.record.id)
            .single()

          if (!safeGetError && safeData) {
            const currentBalance = safeData.balance || 0
            const newBalance = roundMoney(currentBalance - paidAmount)

            const { error: safeUpdateError } = await supabase
              .from('records')
              .update({ balance: newBalance })
              .eq('id', selections.record.id)

            if (safeUpdateError) {
              console.error('Error updating safe balance:', safeUpdateError)
            } else {
              console.log(`✅ Safe balance updated: ${currentBalance} → ${newBalance}`)
            }
          }
        }
      }
    }

    return {
      success: true,
      invoiceId: purchaseData.id,
      invoiceNumber: invoiceNumber,
      totalAmount: totalAmount,
      paidAmount: paidAmount,
      paymentCreated: paymentCreated,
      paymentError: paymentErrorMsg,
      costUpdateWarnings: costUpdateWarnings.length > 0 ? costUpdateWarnings : undefined,
      message: costUpdateWarnings.length > 0
        ? `تم إنشاء فاتورة الشراء بنجاح، لكن فشل تحديث تكلفة ${costUpdateWarnings.length} منتج`
        : 'تم إنشاء فاتورة الشراء وتحديث تكاليف المنتجات بنجاح'
    }

  } catch (error: any) {
    throw new Error(error.message || 'حدث خطأ أثناء إنشاء فاتورة الشراء')
  }
}