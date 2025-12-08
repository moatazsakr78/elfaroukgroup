"use client";

import { Fragment, useState, useEffect } from "react";
import { Dialog, Transition } from "@headlessui/react";
import {
  XMarkIcon,
  UserIcon,
  ArrowPathIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ArrowUturnLeftIcon,
} from "@heroicons/react/24/outline";
import { supabase } from "../lib/supabase/client";

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
  // Joined data
  primary_customer?: {
    id: string;
    name: string;
    phone: string | null;
  };
}

interface PendingMergesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUndoComplete?: () => void;
}

export default function PendingMergesModal({
  isOpen,
  onClose,
  onUndoComplete,
}: PendingMergesModalProps) {
  const [merges, setMerges] = useState<MergeRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [undoingId, setUndoingId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Fetch pending merges
  const fetchPendingMerges = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Note: Using 'as any' because customer_merges table type is not yet in generated types
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
        setError("فشل في تحميل قائمة الدمجات");
        return;
      }

      setMerges((data || []) as MergeRecord[]);
    } catch (err) {
      console.error("Error:", err);
      setError("حدث خطأ أثناء تحميل البيانات");
    } finally {
      setIsLoading(false);
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

      // 2. Move sales back to merged customer
      if (merge.moved_sales_ids && merge.moved_sales_ids.length > 0) {
        const { error: salesError } = await supabase
          .from("sales")
          .update({ customer_id: merge.merged_customer_id })
          .in("id", merge.moved_sales_ids);

        if (salesError) {
          throw new Error("فشل في استرجاع الفواتير: " + salesError.message);
        }
      }

      // 3. Move payments back to merged customer
      if (merge.moved_payments_ids && merge.moved_payments_ids.length > 0) {
        const { error: paymentsError } = await supabase
          .from("customer_payments")
          .update({ customer_id: merge.merged_customer_id })
          .in("id", merge.moved_payments_ids);

        if (paymentsError) {
          throw new Error("فشل في استرجاع المدفوعات: " + paymentsError.message);
        }
      }

      // 4. Move receipts back to merged customer
      if (merge.moved_receipts_ids && merge.moved_receipts_ids.length > 0) {
        const { error: receiptsError } = await supabase
          .from("payment_receipts")
          .update({ customer_id: merge.merged_customer_id })
          .in("id", merge.moved_receipts_ids);

        if (receiptsError) {
          throw new Error("فشل في استرجاع الإيصالات: " + receiptsError.message);
        }
      }

      // 5. Move ratings back to merged customer
      if (merge.moved_ratings_ids && merge.moved_ratings_ids.length > 0) {
        const { error: ratingsError } = await supabase
          .from("product_ratings")
          .update({ customer_id: merge.merged_customer_id })
          .in("id", merge.moved_ratings_ids);

        if (ratingsError) {
          throw new Error("فشل في استرجاع التقييمات: " + ratingsError.message);
        }
      }

      // 6. Restore account balance on primary customer
      const { data: primaryCustomer, error: getError } = await supabase
        .from("customers")
        .select("account_balance, loyalty_points")
        .eq("id", merge.primary_customer_id)
        .single();

      if (!getError && primaryCustomer) {
        const newBalance = (primaryCustomer.account_balance || 0) - merge.merged_account_balance;
        const newPoints = (primaryCustomer.loyalty_points || 0) - merge.merged_loyalty_points;

        await supabase
          .from("customers")
          .update({
            account_balance: newBalance,
            loyalty_points: newPoints,
          })
          .eq("id", merge.primary_customer_id);
      }

      // 7. Delete merge record
      const { error: deleteError } = await (supabase as any)
        .from("customer_merges")
        .delete()
        .eq("id", merge.id);

      if (deleteError) {
        throw new Error("فشل في حذف سجل الدمج: " + deleteError.message);
      }

      setSuccessMessage(`تم فك دمج حساب "${mergedCustomerData.name}" بنجاح`);

      // Refresh list
      await fetchPendingMerges();

      // Notify parent
      if (onUndoComplete) {
        onUndoComplete();
      }

    } catch (err: any) {
      console.error("Undo error:", err);
      setError(err.message || "حدث خطأ أثناء فك الدمج");
    } finally {
      setUndoingId(null);
    }
  };

  // Fetch on open
  useEffect(() => {
    if (isOpen) {
      fetchPendingMerges();
      setError(null);
      setSuccessMessage(null);
    }
  }, [isOpen]);

  // Auto-refresh every minute
  useEffect(() => {
    if (!isOpen) return;

    const interval = setInterval(() => {
      fetchPendingMerges();
    }, 60000);

    return () => clearInterval(interval);
  }, [isOpen]);

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
              <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-[#1F2937] shadow-xl transition-all border border-gray-600">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-600">
                  <Dialog.Title className="text-xl font-bold text-white flex items-center gap-2">
                    <ClockIcon className="h-6 w-6 text-yellow-400" />
                    الدمجات المعلقة
                  </Dialog.Title>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={fetchPendingMerges}
                      className="p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-gray-700"
                      title="تحديث"
                    >
                      <ArrowPathIcon className="h-5 w-5" />
                    </button>
                    <button
                      onClick={onClose}
                      className="p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-gray-700"
                    >
                      <XMarkIcon className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                {/* Info Box */}
                <div className="mx-6 mt-4 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
                  <p className="text-sm text-yellow-400">
                    يمكنك فك الدمج واسترجاع الحسابات المدمجة خلال 24 ساعة من وقت الدمج.
                    بعد انتهاء المهلة، يصبح الدمج نهائياً.
                  </p>
                </div>

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

                {/* Merges List */}
                <div className="p-6 max-h-[400px] overflow-y-auto scrollbar-hide">
                  {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-12">
                      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mb-4"></div>
                      <p className="text-gray-400">جاري التحميل...</p>
                    </div>
                  ) : merges.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12">
                      <CheckCircleIcon className="h-16 w-16 text-green-500 mb-4" />
                      <p className="text-gray-400 text-lg mb-2">لا توجد دمجات معلقة</p>
                      <p className="text-gray-500 text-sm">جميع الدمجات السابقة أصبحت نهائية</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {merges.map((merge) => {
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
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
