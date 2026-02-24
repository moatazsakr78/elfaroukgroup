'use client'

import { supabase } from '../supabase/client'
import { roundMoney } from '../utils/money'

export interface CancelSalesInvoiceParams {
  saleId: string
  userId?: string | null
  userName?: string | null
}

export interface CancelSalesInvoiceResult {
  success: boolean
  message: string
}

/**
 * Parse variant entries from sale_items.notes field
 * Format: "الألوان المحددة: أحمر: 2, أزرق: 1 | الأشكال المحددة: دائري: 3"
 */
function parseVariantsFromNotes(notes: string): {
  colors: Record<string, number>
  shapes: Record<string, number>
} {
  const colors: Record<string, number> = {}
  const shapes: Record<string, number> = {}

  if (!notes) return { colors, shapes }

  const parts = notes.split(' | ')
  for (const part of parts) {
    const isColor = part.startsWith('الألوان المحددة:')
    const isShape = part.startsWith('الأشكال المحددة:')

    if (!isColor && !isShape) continue

    const target = isColor ? colors : shapes
    const prefix = isColor ? 'الألوان المحددة:' : 'الأشكال المحددة:'
    const entriesStr = part.replace(prefix, '').trim()

    // Parse "أحمر: 2, أزرق: 1"
    const entries = entriesStr.split(',').map(e => e.trim()).filter(Boolean)
    for (const entry of entries) {
      const lastColon = entry.lastIndexOf(':')
      if (lastColon === -1) continue
      const name = entry.substring(0, lastColon).trim()
      const qty = parseInt(entry.substring(lastColon + 1).trim(), 10)
      if (name && !isNaN(qty) && qty > 0) {
        target[name] = qty
      }
    }
  }

  return { colors, shapes }
}

/**
 * Restore variant inventory for a single variant type
 */
async function restoreVariantInventory(
  productId: string,
  branchId: string,
  variants: Record<string, number>,
  variantType: 'color' | 'shape',
  quantity: number
) {
  // quantity > 0 means it was a sale (need to add back), < 0 means return (need to subtract back)
  const isReturn = quantity < 0

  for (const [variantName, variantQty] of Object.entries(variants)) {
    try {
      const { data: variantDefinition, error: defError } = await supabase
        .from('product_color_shape_definitions')
        .select('id')
        .eq('product_id', productId)
        .eq('name', variantName)
        .eq('variant_type', variantType)
        .single()

      if (defError || !variantDefinition) {
        console.warn(`Failed to get variant definition for product ${productId}, ${variantType} ${variantName}:`, defError?.message)
        continue
      }

      // For sales (qty > 0): we subtracted at creation, so add back (+variantQty)
      // For returns (qty < 0): we added at creation, so subtract back (-variantQty)
      const change = isReturn ? -variantQty : variantQty

      const { error: qtyUpdateError } = await supabase.rpc(
        'atomic_adjust_variant_quantity' as any,
        {
          p_variant_definition_id: variantDefinition.id,
          p_branch_id: branchId,
          p_change: change,
          p_allow_negative: true
        }
      )

      if (qtyUpdateError) {
        console.warn(`Failed to restore variant quantity for ${variantType} ${variantName}:`, qtyUpdateError.message)
      }
    } catch (err) {
      console.warn(`Error restoring variant for product ${productId}, ${variantType} ${variantName}:`, err)
    }
  }
}

export async function cancelSalesInvoice({
  saleId,
  userId = null,
  userName = null
}: CancelSalesInvoiceParams): Promise<CancelSalesInvoiceResult> {
  if (!saleId) {
    return { success: false, message: 'معرف الفاتورة مطلوب' }
  }

  try {
    // 1. Fetch the sale and verify it's not already cancelled
    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .select('*')
      .eq('id', saleId)
      .single()

    if (saleError || !sale) {
      return { success: false, message: 'لم يتم العثور على الفاتورة' }
    }

    if (sale.status === 'cancelled') {
      return { success: false, message: 'هذه الفاتورة ملغاة بالفعل' }
    }

    // 2. Fetch sale items
    const { data: saleItems, error: itemsError } = await supabase
      .from('sale_items')
      .select('id, product_id, quantity, notes, branch_id')
      .eq('sale_id', saleId)

    if (itemsError) {
      console.error('Error fetching sale items:', itemsError)
      return { success: false, message: 'خطأ في جلب عناصر الفاتورة' }
    }

    // 3. Restore inventory for each item
    const inventoryPromises = (saleItems || []).map(async (item) => {
      try {
        const branchId = item.branch_id || sale.branch_id

        // quantity is positive for sales, negative for returns
        // To reverse: add back what was subtracted (or subtract what was added)
        // For sale (qty > 0): inventory was reduced by qty, so add +qty
        // For return (qty < 0): inventory was increased by |qty|, so add qty (which is negative = subtract)
        const quantityChange = item.quantity

        const { error: invError } = await supabase.rpc(
          'atomic_adjust_inventory' as any,
          {
            p_product_id: item.product_id,
            p_branch_id: branchId,
            p_warehouse_id: null,
            p_change: quantityChange,
            p_allow_negative: true
          }
        )

        if (invError) {
          console.warn(`Failed to restore inventory for product ${item.product_id}:`, invError.message)
        }
      } catch (err) {
        console.warn(`Error restoring inventory for product ${item.product_id}:`, err)
      }
    })

    // 4. Restore variant quantities
    const variantPromises = (saleItems || [])
      .filter(item => item.notes)
      .flatMap(item => {
        const branchId = item.branch_id || sale.branch_id
        const { colors, shapes } = parseVariantsFromNotes(item.notes)
        const promises: Promise<void>[] = []

        if (Object.keys(colors).length > 0) {
          promises.push(restoreVariantInventory(item.product_id, branchId, colors, 'color', item.quantity))
        }
        if (Object.keys(shapes).length > 0) {
          promises.push(restoreVariantInventory(item.product_id, branchId, shapes, 'shape', item.quantity))
        }

        return promises
      })

    await Promise.all([...inventoryPromises, ...variantPromises])

    // 5. Reverse cash drawer transactions
    const { data: drawerTransactions, error: transError } = await supabase
      .from('cash_drawer_transactions')
      .select('id, drawer_id, amount, record_id')
      .eq('sale_id', saleId)

    if (!transError && drawerTransactions && drawerTransactions.length > 0) {
      for (const transaction of drawerTransactions) {
        const { data: drawer } = await supabase
          .from('cash_drawers')
          .select('id, current_balance')
          .eq('id', transaction.drawer_id)
          .single()

        if (drawer) {
          const newBalance = roundMoney((drawer.current_balance || 0) - transaction.amount)

          await supabase
            .from('cash_drawers')
            .update({
              current_balance: newBalance,
              updated_at: new Date().toISOString()
            })
            .eq('id', drawer.id)

          // Add cancellation record
          await supabase
            .from('cash_drawer_transactions')
            .insert({
              drawer_id: drawer.id,
              record_id: transaction.record_id,
              transaction_type: 'invoice_cancel',
              amount: -transaction.amount,
              balance_after: newBalance,
              sale_id: saleId,
              notes: `إلغاء فاتورة رقم ${sale.invoice_number}`,
              performed_by: userId || 'system'
            })

          console.log(`✅ Cash drawer reversed for cancel: ${-transaction.amount}, new balance: ${newBalance}`)
        }
      }

      // Delete original transactions (keep the cancellation records)
      await supabase
        .from('cash_drawer_transactions')
        .delete()
        .eq('sale_id', saleId)
        .neq('transaction_type', 'invoice_cancel')
    }

    // 6. Delete customer payments linked to this invoice
    const { error: paymentsError } = await supabase
      .from('customer_payments')
      .delete()
      .eq('sale_id', saleId)

    if (paymentsError) {
      // Try by invoice number as fallback
      await supabase
        .from('customer_payments')
        .delete()
        .ilike('notes', `%${sale.invoice_number}%`)
    }

    // 7. Mark the sale as cancelled + record in update_history
    const updateHistory: any[] = Array.isArray(sale.update_history) ? [...sale.update_history] : []
    updateHistory.push({
      timestamp: new Date().toISOString(),
      user_id: userId,
      user_name: userName,
      action: 'cancel',
      field: 'status',
      old_value: 'active',
      new_value: 'cancelled'
    })

    const { error: updateError } = await supabase
      .from('sales')
      .update({
        status: 'cancelled',
        is_updated: true,
        update_history: updateHistory
      })
      .eq('id', saleId)

    if (updateError) {
      console.error('Error updating sale status:', updateError)
      return { success: false, message: `خطأ في تحديث حالة الفاتورة: ${updateError.message}` }
    }

    console.log('✅ Invoice cancelled successfully:', saleId)

    return {
      success: true,
      message: 'تم إلغاء الفاتورة بنجاح وإرجاع المخزون'
    }

  } catch (error: any) {
    console.error('Error in cancelSalesInvoice:', error)
    return {
      success: false,
      message: error.message || 'حدث خطأ أثناء إلغاء الفاتورة'
    }
  }
}
