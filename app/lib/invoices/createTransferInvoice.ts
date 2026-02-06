import { supabase } from '../supabase/client'

export interface TransferCartItem {
  id: string
  product: any
  quantity: number
  selectedColors?: any
  isTransfer?: boolean
}

interface CreateTransferInvoiceParams {
  cartItems: TransferCartItem[]
  transferFromLocation: {
    id: number
    name: string
    type: 'branch' | 'warehouse'
  }
  transferToLocation: {
    id: number
    name: string
    type: 'branch' | 'warehouse'
  }
  record?: {
    id: string
    name: string
  }
}

export async function createTransferInvoice({
  cartItems,
  transferFromLocation,
  transferToLocation,
  record
}: CreateTransferInvoiceParams) {
  try {
    console.log('بدء عملية النقل...')
    console.log('عناصر السلة:', cartItems)
    console.log('من:', transferFromLocation)
    console.log('إلى:', transferToLocation)

    // التحقق من وجود منتجات في السلة
    if (!cartItems || cartItems.length === 0) {
      throw new Error('لا يمكن إنشاء فاتورة نقل بدون منتجات')
    }

    // Generate transfer invoice number
    const invoiceNumber = `TR-${Date.now()}`

    // Use the passed record or get the main record
    // Check if "no safe" option was selected (record.id is null)
    const hasNoSafe = record && !record.id;
    let finalRecord = record
    let finalRecordId: string | null = null

    if (hasNoSafe) {
      // "No safe" option selected - transfer without affecting any safe
      console.log('⏭️ خيار "لا يوجد" محدد - النقل بدون تأثير على أي خزنة')
      finalRecordId = null
    } else if (!finalRecord) {
      // No record passed - get the main/primary record
      const { data: mainRecord, error: recordError } = await supabase
        .from('records')
        .select('id, name')
        .eq('is_primary', true)
        .not('name', 'ilike', '%نقل%')
        .single()

      if (recordError || !mainRecord) {
        throw new Error('فشل في العثور على الخزنة الرئيسية')
      }

      finalRecord = mainRecord
      finalRecordId = mainRecord.id
    } else {
      finalRecordId = finalRecord.id
    }

    console.log('استخدام الخزنة:', hasNoSafe ? 'لا يوجد' : finalRecord?.name)

    // Build invoice data for atomic RPC
    const transferInvoiceData = {
      invoice_number: invoiceNumber,
      invoice_date: new Date().toISOString().split('T')[0],
      supplier_id: null,
      branch_id: transferToLocation.type === 'branch' ? transferToLocation.id.toString() : null,
      warehouse_id: transferToLocation.type === 'warehouse' ? transferToLocation.id.toString() : null,
      record_id: finalRecordId,
      total_amount: 0,
      discount_amount: 0,
      tax_amount: 0,
      net_amount: 0,
      notes: hasNoSafe
        ? `[TRANSFER] نقل من ${transferFromLocation.name} إلى ${transferToLocation.name} [بدون خزنة]`
        : `[TRANSFER] نقل من ${transferFromLocation.name} إلى ${transferToLocation.name}`,
      invoice_type: 'Purchase Invoice',
      is_active: true
    }

    // Build all items array upfront for atomic insert
    const transferItems = cartItems.map(item => ({
      product_id: item.product.id,
      quantity: item.quantity,
      unit_purchase_price: 0,
      total_price: 0,
      notes: `[TRANSFER] نقل من ${transferFromLocation.name} إلى ${transferToLocation.name}`
    }))

    // Atomic insert: invoice + all items in a single transaction
    // @ts-ignore - function exists in database but not in generated types
    const { data: rpcResult, error: rpcError } = await supabase.rpc(
      'create_purchase_invoice_with_items' as any,
      { p_invoice_data: transferInvoiceData, p_items: transferItems }
    )

    if (rpcError) {
      console.error('خطأ في إنشاء فاتورة النقل:', rpcError)
      throw new Error(`خطأ في إنشاء فاتورة النقل: ${rpcError.message}`)
    }

    const transferInvoice = rpcResult as { id: string; invoice_number: string }
    console.log('تم إنشاء فاتورة النقل بنجاح:', transferInvoice)

    // Process inventory updates for each cart item
    const transferResults = []

    for (const item of cartItems) {
      console.log(`معالجة المنتج: ${item.product.name} - الكمية: ${item.quantity}`)

      // Handle inventory updates based on location types
      let inventoryUpdateResult
      
      if (transferFromLocation.type === 'branch' && transferToLocation.type === 'branch') {
        // Branch to Branch transfer - use the transfer_stock function
        console.log(`نقل بين الفروع: ${transferFromLocation.id} → ${transferToLocation.id}`)
        
        const { data, error: transferStockError } = await (supabase as any)
          .rpc('transfer_stock', {
            p_product_id: item.product.id,
            p_from_branch_id: transferFromLocation.id.toString(),
            p_to_branch_id: transferToLocation.id.toString(),
            p_quantity: item.quantity,
            p_user_id: '00000000-0000-0000-0000-000000000000' // Default user ID for system transfers
          })

        if (transferStockError) {
          console.error(`خطأ في نقل المخزون للمنتج ${item.product.name}:`, transferStockError)
          throw new Error(`خطأ في نقل المخزون للمنتج ${item.product.name}: ${transferStockError.message}`)
        }

        inventoryUpdateResult = data
        console.log(`تم نقل المخزون بنجاح للمنتج: ${item.product.name}`)
        
      } else {
        // Manual inventory updates for warehouse transfers or mixed transfers
        console.log(`نقل يشمل مخازن - تحديث يدوي للمخزون`)
        
        // Decrease inventory from source
        if (transferFromLocation.type === 'branch') {
          // Get current inventory first
          const { data: currentInventory, error: getError } = await supabase
            .from('inventory')
            .select('quantity')
            .eq('product_id', item.product.id)
            .eq('branch_id', transferFromLocation.id.toString())
            .single()

          if (getError || !currentInventory) {
            console.error(`خطأ في الحصول على المخزون الحالي للمنتج ${item.product.name}:`, getError)
            throw new Error(`خطأ في الحصول على المخزون الحالي للمنتج ${item.product.name}`)
          }

          const newQuantity = Math.max(0, currentInventory.quantity - item.quantity)

          const { error: decreaseError } = await supabase
            .from('inventory')
            .update({ 
              quantity: newQuantity,
              last_updated: new Date().toISOString()
            })
            .eq('product_id', item.product.id)
            .eq('branch_id', transferFromLocation.id.toString())

          if (decreaseError) {
            console.error(`خطأ في تقليل المخزون من الفرع للمنتج ${item.product.name}:`, decreaseError)
            throw new Error(`خطأ في تقليل المخزون من الفرع للمنتج ${item.product.name}`)
          }
        }

        // Increase inventory at destination
        if (transferToLocation.type === 'branch') {
          // Check if inventory record exists
          const { data: existingInventory } = await supabase
            .from('inventory')
            .select('*')
            .eq('product_id', item.product.id)
            .eq('branch_id', transferToLocation.id.toString())
            .single()

          if (existingInventory) {
            // Update existing record
            const newQuantity = existingInventory.quantity + item.quantity
            const { error: increaseError } = await supabase
              .from('inventory')
              .update({ 
                quantity: newQuantity,
                last_updated: new Date().toISOString()
              })
              .eq('product_id', item.product.id)
              .eq('branch_id', transferToLocation.id.toString())

            if (increaseError) {
              console.error(`خطأ في زيادة المخزون في الفرع للمنتج ${item.product.name}:`, increaseError)
              throw new Error(`خطأ في زيادة المخزون في الفرع للمنتج ${item.product.name}`)
            }
          } else {
            // Create new inventory record
            const { error: createError } = await supabase
              .from('inventory')
              .insert({
                product_id: item.product.id,
                branch_id: transferToLocation.id.toString(),
                quantity: item.quantity,
                min_stock: 0,
                last_updated: new Date().toISOString()
              })

            if (createError) {
              console.error(`خطأ في إنشاء سجل مخزون جديد للمنتج ${item.product.name}:`, createError)
              throw new Error(`خطأ في إنشاء سجل مخزون جديد للمنتج ${item.product.name}`)
            }
          }
        }

        inventoryUpdateResult = true
      }

      transferResults.push({
        product: item.product,
        quantity: item.quantity,
        transferItemId: transferInvoice.id,
        inventoryUpdated: inventoryUpdateResult
      })
    }

    console.log('تم إنجاز عملية النقل بنجاح!')
    console.log('نتائج النقل:', transferResults)

    return {
      success: true,
      invoiceNumber,
      recordId: finalRecordId,
      invoiceId: transferInvoice.id,
      transferResults,
      message: `تم إنشاء فاتورة النقل ${invoiceNumber} بنجاح ونقل ${cartItems.length} منتج من ${transferFromLocation.name} إلى ${transferToLocation.name}`
    }

  } catch (error: any) {
    console.error('Error creating transfer invoice:', error)
    throw new Error(error.message || 'حدث خطأ أثناء إنشاء فاتورة النقل')
  }
}