"use client";

import { Fragment, useState, useEffect } from "react";
import { Dialog, Transition } from "@headlessui/react";
import {
  XMarkIcon,
  UserIcon,
  MagnifyingGlassIcon,
  ArrowsRightLeftIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  DocumentTextIcon,
  CurrencyDollarIcon,
  StarIcon,
  ClockIcon,
  ArrowPathIcon,
  ArrowUturnLeftIcon,
} from "@heroicons/react/24/outline";
import { supabase } from "../lib/supabase/client";

interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  city: string | null;
  address: string | null;
  account_balance: number | null;
  rank: string | null;
  category: string | null;
  loyalty_points: number | null;
  is_active: boolean | null;
  group_id: string | null;
  opening_balance: number | null;
  created_at: string | null;
}

interface MergeStats {
  salesCount: number;
  paymentsCount: number;
  receiptsCount: number;
  ratingsCount: number;
  calculatedBalance: number; // Actual calculated balance
}

interface MergeRecord {
  id: string;
  primary_customer_id: string;
  merged_customer_id: string;
  merged_at: string;
  can_undo_until: string;
  is_permanent: boolean;
  merged_customer_data: any;
  moved_sales_ids: string[];
  moved_payments_ids: string[];
  moved_receipts_ids: string[];
  moved_ratings_ids: string[];
  merged_account_balance: number;
  merged_loyalty_points: number;
  merged_opening_balance: number;
  primary_customer?: {
    id: string;
    name: string;
    phone: string | null;
  };
}

interface MergeCustomersModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMergeComplete?: () => void;
  preSelectedCustomer?: Customer | null;
}

export default function MergeCustomersModal({
  isOpen,
  onClose,
  onMergeComplete,
  preSelectedCustomer,
}: MergeCustomersModalProps) {
  // Tab: "merge" for merging, "pending" for pending merges
  const [activeTab, setActiveTab] = useState<"merge" | "pending">("merge");

  // Step 1: Select customers, Step 2: Confirm merge
  const [step, setStep] = useState<1 | 2>(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selected customers
  const [customerToMerge, setCustomerToMerge] = useState<Customer | null>(null); // Will be deactivated
  const [primaryCustomer, setPrimaryCustomer] = useState<Customer | null>(null); // Will remain
  const [selectingFor, setSelectingFor] = useState<"merge" | "primary">("merge");

  // Merge stats
  const [mergeStats, setMergeStats] = useState<MergeStats | null>(null);
  const [primaryStats, setPrimaryStats] = useState<MergeStats | null>(null);
  const [isMerging, setIsMerging] = useState(false);
  const [mergeSuccess, setMergeSuccess] = useState(false);

  // Calculated balances for customer list display
  const [customerBalances, setCustomerBalances] = useState<{[key: string]: number}>({});

  // Pending merges state
  const [pendingMerges, setPendingMerges] = useState<MergeRecord[]>([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [undoingId, setUndoingId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Calculate balance for a single customer
  const calculateCustomerBalance = async (customerId: string): Promise<number> => {
    const [salesRes, paymentsRes] = await Promise.all([
      supabase.from("sales").select("total_amount, invoice_type").eq("customer_id", customerId),
      supabase.from("customer_payments").select("amount").eq("customer_id", customerId),
    ]);

    // Just sum all amounts - Sale Returns are already stored as negative values in the database
    const salesBalance = (salesRes.data || []).reduce((total, sale) => {
      return total + (sale.total_amount || 0);
    }, 0);

    const totalPayments = (paymentsRes.data || []).reduce((total, payment) => {
      return total + (payment.amount || 0);
    }, 0);

    return salesBalance - totalPayments;
  };

  // Fetch customers
  const fetchCustomers = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from("customers")
        .select("*")
        .eq("is_active", true)
        .order("name", { ascending: true });

      if (fetchError) {
        console.error("Error fetching customers:", fetchError);
        setError("فشل في تحميل العملاء");
        return;
      }

      setCustomers(data || []);

      // Calculate balances for all customers
      if (data && data.length > 0) {
        const balances: {[key: string]: number} = {};

        // Fetch all balances in parallel
        await Promise.all(
          data.map(async (customer) => {
            const balance = await calculateCustomerBalance(customer.id);
            balances[customer.id] = balance;
          })
        );

        setCustomerBalances(balances);
      }
    } catch (err) {
      console.error("Error fetching data:", err);
      setError("حدث خطأ أثناء تحميل البيانات");
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch merge statistics for a customer (including calculated balance)
  const fetchCustomerStats = async (customerId: string): Promise<MergeStats> => {
    const [salesRes, paymentsRes, receiptsRes, ratingsRes] = await Promise.all([
      supabase.from("sales").select("id, total_amount, invoice_type").eq("customer_id", customerId),
      supabase.from("customer_payments").select("id, amount").eq("customer_id", customerId),
      supabase.from("payment_receipts").select("id", { count: "exact" }).eq("customer_id", customerId),
      supabase.from("product_ratings").select("id", { count: "exact" }).eq("customer_id", customerId),
    ]);

    // Just sum all amounts - Sale Returns are already stored as negative values in the database
    const salesBalance = (salesRes.data || []).reduce((total, sale) => {
      return total + (sale.total_amount || 0);
    }, 0);

    const totalPayments = (paymentsRes.data || []).reduce((total, payment) => {
      return total + (payment.amount || 0);
    }, 0);

    const calculatedBalance = salesBalance - totalPayments;

    return {
      salesCount: salesRes.data?.length || 0,
      paymentsCount: paymentsRes.data?.length || 0,
      receiptsCount: receiptsRes.count || 0,
      ratingsCount: ratingsRes.count || 0,
      calculatedBalance: calculatedBalance,
    };
  };

  // Fetch pending merges
  const fetchPendingMerges = async () => {
    try {
      setPendingLoading(true);

      const { data, error: fetchError } = await (supabase as any)
        .from("customer_merges")
        .select(`
          *,
          primary_customer:customers!customer_merges_primary_customer_id_fkey(id, name, phone)
        `)
        .eq("is_permanent", false)
        .gt("can_undo_until", new Date().toISOString())
        .order("merged_at", { ascending: false });

      if (fetchError) {
        console.error("Error fetching merges:", fetchError);
        return;
      }

      setPendingMerges((data || []) as MergeRecord[]);
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setPendingLoading(false);
    }
  };

  // Calculate time remaining
  const getTimeRemaining = (canUndoUntil: string): string => {
    const now = new Date();
    const deadline = new Date(canUndoUntil);
    const diff = deadline.getTime() - now.getTime();

    if (diff <= 0) return "انتهت المهلة";

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `${hours} ساعة و ${minutes} دقيقة`;
    }
    return `${minutes} دقيقة`;
  };

  // Check if can still undo
  const canUndo = (canUndoUntil: string): boolean => {
    return new Date(canUndoUntil) > new Date();
  };

  // Undo merge
  const undoMerge = async (merge: MergeRecord) => {
    if (!canUndo(merge.can_undo_until)) {
      setError("انتهت مهلة فك الدمج");
      return;
    }

    setUndoingId(merge.id);
    setError(null);
    setSuccessMessage(null);

    try {
      const mergedCustomerData = merge.merged_customer_data;

      // 1. Reactivate merged customer
      const { error: reactivateError } = await supabase
        .from("customers")
        .update({ is_active: true })
        .eq("id", merge.merged_customer_id);

      if (reactivateError) {
        throw new Error("فشل في إعادة تفعيل الحساب: " + reactivateError.message);
      }

      // 2. Move sales back
      if (merge.moved_sales_ids && merge.moved_sales_ids.length > 0) {
        await supabase
          .from("sales")
          .update({ customer_id: merge.merged_customer_id })
          .in("id", merge.moved_sales_ids);
      }

      // 3. Move payments back
      if (merge.moved_payments_ids && merge.moved_payments_ids.length > 0) {
        await supabase
          .from("customer_payments")
          .update({ customer_id: merge.merged_customer_id })
          .in("id", merge.moved_payments_ids);
      }

      // 4. Move receipts back
      if (merge.moved_receipts_ids && merge.moved_receipts_ids.length > 0) {
        await supabase
          .from("payment_receipts")
          .update({ customer_id: merge.merged_customer_id })
          .in("id", merge.moved_receipts_ids);
      }

      // 5. Move ratings back
      if (merge.moved_ratings_ids && merge.moved_ratings_ids.length > 0) {
        await supabase
          .from("product_ratings")
          .update({ customer_id: merge.merged_customer_id })
          .in("id", merge.moved_ratings_ids);
      }

      // 6. Restore balance on primary customer
      const { data: primaryCustomerData } = await supabase
        .from("customers")
        .select("account_balance, loyalty_points")
        .eq("id", merge.primary_customer_id)
        .single();

      if (primaryCustomerData) {
        const newBalance = (primaryCustomerData.account_balance || 0) - merge.merged_account_balance;
        const newPoints = (primaryCustomerData.loyalty_points || 0) - merge.merged_loyalty_points;

        await supabase
          .from("customers")
          .update({
            account_balance: newBalance,
            loyalty_points: newPoints,
          })
          .eq("id", merge.primary_customer_id);
      }

      // 7. Delete merge record
      await (supabase as any)
        .from("customer_merges")
        .delete()
        .eq("id", merge.id);

      setSuccessMessage(`تم فك دمج حساب "${mergedCustomerData?.name}" بنجاح`);

      // Refresh list
      await fetchPendingMerges();

      // Notify parent
      if (onMergeComplete) {
        onMergeComplete();
      }

    } catch (err: any) {
      console.error("Undo error:", err);
      setError(err.message || "حدث خطأ أثناء فك الدمج");
    } finally {
      setUndoingId(null);
    }
  };

  // Reset modal state
  const resetModal = () => {
    setActiveTab("merge");
    setStep(1);
    setSearchQuery("");
    setCustomerToMerge(null);
    setPrimaryCustomer(null);
    setSelectingFor("merge");
    setMergeStats(null);
    setPrimaryStats(null);
    setIsMerging(false);
    setMergeSuccess(false);
    setError(null);
    setSuccessMessage(null);
  };

  // Handle modal open
  useEffect(() => {
    if (isOpen) {
      resetModal();
      fetchCustomers();
      fetchPendingMerges();
      if (preSelectedCustomer) {
        setCustomerToMerge(preSelectedCustomer);
      }
    }
  }, [isOpen, preSelectedCustomer]);

  // Fetch pending merges when tab changes to pending
  useEffect(() => {
    if (activeTab === "pending") {
      fetchPendingMerges();
    }
  }, [activeTab]);

  // Fetch stats when both customers are selected
  useEffect(() => {
    const fetchStats = async () => {
      if (customerToMerge && primaryCustomer) {
        const [mergeS, primaryS] = await Promise.all([
          fetchCustomerStats(customerToMerge.id),
          fetchCustomerStats(primaryCustomer.id),
        ]);
        setMergeStats(mergeS);
        setPrimaryStats(primaryS);
      }
    };
    fetchStats();
  }, [customerToMerge, primaryCustomer]);

  // Handle customer selection
  const handleSelectCustomer = (customer: Customer) => {
    // Don't allow selecting same customer for both
    if (selectingFor === "merge") {
      if (primaryCustomer?.id === customer.id) {
        setError("لا يمكن اختيار نفس العميل للدمج");
        return;
      }
      setCustomerToMerge(customer);
      setSelectingFor("primary");
    } else {
      if (customerToMerge?.id === customer.id) {
        setError("لا يمكن اختيار نفس العميل للدمج");
        return;
      }
      setPrimaryCustomer(customer);
    }
    setError(null);
  };

  // Swap customers
  const swapCustomers = () => {
    const temp = customerToMerge;
    setCustomerToMerge(primaryCustomer);
    setPrimaryCustomer(temp);
  };

  // Proceed to confirmation step
  const proceedToConfirm = () => {
    if (!customerToMerge || !primaryCustomer) {
      setError("يجب اختيار عميلين للدمج");
      return;
    }
    setStep(2);
  };

  // Execute merge
  const executeMerge = async () => {
    if (!customerToMerge || !primaryCustomer) return;

    setIsMerging(true);
    setError(null);

    try {
      // 1. Get all records that will be moved
      const [salesRes, paymentsRes, receiptsRes, ratingsRes] = await Promise.all([
        supabase.from("sales").select("id").eq("customer_id", customerToMerge.id),
        supabase.from("customer_payments").select("id").eq("customer_id", customerToMerge.id),
        supabase.from("payment_receipts").select("id").eq("customer_id", customerToMerge.id),
        supabase.from("product_ratings").select("id").eq("customer_id", customerToMerge.id),
      ]);

      const movedSalesIds = (salesRes.data || []).map(s => s.id);
      const movedPaymentsIds = (paymentsRes.data || []).map(p => p.id);
      const movedReceiptsIds = (receiptsRes.data || []).map(r => r.id);
      const movedRatingsIds = (ratingsRes.data || []).map(r => r.id);

      // 2. Calculate new combined values using calculated balances
      // Note: We use the calculated balances from mergeStats and primaryStats which are computed dynamically
      const newAccountBalance = (primaryStats?.calculatedBalance || 0) + (mergeStats?.calculatedBalance || 0);
      const newLoyaltyPoints = (primaryCustomer.loyalty_points || 0) + (customerToMerge.loyalty_points || 0);

      // 3. Create merge record
      // Note: Using 'as any' because customer_merges table type is not yet in generated types
      const { data: mergeRecord, error: mergeError } = await (supabase as any)
        .from("customer_merges")
        .insert({
          primary_customer_id: primaryCustomer.id,
          merged_customer_id: customerToMerge.id,
          merged_customer_data: customerToMerge,
          moved_sales_ids: movedSalesIds,
          moved_payments_ids: movedPaymentsIds,
          moved_receipts_ids: movedReceiptsIds,
          moved_ratings_ids: movedRatingsIds,
          merged_account_balance: mergeStats?.calculatedBalance || 0, // Use calculated balance
          merged_loyalty_points: customerToMerge.loyalty_points || 0,
          merged_opening_balance: customerToMerge.opening_balance || 0,
        })
        .select()
        .single();

      if (mergeError) {
        throw new Error("فشل في إنشاء سجل الدمج: " + mergeError.message);
      }

      // 4. Move all records to primary customer
      const updatePromises = [];

      if (movedSalesIds.length > 0) {
        updatePromises.push(
          supabase
            .from("sales")
            .update({ customer_id: primaryCustomer.id })
            .in("id", movedSalesIds)
        );
      }

      if (movedPaymentsIds.length > 0) {
        updatePromises.push(
          supabase
            .from("customer_payments")
            .update({ customer_id: primaryCustomer.id })
            .in("id", movedPaymentsIds)
        );
      }

      if (movedReceiptsIds.length > 0) {
        updatePromises.push(
          supabase
            .from("payment_receipts")
            .update({ customer_id: primaryCustomer.id })
            .in("id", movedReceiptsIds)
        );
      }

      if (movedRatingsIds.length > 0) {
        updatePromises.push(
          supabase
            .from("product_ratings")
            .update({ customer_id: primaryCustomer.id })
            .in("id", movedRatingsIds)
        );
      }

      // 5. Update primary customer's balance and points
      updatePromises.push(
        supabase
          .from("customers")
          .update({
            account_balance: newAccountBalance,
            loyalty_points: newLoyaltyPoints,
          })
          .eq("id", primaryCustomer.id)
      );

      // 6. Deactivate merged customer
      updatePromises.push(
        supabase
          .from("customers")
          .update({ is_active: false })
          .eq("id", customerToMerge.id)
      );

      // Execute all updates
      await Promise.all(updatePromises);

      setMergeSuccess(true);

      // Notify parent and close after delay
      setTimeout(() => {
        if (onMergeComplete) {
          onMergeComplete();
        }
        onClose();
      }, 2000);

    } catch (err: any) {
      console.error("Merge error:", err);
      setError(err.message || "حدث خطأ أثناء عملية الدمج");
    } finally {
      setIsMerging(false);
    }
  };

  // Filter customers
  const filteredCustomers = customers.filter((customer) => {
    const matchesSearch =
      searchQuery === "" ||
      customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (customer.phone && customer.phone.includes(searchQuery)) ||
      (customer.email && customer.email.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesSearch;
  });

  // Check if customer is default
  const isDefaultCustomer = (customer: Customer) => customer.name === "عميل";

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-3xl transform overflow-hidden rounded-2xl bg-[#1F2937] shadow-xl transition-all border border-gray-600">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-600">
                  <Dialog.Title className="text-xl font-bold text-white flex items-center gap-2">
                    <ArrowsRightLeftIcon className="h-6 w-6 text-blue-400" />
                    دمج حسابات العملاء
                  </Dialog.Title>
                  <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-gray-700"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-600">
                  <button
                    onClick={() => { setActiveTab("merge"); setError(null); setSuccessMessage(null); }}
                    className={`flex-1 px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                      activeTab === "merge"
                        ? "text-blue-400 border-b-2 border-blue-400 bg-blue-500/10"
                        : "text-gray-400 hover:text-white hover:bg-gray-700/50"
                    }`}
                  >
                    <ArrowsRightLeftIcon className="h-4 w-4" />
                    دمج حسابات
                  </button>
                  <button
                    onClick={() => { setActiveTab("pending"); setError(null); setSuccessMessage(null); }}
                    className={`flex-1 px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                      activeTab === "pending"
                        ? "text-yellow-400 border-b-2 border-yellow-400 bg-yellow-500/10"
                        : "text-gray-400 hover:text-white hover:bg-gray-700/50"
                    }`}
                  >
                    <ClockIcon className="h-4 w-4" />
                    الدمجات المعلقة
                    {pendingMerges.length > 0 && (
                      <span className="bg-yellow-500 text-black text-xs px-1.5 py-0.5 rounded-full font-bold">
                        {pendingMerges.length}
                      </span>
                    )}
                  </button>
                </div>

                {/* Pending Merges Tab */}
                {activeTab === "pending" ? (
                  <div>
                    {/* Success Message */}
                    {successMessage && (
                      <div className="mx-6 mt-4 p-3 bg-green-500/10 border border-green-500/50 rounded-lg flex items-center gap-2 text-green-400">
                        <CheckCircleIcon className="h-5 w-5 flex-shrink-0" />
                        <span className="text-sm">{successMessage}</span>
                      </div>
                    )}

                    {/* Error Message */}
                    {error && (
                      <div className="mx-6 mt-4 p-3 bg-red-500/10 border border-red-500/50 rounded-lg flex items-center gap-2 text-red-400">
                        <ExclamationTriangleIcon className="h-5 w-5 flex-shrink-0" />
                        <span className="text-sm">{error}</span>
                      </div>
                    )}

                    {/* Info Box */}
                    <div className="mx-6 mt-4 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
                      <p className="text-sm text-yellow-400">
                        يمكنك فك الدمج واسترجاع الحسابات المدمجة خلال 24 ساعة من وقت الدمج.
                        بعد انتهاء المهلة، يصبح الدمج نهائياً.
                      </p>
                    </div>

                    {/* Pending Merges List */}
                    <div className="p-6 max-h-[400px] overflow-y-auto scrollbar-hide">
                      {pendingLoading ? (
                        <div className="flex flex-col items-center justify-center py-12">
                          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mb-4"></div>
                          <p className="text-gray-400">جاري التحميل...</p>
                        </div>
                      ) : pendingMerges.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12">
                          <CheckCircleIcon className="h-16 w-16 text-green-500 mb-4" />
                          <p className="text-gray-400 text-lg mb-2">لا توجد دمجات معلقة</p>
                          <p className="text-gray-500 text-sm">جميع الدمجات السابقة أصبحت نهائية</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {pendingMerges.map((merge) => {
                            const mergedData = merge.merged_customer_data;
                            const stillCanUndo = canUndo(merge.can_undo_until);

                            return (
                              <div
                                key={merge.id}
                                className={`p-4 rounded-xl border ${
                                  stillCanUndo
                                    ? "bg-[#2B3544] border-gray-600"
                                    : "bg-gray-700/50 border-gray-700"
                                }`}
                              >
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    {/* Customers Info */}
                                    <div className="flex items-center gap-3 mb-3">
                                      <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center">
                                          <UserIcon className="h-4 w-4 text-red-400" />
                                        </div>
                                        <span className="text-white font-medium">{mergedData?.name || "عميل محذوف"}</span>
                                      </div>
                                      <span className="text-gray-500">→</span>
                                      <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                                          <UserIcon className="h-4 w-4 text-green-400" />
                                        </div>
                                        <span className="text-white font-medium">
                                          {merge.primary_customer?.name || "عميل"}
                                        </span>
                                      </div>
                                    </div>

                                    {/* Stats */}
                                    <div className="flex items-center gap-4 text-sm text-gray-400 mb-3">
                                      <span>
                                        الفواتير: <span className="text-white">{merge.moved_sales_ids?.length || 0}</span>
                                      </span>
                                      <span>
                                        المدفوعات: <span className="text-white">{merge.moved_payments_ids?.length || 0}</span>
                                      </span>
                                      <span>
                                        الرصيد:{" "}
                                        <span className={merge.merged_account_balance >= 0 ? "text-green-400" : "text-red-400"}>
                                          {merge.merged_account_balance.toLocaleString()} ج.م
                                        </span>
                                      </span>
                                    </div>

                                    {/* Time Info */}
                                    <div className="flex items-center gap-2 text-sm">
                                      <ClockIcon className="h-4 w-4 text-yellow-500" />
                                      <span className={stillCanUndo ? "text-yellow-400" : "text-gray-500"}>
                                        {stillCanUndo ? (
                                          <>المتبقي: {getTimeRemaining(merge.can_undo_until)}</>
                                        ) : (
                                          "انتهت المهلة"
                                        )}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Undo Button */}
                                  <button
                                    onClick={() => undoMerge(merge)}
                                    disabled={!stillCanUndo || undoingId === merge.id}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                      stillCanUndo && undoingId !== merge.id
                                        ? "bg-orange-600 hover:bg-orange-700 text-white"
                                        : "bg-gray-600 text-gray-400 cursor-not-allowed"
                                    }`}
                                  >
                                    {undoingId === merge.id ? (
                                      <>
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                        جاري...
                                      </>
                                    ) : (
                                      <>
                                        <ArrowUturnLeftIcon className="h-4 w-4" />
                                        فك الدمج
                                      </>
                                    )}
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Footer */}
                    <div className="p-4 border-t border-gray-600 flex justify-end">
                      <button
                        onClick={onClose}
                        className="px-6 py-2.5 bg-gray-600 hover:bg-gray-700 text-white rounded-xl transition-colors"
                      >
                        إغلاق
                      </button>
                    </div>
                  </div>
                ) : mergeSuccess ? (
                  /* Success State */
                  <div className="p-8 flex flex-col items-center justify-center">
                    <CheckCircleIcon className="h-20 w-20 text-green-500 mb-4" />
                    <h3 className="text-xl font-bold text-white mb-2">تم الدمج بنجاح!</h3>
                    <p className="text-gray-400 text-center mb-4">
                      تم دمج حساب "{customerToMerge?.name}" في حساب "{primaryCustomer?.name}"
                    </p>
                    <div className="flex items-center gap-2 text-yellow-500 bg-yellow-500/10 px-4 py-2 rounded-lg">
                      <ClockIcon className="h-5 w-5" />
                      <span className="text-sm">يمكن فك الدمج خلال 24 ساعة</span>
                    </div>
                  </div>
                ) : step === 1 ? (
                  /* Step 1: Select Customers */
                  <>
                    {/* Selected Customers Display */}
                    <div className="p-4 bg-[#2B3544] border-b border-gray-600">
                      <div className="grid grid-cols-2 gap-4">
                        {/* Customer to Merge (Will be deactivated) */}
                        <div
                          className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                            selectingFor === "merge"
                              ? "border-blue-500 bg-blue-500/10"
                              : customerToMerge
                                ? "border-red-500/50 bg-red-500/10"
                                : "border-gray-600 bg-[#1F2937]"
                          }`}
                          onClick={() => setSelectingFor("merge")}
                        >
                          <div className="text-xs text-red-400 mb-2 font-medium">الحساب المدموج (سيتم تعطيله)</div>
                          {customerToMerge ? (
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                                <UserIcon className="h-5 w-5 text-red-400" />
                              </div>
                              <div>
                                <div className="font-semibold text-white">{customerToMerge.name}</div>
                                <div className="text-sm text-gray-400">{customerToMerge.phone || "بدون رقم"}</div>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-3 text-gray-500">
                              <div className="w-10 h-10 rounded-full bg-gray-600 flex items-center justify-center">
                                <UserIcon className="h-5 w-5" />
                              </div>
                              <span>اختر العميل المراد دمجه</span>
                            </div>
                          )}
                        </div>

                        {/* Swap Button */}
                        {customerToMerge && primaryCustomer && (
                          <button
                            onClick={swapCustomers}
                            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 p-2 bg-[#374151] rounded-full border border-gray-500 hover:bg-[#4B5563] transition-colors"
                            style={{ position: 'absolute', left: '50%', marginTop: '40px' }}
                          >
                            <ArrowsRightLeftIcon className="h-5 w-5 text-gray-300" />
                          </button>
                        )}

                        {/* Primary Customer (Will remain) */}
                        <div
                          className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                            selectingFor === "primary"
                              ? "border-blue-500 bg-blue-500/10"
                              : primaryCustomer
                                ? "border-green-500/50 bg-green-500/10"
                                : "border-gray-600 bg-[#1F2937]"
                          }`}
                          onClick={() => setSelectingFor("primary")}
                        >
                          <div className="text-xs text-green-400 mb-2 font-medium">الحساب الأساسي (سيبقى)</div>
                          {primaryCustomer ? (
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                                <UserIcon className="h-5 w-5 text-green-400" />
                              </div>
                              <div>
                                <div className="font-semibold text-white">{primaryCustomer.name}</div>
                                <div className="text-sm text-gray-400">{primaryCustomer.phone || "بدون رقم"}</div>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-3 text-gray-500">
                              <div className="w-10 h-10 rounded-full bg-gray-600 flex items-center justify-center">
                                <UserIcon className="h-5 w-5" />
                              </div>
                              <span>اختر الحساب الأساسي</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Swap Button Below */}
                      {customerToMerge && primaryCustomer && (
                        <div className="flex justify-center mt-3">
                          <button
                            onClick={swapCustomers}
                            className="flex items-center gap-2 px-4 py-2 bg-[#374151] rounded-lg border border-gray-500 hover:bg-[#4B5563] transition-colors text-gray-300 text-sm"
                          >
                            <ArrowsRightLeftIcon className="h-4 w-4" />
                            تبديل الحسابات
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Search */}
                    <div className="p-4 border-b border-gray-600">
                      <div className="relative">
                        <MagnifyingGlassIcon className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="البحث عن عميل بالاسم أو الهاتف أو البريد..."
                          className="w-full pl-4 pr-12 py-3 bg-[#2B3544] border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      <p className="text-sm text-gray-500 mt-2">
                        {selectingFor === "merge"
                          ? "اختر الحساب الذي سيتم دمجه (سيتم تعطيله)"
                          : "اختر الحساب الأساسي (سيبقى ببياناته)"}
                      </p>
                    </div>

                    {/* Customers List */}
                    <div className="max-h-[300px] overflow-y-auto scrollbar-hide">
                      {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-12">
                          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mb-4"></div>
                          <p className="text-gray-400">جاري تحميل العملاء...</p>
                        </div>
                      ) : filteredCustomers.length > 0 ? (
                        <div className="p-2 space-y-1">
                          {filteredCustomers.map((customer) => {
                            const isSelected = customerToMerge?.id === customer.id || primaryCustomer?.id === customer.id;
                            const isDefault = isDefaultCustomer(customer);

                            return (
                              <button
                                key={customer.id}
                                onClick={() => !isDefault && handleSelectCustomer(customer)}
                                disabled={isDefault}
                                className={`w-full flex items-center justify-between p-4 rounded-xl transition-all border-2 ${
                                  isDefault
                                    ? "bg-gray-600/20 border-gray-700 cursor-not-allowed opacity-50"
                                    : isSelected
                                      ? customerToMerge?.id === customer.id
                                        ? "bg-red-500/10 border-red-500/50"
                                        : "bg-green-500/10 border-green-500/50"
                                      : "bg-[#2B3544] border-transparent hover:bg-[#374151] hover:border-gray-500"
                                } text-gray-200`}
                              >
                                <div className="flex items-center gap-3">
                                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                    customerToMerge?.id === customer.id
                                      ? "bg-red-500/20"
                                      : primaryCustomer?.id === customer.id
                                        ? "bg-green-500/20"
                                        : "bg-[#374151]"
                                  }`}>
                                    <UserIcon className={`h-5 w-5 ${
                                      customerToMerge?.id === customer.id
                                        ? "text-red-400"
                                        : primaryCustomer?.id === customer.id
                                          ? "text-green-400"
                                          : ""
                                    }`} />
                                  </div>
                                  <div className="text-right">
                                    <div className="font-semibold flex items-center gap-2">
                                      {customer.name}
                                      {isDefault && (
                                        <span className="text-xs bg-gray-600 text-gray-400 px-2 py-0.5 rounded-lg">
                                          لا يمكن دمجه
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-sm text-gray-400 flex items-center gap-3">
                                      {customer.phone && <span>{customer.phone}</span>}
                                      {customer.email && <span className="text-gray-500">{customer.email}</span>}
                                    </div>
                                  </div>
                                </div>
                                <div className="text-left">
                                  <div className={`font-medium ${
                                    (customerBalances[customer.id] ?? 0) > 0
                                      ? "text-red-400"
                                      : (customerBalances[customer.id] ?? 0) < 0
                                        ? "text-green-400"
                                        : "text-gray-400"
                                  }`}>
                                    {(customerBalances[customer.id] ?? 0).toLocaleString()} ج.م
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-12">
                          <UserIcon className="h-12 w-12 text-gray-500 mb-4" />
                          <p className="text-gray-400">لا توجد نتائج</p>
                        </div>
                      )}
                    </div>

                    {/* Error Message */}
                    {error && (
                      <div className="mx-4 mb-4 p-3 bg-red-500/10 border border-red-500/50 rounded-lg flex items-center gap-2 text-red-400">
                        <ExclamationTriangleIcon className="h-5 w-5 flex-shrink-0" />
                        <span className="text-sm">{error}</span>
                      </div>
                    )}

                    {/* Footer Actions */}
                    <div className="p-4 border-t border-gray-600 flex justify-between items-center">
                      <button
                        onClick={onClose}
                        className="px-6 py-2.5 text-gray-400 hover:text-white transition-colors"
                      >
                        إلغاء
                      </button>
                      <button
                        onClick={proceedToConfirm}
                        disabled={!customerToMerge || !primaryCustomer}
                        className={`px-6 py-2.5 rounded-xl font-medium transition-all ${
                          customerToMerge && primaryCustomer
                            ? "bg-blue-600 hover:bg-blue-700 text-white"
                            : "bg-gray-600 text-gray-400 cursor-not-allowed"
                        }`}
                      >
                        التالي - مراجعة الدمج
                      </button>
                    </div>
                  </>
                ) : (
                  /* Step 2: Confirm Merge */
                  <>
                    <div className="p-6">
                      {/* Warning */}
                      <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/50 rounded-xl flex items-start gap-3">
                        <ExclamationTriangleIcon className="h-6 w-6 text-yellow-500 flex-shrink-0 mt-0.5" />
                        <div>
                          <h4 className="font-semibold text-yellow-500 mb-1">تنبيه مهم</h4>
                          <p className="text-sm text-yellow-400/80">
                            سيتم نقل جميع الفواتير والمدفوعات والرصيد من حساب "{customerToMerge?.name}"
                            إلى حساب "{primaryCustomer?.name}". يمكنك فك الدمج خلال 24 ساعة فقط.
                          </p>
                        </div>
                      </div>

                      {/* Merge Summary */}
                      <div className="grid grid-cols-2 gap-6">
                        {/* From Customer */}
                        <div className="bg-red-500/5 border border-red-500/30 rounded-xl p-4">
                          <div className="text-xs text-red-400 mb-3 font-medium">سيتم نقل من:</div>
                          <div className="flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                              <UserIcon className="h-6 w-6 text-red-400" />
                            </div>
                            <div>
                              <div className="font-bold text-white text-lg">{customerToMerge?.name}</div>
                              <div className="text-sm text-gray-400">{customerToMerge?.phone || "بدون رقم"}</div>
                            </div>
                          </div>

                          <div className="space-y-2 text-sm">
                            <div className="flex items-center justify-between py-2 border-t border-red-500/20">
                              <span className="text-gray-400 flex items-center gap-2">
                                <DocumentTextIcon className="h-4 w-4" />
                                الفواتير
                              </span>
                              <span className="text-white font-medium">{mergeStats?.salesCount || 0}</span>
                            </div>
                            <div className="flex items-center justify-between py-2 border-t border-red-500/20">
                              <span className="text-gray-400 flex items-center gap-2">
                                <CurrencyDollarIcon className="h-4 w-4" />
                                المدفوعات
                              </span>
                              <span className="text-white font-medium">{mergeStats?.paymentsCount || 0}</span>
                            </div>
                            <div className="flex items-center justify-between py-2 border-t border-red-500/20">
                              <span className="text-gray-400 flex items-center gap-2">
                                <CurrencyDollarIcon className="h-4 w-4" />
                                الرصيد
                              </span>
                              <span className={`font-medium ${
                                (mergeStats?.calculatedBalance || 0) > 0 ? "text-red-400" : (mergeStats?.calculatedBalance || 0) < 0 ? "text-green-400" : "text-gray-400"
                              }`}>
                                {(mergeStats?.calculatedBalance || 0).toLocaleString()} ج.م
                              </span>
                            </div>
                            <div className="flex items-center justify-between py-2 border-t border-red-500/20">
                              <span className="text-gray-400 flex items-center gap-2">
                                <StarIcon className="h-4 w-4" />
                                النقاط
                              </span>
                              <span className="text-yellow-400 font-medium">{customerToMerge?.loyalty_points || 0}</span>
                            </div>
                          </div>
                        </div>

                        {/* To Customer */}
                        <div className="bg-green-500/5 border border-green-500/30 rounded-xl p-4">
                          <div className="text-xs text-green-400 mb-3 font-medium">سيتم الدمج في:</div>
                          <div className="flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
                              <UserIcon className="h-6 w-6 text-green-400" />
                            </div>
                            <div>
                              <div className="font-bold text-white text-lg">{primaryCustomer?.name}</div>
                              <div className="text-sm text-gray-400">{primaryCustomer?.phone || "بدون رقم"}</div>
                            </div>
                          </div>

                          <div className="space-y-2 text-sm">
                            <div className="flex items-center justify-between py-2 border-t border-green-500/20">
                              <span className="text-gray-400 flex items-center gap-2">
                                <DocumentTextIcon className="h-4 w-4" />
                                الفواتير (بعد الدمج)
                              </span>
                              <span className="text-white font-medium">
                                {(primaryStats?.salesCount || 0) + (mergeStats?.salesCount || 0)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between py-2 border-t border-green-500/20">
                              <span className="text-gray-400 flex items-center gap-2">
                                <CurrencyDollarIcon className="h-4 w-4" />
                                المدفوعات (بعد الدمج)
                              </span>
                              <span className="text-white font-medium">
                                {(primaryStats?.paymentsCount || 0) + (mergeStats?.paymentsCount || 0)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between py-2 border-t border-green-500/20">
                              <span className="text-gray-400 flex items-center gap-2">
                                <CurrencyDollarIcon className="h-4 w-4" />
                                الرصيد (بعد الدمج)
                              </span>
                              <span className={`font-medium ${
                                ((primaryStats?.calculatedBalance || 0) + (mergeStats?.calculatedBalance || 0)) > 0
                                  ? "text-red-400"
                                  : ((primaryStats?.calculatedBalance || 0) + (mergeStats?.calculatedBalance || 0)) < 0
                                    ? "text-green-400"
                                    : "text-gray-400"
                              }`}>
                                {((primaryStats?.calculatedBalance || 0) + (mergeStats?.calculatedBalance || 0)).toLocaleString()} ج.م
                              </span>
                            </div>
                            <div className="flex items-center justify-between py-2 border-t border-green-500/20">
                              <span className="text-gray-400 flex items-center gap-2">
                                <StarIcon className="h-4 w-4" />
                                النقاط (بعد الدمج)
                              </span>
                              <span className="text-yellow-400 font-medium">
                                {(primaryCustomer?.loyalty_points || 0) + (customerToMerge?.loyalty_points || 0)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Undo Notice */}
                      <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl flex items-center gap-3">
                        <ClockIcon className="h-6 w-6 text-blue-400 flex-shrink-0" />
                        <div>
                          <p className="text-sm text-blue-400">
                            <span className="font-semibold">ملاحظة:</span> يمكنك فك الدمج واسترجاع الحسابين منفصلين خلال 24 ساعة فقط من الآن.
                            بعد انتهاء هذه المدة، يصبح الدمج نهائياً ولا يمكن التراجع عنه.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Error Message */}
                    {error && (
                      <div className="mx-6 mb-4 p-3 bg-red-500/10 border border-red-500/50 rounded-lg flex items-center gap-2 text-red-400">
                        <ExclamationTriangleIcon className="h-5 w-5 flex-shrink-0" />
                        <span className="text-sm">{error}</span>
                      </div>
                    )}

                    {/* Footer Actions */}
                    <div className="p-4 border-t border-gray-600 flex justify-between items-center">
                      <button
                        onClick={() => setStep(1)}
                        disabled={isMerging}
                        className="px-6 py-2.5 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
                      >
                        رجوع
                      </button>
                      <button
                        onClick={executeMerge}
                        disabled={isMerging}
                        className={`px-8 py-2.5 rounded-xl font-medium transition-all flex items-center gap-2 ${
                          isMerging
                            ? "bg-gray-600 text-gray-400 cursor-not-allowed"
                            : "bg-green-600 hover:bg-green-700 text-white"
                        }`}
                      >
                        {isMerging ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            جاري الدمج...
                          </>
                        ) : (
                          <>
                            <CheckCircleIcon className="h-5 w-5" />
                            تأكيد الدمج
                          </>
                        )}
                      </button>
                    </div>
                  </>
                )}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
