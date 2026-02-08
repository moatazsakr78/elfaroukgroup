'use client'

import { supabase } from '../supabase/client'
import { roundMoney } from '../utils/money'

export interface UpdateSalesInvoiceParams {
  saleId: string
  newRecordId?: string | null      // الخزنة الجديدة (null = "لا يوجد")
  newCustomerId?: string | null    // العميل الجديد
  newBranchId?: string | null      // الفرع الجديد
  userId?: string | null
  userName?: string | null
}

export interface UpdateSalesInvoiceResult {
  success: boolean
  message: string
  changes?: {
    record?: { old: string | null, new: string | null }
    customer?: { old: string | null, new: string | null }
    branch?: { old: string | null, new: string | null }
  }
}

export async function updateSalesInvoice({
  saleId,
  newRecordId,
  newCustomerId,
  newBranchId,
  userId = null,
  userName = null
}: UpdateSalesInvoiceParams): Promise<UpdateSalesInvoiceResult> {
  if (!saleId) {
    return { success: false, message: 'معرف الفاتورة مطلوب' }
  }

  try {
    // 1. جلب بيانات الفاتورة الحالية
    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .select('*')
      .eq('id', saleId)
      .single()

    if (saleError || !sale) {
      return { success: false, message: 'لم يتم العثور على الفاتورة' }
    }

    // 2. جلب سجل المعاملة الحالية
    const { data: transaction, error: txError } = await supabase
      .from('cash_drawer_transactions')
      .select('*')
      .eq('sale_id', saleId)
      .single()

    if (txError && txError.code !== 'PGRST116') {
      console.warn('Error fetching transaction:', txError)
    }

    const transactionAmount = transaction?.amount || sale.total_amount || 0

    // تتبع التغييرات
    const changes: UpdateSalesInvoiceResult['changes'] = {}
    const updateHistory: any[] = Array.isArray(sale.update_history) ? sale.update_history : []

    // استخدام record_id من الـ transaction كمصدر الحقيقة (لأنه قد يختلف عن sales.record_id)
    // هذا يحل مشكلة عدم تطابق البيانات بين الجدولين
    const actualCurrentRecordId = transaction?.record_id ?? sale.record_id

    // 3. تعديل الخزنة (إذا تم تغييرها)
    if (newRecordId !== undefined && newRecordId !== actualCurrentRecordId) {
      const oldRecordId = actualCurrentRecordId

      // إذا كانت الخزنة القديمة موجودة (ليست null) - خصم المبلغ
      if (oldRecordId) {
        const { data: oldDrawer } = await supabase
          .from('cash_drawers')
          .select('*')
          .eq('record_id', oldRecordId)
          .single()

        if (oldDrawer) {
          const newOldBalance = roundMoney((oldDrawer.current_balance || 0) - transactionAmount)
          await supabase
            .from('cash_drawers')
            .update({
              current_balance: newOldBalance,
              updated_at: new Date().toISOString()
            })
            .eq('id', oldDrawer.id)

          console.log(`✅ خصم ${transactionAmount} من الخزنة القديمة، الرصيد الجديد: ${newOldBalance}`)
        }
      }

      // إذا كانت الخزنة الجديدة موجودة (ليست null) - إضافة المبلغ
      let newDrawer: any = null
      let newBalance: number | null = null

      if (newRecordId) {
        // جلب أو إنشاء درج للخزنة الجديدة
        const { data: existingDrawer, error: drawerError } = await supabase
          .from('cash_drawers')
          .select('*')
          .eq('record_id', newRecordId)
          .single()

        if (drawerError && drawerError.code === 'PGRST116') {
          // إنشاء درج جديد
          const { data: createdDrawer } = await supabase
            .from('cash_drawers')
            .insert({ record_id: newRecordId, current_balance: 0 })
            .select()
            .single()
          newDrawer = createdDrawer
        } else {
          newDrawer = existingDrawer
        }

        if (newDrawer) {
          newBalance = roundMoney((newDrawer.current_balance || 0) + transactionAmount)
          await supabase
            .from('cash_drawers')
            .update({
              current_balance: newBalance,
              updated_at: new Date().toISOString()
            })
            .eq('id', newDrawer.id)

          console.log(`✅ إضافة ${transactionAmount} للخزنة الجديدة، الرصيد الجديد: ${newBalance}`)
        }
      }

      // تحديث سجل المعاملة
      if (transaction) {
        // عند التغيير إلى "لا يوجد" (null) يجب تعيين القيم إلى null وليس undefined
        const txUpdate: any = {}

        if (newRecordId === null) {
          // التغيير إلى "لا يوجد" - تعيين كل القيم إلى null
          txUpdate.record_id = null
          txUpdate.drawer_id = null
          txUpdate.balance_after = null
        } else if (newRecordId) {
          // التغيير إلى خزنة محددة
          txUpdate.record_id = newRecordId
          txUpdate.drawer_id = newDrawer?.id || null
          txUpdate.balance_after = newBalance
        }

        if (Object.keys(txUpdate).length > 0) {
          await supabase
            .from('cash_drawer_transactions')
            .update(txUpdate)
            .eq('id', transaction.id)
        }
      }

      changes.record = {
        old: oldRecordId,
        new: newRecordId
      }

      // تسجيل في سجل التعديلات
      updateHistory.push({
        timestamp: new Date().toISOString(),
        user_id: userId,
        user_name: userName,
        field: 'record_id',
        old_value: oldRecordId,
        new_value: newRecordId
      })
    }

    // 4. تعديل العميل (إذا تم تغييره)
    if (newCustomerId !== undefined && newCustomerId !== sale.customer_id) {
      changes.customer = {
        old: sale.customer_id,
        new: newCustomerId
      }

      updateHistory.push({
        timestamp: new Date().toISOString(),
        user_id: userId,
        user_name: userName,
        field: 'customer_id',
        old_value: sale.customer_id,
        new_value: newCustomerId
      })
    }

    // 5. تعديل الفرع (إذا تم تغييره)
    if (newBranchId !== undefined && newBranchId !== sale.branch_id) {
      changes.branch = {
        old: sale.branch_id,
        new: newBranchId
      }

      updateHistory.push({
        timestamp: new Date().toISOString(),
        user_id: userId,
        user_name: userName,
        field: 'branch_id',
        old_value: sale.branch_id,
        new_value: newBranchId
      })
    }

    // 6. تحديث الفاتورة في جدول sales
    const updateData: any = {
      is_updated: true,
      update_history: updateHistory
    }

    if (newRecordId !== undefined) {
      updateData.record_id = newRecordId || null
    }
    if (newCustomerId !== undefined) {
      updateData.customer_id = newCustomerId
    }
    if (newBranchId !== undefined) {
      updateData.branch_id = newBranchId
    }

    const { error: updateError } = await supabase
      .from('sales')
      .update(updateData)
      .eq('id', saleId)

    if (updateError) {
      console.error('Error updating sale:', updateError)
      return { success: false, message: `خطأ في تحديث الفاتورة: ${updateError.message}` }
    }

    console.log('✅ تم تحديث الفاتورة بنجاح', { saleId, changes })

    return {
      success: true,
      message: 'تم تحديث الفاتورة بنجاح',
      changes
    }

  } catch (error: any) {
    console.error('Error in updateSalesInvoice:', error)
    return {
      success: false,
      message: error.message || 'حدث خطأ أثناء تحديث الفاتورة'
    }
  }
}

// دالة مساعدة لجلب معلومات الفاتورة الكاملة
export async function getSaleDetails(saleId: string) {
  const { data: sale, error: saleError } = await supabase
    .from('sales')
    .select(`
      *,
      customer:customers(id, name, phone),
      branch:branches(id, name),
      record:records(id, name)
    `)
    .eq('id', saleId)
    .single()

  if (saleError) {
    console.error('Error fetching sale details:', saleError)
    return null
  }

  return sale
}
