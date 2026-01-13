/**
 * خدمة ربط العميل بالمورد والمورد بالعميل
 * Party Linking Service - Link Customer to Supplier and vice versa
 *
 * هذه الخدمة تتيح:
 * - ربط عميل موجود بمورد موجود
 * - إنشاء عميل تلقائياً عند البيع لمورد
 * - إنشاء مورد تلقائياً عند الشراء من عميل
 */

import { supabase } from '../supabase/client';

// Types
export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  company_name: string | null;
  contact_person: string | null;
  tax_id: string | null;
  account_balance: number | null;
  credit_limit: number | null;
  category: string | null;
  rank: string | null;
  notes: string | null;
  is_active: boolean | null;
  opening_balance?: number | null;
  linked_supplier_id?: string | null;
}

export interface Supplier {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  company_name: string | null;
  contact_person: string | null;
  tax_id: string | null;
  account_balance: number | null;
  credit_limit: number | null;
  category: string | null;
  rank: string | null;
  notes: string | null;
  is_active: boolean | null;
  opening_balance?: number | null;
  linked_customer_id?: string | null;
}

export interface LinkResult {
  success: boolean;
  error?: string;
}

export interface GetOrCreateResult {
  success: boolean;
  id: string;
  isNew: boolean;
  error?: string;
}

/**
 * ربط عميل موجود بمورد موجود
 * Links an existing customer to an existing supplier (bidirectional)
 */
export async function linkCustomerToSupplier(customerId: string, supplierId: string): Promise<LinkResult> {
  try {
    // Validate both exist
    const [customerCheck, supplierCheck] = await Promise.all([
      supabase.from('customers').select('id, linked_supplier_id').eq('id', customerId).single(),
      supabase.from('suppliers').select('id, linked_customer_id').eq('id', supplierId).single()
    ]);

    if (customerCheck.error || !customerCheck.data) {
      return { success: false, error: 'لم يتم العثور على العميل' };
    }

    if (supplierCheck.error || !supplierCheck.data) {
      return { success: false, error: 'لم يتم العثور على المورد' };
    }

    // Check if already linked to different parties
    if (customerCheck.data.linked_supplier_id && customerCheck.data.linked_supplier_id !== supplierId) {
      return { success: false, error: 'العميل مرتبط بمورد آخر بالفعل' };
    }

    if (supplierCheck.data.linked_customer_id && supplierCheck.data.linked_customer_id !== customerId) {
      return { success: false, error: 'المورد مرتبط بعميل آخر بالفعل' };
    }

    // Update both records
    const [customerUpdate, supplierUpdate] = await Promise.all([
      supabase.from('customers').update({ linked_supplier_id: supplierId }).eq('id', customerId),
      supabase.from('suppliers').update({ linked_customer_id: customerId }).eq('id', supplierId)
    ]);

    if (customerUpdate.error) {
      return { success: false, error: customerUpdate.error.message };
    }

    if (supplierUpdate.error) {
      // Rollback customer update
      await supabase.from('customers').update({ linked_supplier_id: null }).eq('id', customerId);
      return { success: false, error: supplierUpdate.error.message };
    }

    return { success: true };

  } catch (error: any) {
    return { success: false, error: error.message || 'حدث خطأ غير متوقع' };
  }
}

/**
 * ربط مورد موجود بعميل موجود
 * Links an existing supplier to an existing customer (bidirectional)
 */
export async function linkSupplierToCustomer(supplierId: string, customerId: string): Promise<LinkResult> {
  return linkCustomerToSupplier(customerId, supplierId);
}

/**
 * فك ربط العميل والمورد
 * Unlinks a customer and supplier
 */
export async function unlinkParties(customerId: string, supplierId: string): Promise<LinkResult> {
  try {
    const [customerUpdate, supplierUpdate] = await Promise.all([
      supabase.from('customers').update({ linked_supplier_id: null }).eq('id', customerId),
      supabase.from('suppliers').update({ linked_customer_id: null }).eq('id', supplierId)
    ]);

    if (customerUpdate.error || supplierUpdate.error) {
      return { success: false, error: customerUpdate.error?.message || supplierUpdate.error?.message };
    }

    return { success: true };

  } catch (error: any) {
    return { success: false, error: error.message || 'حدث خطأ غير متوقع' };
  }
}

/**
 * جلب أو إنشاء عميل للمورد
 * Gets the linked customer for a supplier, or creates one if not exists
 * يستخدم عند البيع لمورد
 */
export async function getOrCreateCustomerForSupplier(supplierId: string): Promise<GetOrCreateResult> {
  try {
    // 1. Get supplier data including linked_customer_id
    const { data: supplier, error: fetchError } = await supabase
      .from('suppliers')
      .select('*')
      .eq('id', supplierId)
      .single();

    if (fetchError || !supplier) {
      return { success: false, id: '', isNew: false, error: fetchError?.message || 'لم يتم العثور على المورد' };
    }

    // 2. If already linked, return the linked customer
    if (supplier.linked_customer_id) {
      // Verify the customer exists and is active
      const { data: linkedCustomer, error: customerError } = await supabase
        .from('customers')
        .select('id, is_active')
        .eq('id', supplier.linked_customer_id)
        .single();

      if (!customerError && linkedCustomer && linkedCustomer.is_active !== false) {
        return { success: true, id: supplier.linked_customer_id, isNew: false };
      }
      // If linked customer doesn't exist or is inactive, we'll create a new one
    }

    // 3. Create new customer with supplier's data
    const customerData = {
      name: supplier.name,
      phone: supplier.phone,
      email: supplier.email,
      address: supplier.address,
      city: supplier.city,
      country: supplier.country,
      company_name: supplier.company_name,
      contact_person: supplier.contact_person,
      tax_id: supplier.tax_id,
      credit_limit: supplier.credit_limit,
      category: supplier.category,
      rank: supplier.rank,
      notes: `عميل مرتبط بالمورد: ${supplier.name}`,
      is_active: true,
      loyalty_points: 0,
      opening_balance: 0,
      account_balance: 0,
      linked_supplier_id: supplierId
    };

    const { data: newCustomer, error: insertError } = await supabase
      .from('customers')
      .insert(customerData)
      .select('id')
      .single();

    if (insertError || !newCustomer) {
      return { success: false, id: '', isNew: false, error: insertError?.message || 'فشل في إنشاء سجل العميل' };
    }

    // 4. Update supplier to link to the new customer
    const { error: updateError } = await supabase
      .from('suppliers')
      .update({ linked_customer_id: newCustomer.id })
      .eq('id', supplierId);

    if (updateError) {
      // Rollback - delete the customer
      await supabase.from('customers').delete().eq('id', newCustomer.id);
      return { success: false, id: '', isNew: false, error: updateError.message };
    }

    return { success: true, id: newCustomer.id, isNew: true };

  } catch (error: any) {
    return { success: false, id: '', isNew: false, error: error.message || 'حدث خطأ غير متوقع' };
  }
}

/**
 * جلب أو إنشاء مورد للعميل
 * Gets the linked supplier for a customer, or creates one if not exists
 * يستخدم عند الشراء من عميل
 */
export async function getOrCreateSupplierForCustomer(customerId: string): Promise<GetOrCreateResult> {
  try {
    // 1. Get customer data including linked_supplier_id
    const { data: customer, error: fetchError } = await supabase
      .from('customers')
      .select('*')
      .eq('id', customerId)
      .single();

    if (fetchError || !customer) {
      return { success: false, id: '', isNew: false, error: fetchError?.message || 'لم يتم العثور على العميل' };
    }

    // 2. If already linked, return the linked supplier
    if (customer.linked_supplier_id) {
      // Verify the supplier exists and is active
      const { data: linkedSupplier, error: supplierError } = await supabase
        .from('suppliers')
        .select('id, is_active')
        .eq('id', customer.linked_supplier_id)
        .single();

      if (!supplierError && linkedSupplier && linkedSupplier.is_active !== false) {
        return { success: true, id: customer.linked_supplier_id, isNew: false };
      }
      // If linked supplier doesn't exist or is inactive, we'll create a new one
    }

    // 3. Create new supplier with customer's data
    const supplierData = {
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      address: customer.address,
      city: customer.city,
      country: customer.country,
      company_name: customer.company_name,
      contact_person: customer.contact_person,
      tax_id: customer.tax_id,
      credit_limit: customer.credit_limit,
      category: customer.category,
      rank: customer.rank,
      notes: `مورد مرتبط بالعميل: ${customer.name}`,
      is_active: true,
      opening_balance: 0,
      account_balance: 0,
      linked_customer_id: customerId
    };

    const { data: newSupplier, error: insertError } = await supabase
      .from('suppliers')
      .insert(supplierData)
      .select('id')
      .single();

    if (insertError || !newSupplier) {
      return { success: false, id: '', isNew: false, error: insertError?.message || 'فشل في إنشاء سجل المورد' };
    }

    // 4. Update customer to link to the new supplier
    const { error: updateError } = await supabase
      .from('customers')
      .update({ linked_supplier_id: newSupplier.id })
      .eq('id', customerId);

    if (updateError) {
      // Rollback - delete the supplier
      await supabase.from('suppliers').delete().eq('id', newSupplier.id);
      return { success: false, id: '', isNew: false, error: updateError.message };
    }

    return { success: true, id: newSupplier.id, isNew: true };

  } catch (error: any) {
    return { success: false, id: '', isNew: false, error: error.message || 'حدث خطأ غير متوقع' };
  }
}

/**
 * جلب المورد المرتبط بعميل
 * Gets the linked supplier for a customer (if any)
 */
export async function getLinkedSupplier(customerId: string): Promise<Supplier | null> {
  try {
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('linked_supplier_id')
      .eq('id', customerId)
      .single();

    if (customerError || !customer?.linked_supplier_id) {
      return null;
    }

    const { data: supplier, error: supplierError } = await supabase
      .from('suppliers')
      .select('*')
      .eq('id', customer.linked_supplier_id)
      .single();

    if (supplierError || !supplier) {
      return null;
    }

    return supplier;

  } catch {
    return null;
  }
}

/**
 * جلب العميل المرتبط بمورد
 * Gets the linked customer for a supplier (if any)
 */
export async function getLinkedCustomer(supplierId: string): Promise<Customer | null> {
  try {
    const { data: supplier, error: supplierError } = await supabase
      .from('suppliers')
      .select('linked_customer_id')
      .eq('id', supplierId)
      .single();

    if (supplierError || !supplier?.linked_customer_id) {
      return null;
    }

    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('*')
      .eq('id', supplier.linked_customer_id)
      .single();

    if (customerError || !customer) {
      return null;
    }

    return customer;

  } catch {
    return null;
  }
}

/**
 * حساب رصيد العميل مع مراعاة المورد المرتبط
 * Calculate customer balance including linked supplier transactions
 */
export async function calculateCustomerBalanceWithLinked(customerId: string): Promise<{
  balance: number;
  salesTotal: number;
  paymentsTotal: number;
  loansTotal: number;
  linkedPurchasesTotal: number;
  openingBalance: number;
}> {
  try {
    // Get customer data
    const { data: customer } = await supabase
      .from('customers')
      .select('opening_balance, linked_supplier_id')
      .eq('id', customerId)
      .single();

    const openingBalance = Number(customer?.opening_balance) || 0;

    // Get sales total
    const { data: sales } = await supabase
      .from('sales')
      .select('total_amount')
      .eq('customer_id', customerId);
    const salesTotal = (sales || []).reduce((sum, s) => sum + (Number(s.total_amount) || 0), 0);

    // Get payments (separate loans and regular payments)
    const { data: payments } = await supabase
      .from('customer_payments')
      .select('amount, notes')
      .eq('customer_id', customerId);

    let paymentsTotal = 0;
    let loansTotal = 0;
    (payments || []).forEach(p => {
      const amount = Number(p.amount) || 0;
      if (p.notes?.startsWith('سلفة')) {
        loansTotal += amount;
      } else {
        paymentsTotal += amount;
      }
    });

    // Get linked supplier purchases (if any)
    let linkedPurchasesTotal = 0;
    if (customer?.linked_supplier_id) {
      const { data: purchases } = await supabase
        .from('purchase_invoices')
        .select('total_amount')
        .eq('supplier_id', customer.linked_supplier_id);
      linkedPurchasesTotal = (purchases || []).reduce((sum, p) => sum + (Number(p.total_amount) || 0), 0);
    }

    // Calculate balance: Opening + Sales + Loans - Payments - LinkedPurchases
    const balance = openingBalance + salesTotal + loansTotal - paymentsTotal - linkedPurchasesTotal;

    return {
      balance,
      salesTotal,
      paymentsTotal,
      loansTotal,
      linkedPurchasesTotal,
      openingBalance
    };

  } catch {
    return {
      balance: 0,
      salesTotal: 0,
      paymentsTotal: 0,
      loansTotal: 0,
      linkedPurchasesTotal: 0,
      openingBalance: 0
    };
  }
}

/**
 * حساب رصيد المورد مع مراعاة العميل المرتبط
 * Calculate supplier balance including linked customer transactions
 * يشمل: فواتير الشراء + المبيعات والمدفوعات من العميل المرتبط
 */
export async function calculateSupplierBalanceWithLinked(supplierId: string): Promise<{
  balance: number;
  purchasesTotal: number;
  paymentsTotal: number;
  linkedSalesTotal: number;
  linkedCustomerPayments: number;
  linkedCustomerLoans: number;
  openingBalance: number;
}> {
  try {
    // Get supplier data
    const { data: supplier } = await supabase
      .from('suppliers')
      .select('opening_balance, linked_customer_id')
      .eq('id', supplierId)
      .single();

    const openingBalance = Number(supplier?.opening_balance) || 0;

    // Get purchases total
    const { data: purchases } = await supabase
      .from('purchase_invoices')
      .select('total_amount')
      .eq('supplier_id', supplierId);
    const purchasesTotal = (purchases || []).reduce((sum, p) => sum + (Number(p.total_amount) || 0), 0);

    // Get payments total (supplier payments)
    const { data: payments } = await supabase
      .from('supplier_payments')
      .select('amount')
      .eq('supplier_id', supplierId);
    const paymentsTotal = (payments || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    // Get linked customer data (if any)
    let linkedSalesTotal = 0;
    let linkedCustomerPayments = 0;
    let linkedCustomerLoans = 0;

    if (supplier?.linked_customer_id) {
      // Get linked customer sales
      const { data: sales } = await supabase
        .from('sales')
        .select('total_amount')
        .eq('customer_id', supplier.linked_customer_id);
      linkedSalesTotal = (sales || []).reduce((sum, s) => sum + (Number(s.total_amount) || 0), 0);

      // Get linked customer payments (important: was missing before!)
      const { data: customerPayments } = await supabase
        .from('customer_payments')
        .select('amount, notes')
        .eq('customer_id', supplier.linked_customer_id);

      // Separate loans (سلفة) from regular payments (دفعة)
      (customerPayments || []).forEach(p => {
        const amount = Number(p.amount) || 0;
        if (p.notes?.startsWith('سلفة')) {
          // سلفة: تزيد ما على العميل (وبالتالي تقلل ما له عندنا كمورد)
          linkedCustomerLoans += amount;
        } else {
          // دفعة: تقلل ما على العميل (وبالتالي تزيد ما له عندنا كمورد)
          linkedCustomerPayments += amount;
        }
      });
    }

    // Calculate balance:
    // الرصيد = الرصيد الافتتاحي + فواتير الشراء - المدفوعات - صافي العميل المرتبط
    // صافي العميل المرتبط = المبيعات + السلف - المدفوعات
    // (موجب = العميل مدين لنا = نحن لسنا مدينين للمورد)
    const linkedNetBalance = linkedSalesTotal + linkedCustomerLoans - linkedCustomerPayments;
    const balance = openingBalance + purchasesTotal - paymentsTotal - linkedNetBalance;

    return {
      balance,
      purchasesTotal,
      paymentsTotal,
      linkedSalesTotal,
      linkedCustomerPayments,
      linkedCustomerLoans,
      openingBalance
    };

  } catch {
    return {
      balance: 0,
      purchasesTotal: 0,
      paymentsTotal: 0,
      linkedSalesTotal: 0,
      linkedCustomerPayments: 0,
      linkedCustomerLoans: 0,
      openingBalance: 0
    };
  }
}

/**
 * جلب معلومات العميل مع حساب الرصيد (شامل المورد المرتبط)
 */
export async function getCustomerWithBalance(customerId: string): Promise<{
  customer: Customer | null;
  balance: number;
  error?: string;
}> {
  try {
    const { data: customer, error } = await supabase
      .from('customers')
      .select('*')
      .eq('id', customerId)
      .single();

    if (error || !customer) {
      return { customer: null, balance: 0, error: error?.message };
    }

    const { balance } = await calculateCustomerBalanceWithLinked(customerId);

    return { customer, balance };

  } catch (error: any) {
    return { customer: null, balance: 0, error: error.message };
  }
}

/**
 * جلب معلومات المورد مع حساب الرصيد (شامل العميل المرتبط)
 */
export async function getSupplierWithBalance(supplierId: string): Promise<{
  supplier: Supplier | null;
  balance: number;
  error?: string;
}> {
  try {
    const { data: supplier, error } = await supabase
      .from('suppliers')
      .select('*')
      .eq('id', supplierId)
      .single();

    if (error || !supplier) {
      return { supplier: null, balance: 0, error: error?.message };
    }

    const { balance } = await calculateSupplierBalanceWithLinked(supplierId);

    return { supplier, balance };

  } catch (error: any) {
    return { supplier: null, balance: 0, error: error.message };
  }
}
