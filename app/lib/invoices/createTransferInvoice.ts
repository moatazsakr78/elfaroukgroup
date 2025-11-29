import { supabase } from '../supabase/client'
import { getTransferRecordId, ensureTransferRecordExists } from '../utils/transfer-record-manager'

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
    
    // Ensure transfer record exists and get its ID
    await ensureTransferRecordExists()
    const transferRecordId = await getTransferRecordId()
    
    if (!transferRecordId) {
      throw new Error('فشل في إنشاء أو العثور على سجل النقل')
    }

    // Always use the transfer record for transfer invoices, regardless of selected record
    const finalRecord = { 
      id: transferRecordId, 
      name: 'سجل النقل' 
    }

    console.log('استخدام سجل النقل الافتراضي:', finalRecord)

    // Create transfer invoice in purchase_invoices table (we'll use it for transfer invoices too)
    const { data: transferInvoice, error: invoiceError } = await supabase
      .from('purchase_invoices')
      .insert({
        invoice_number: invoiceNumber,
        invoice_date: new Date().toISOString(),
        supplier_id: null, // No supplier for transfers
        branch_id: transferToLocation.type === 'branch' ? transferToLocation.id.toString() : null,
        warehouse_id: transferToLocation.type === 'warehouse' ? transferToLocation.id.toString() : null,
        record_id: finalRecord.id,
        total_amount: 0, // Transfers have no monetary value
        discount_amount: 0,
        tax_amount: 0,
        net_amount: 0,
        notes: `[TRANSFER] نقل من ${transferFromLocation.name} إلى ${transferToLocation.name}`,
        invoice_type: 'Purchase Invoice', // We'll identify transfers by the [TRANSFER] prefix in notes
        is_active: true
      })
      .select()
      .single()

    if (invoiceError) {
      console.error('خطأ في إنشاء فاتورة النقل:', invoiceError)
      throw new Error(`خطأ في إنشاء فاتورة النقل: ${invoiceError.message}`)
    }

    console.log('تم إنشاء فاتورة النقل بنجاح:', transferInvoice)

    // Process each cart item
    const transferResults = []
    
    for (const item of cartItems) {
      console.log(`معالجة المنتج: ${item.product.name} - الكمية: ${item.quantity}`)
      
      // Create transfer item record
      const { data: transferItem, error: itemError } = await supabase
        .from('purchase_invoice_items')
        .insert({
          purchase_invoice_id: transferInvoice.id,
          product_id: item.product.id,
          quantity: item.quantity,
          unit_purchase_price: 0, // No cost in transfers
          total_price: 0,
          notes: `[TRANSFER] نقل من ${transferFromLocation.name} إلى ${transferToLocation.name}`
        })
        .select()
        .single()

      if (itemError) {
        console.error(`خطأ في إنشاء عنصر النقل للمنتج ${item.product.name}:`, itemError)
        throw new Error(`خطأ في إنشاء عنصر النقل للمنتج ${item.product.name}: ${itemError.message}`)
      }

      console.log(`تم إنشاء عنصر النقل بنجاح للمنتج: ${item.product.name}`)

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
        transferItemId: transferItem.id,
        inventoryUpdated: inventoryUpdateResult
      })
    }

    console.log('تم إنجاز عملية النقل بنجاح!')
    console.log('نتائج النقل:', transferResults)

    return {
      success: true,
      invoiceNumber,
      recordId: finalRecord.id,
      invoiceId: transferInvoice.id,
      transferResults,
      message: `تم إنشاء فاتورة النقل ${invoiceNumber} بنجاح ونقل ${cartItems.length} منتج من ${transferFromLocation.name} إلى ${transferToLocation.name}`
    }

  } catch (error: any) {
    console.error('Error creating transfer invoice:', error)
    throw new Error(error.message || 'حدث خطأ أثناء إنشاء فاتورة النقل')
  }
}