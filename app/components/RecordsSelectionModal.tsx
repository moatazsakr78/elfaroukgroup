"use client";

import { Fragment, useState, useEffect } from "react";
import { Dialog, Transition } from "@headlessui/react";
import {
  XMarkIcon,
  BanknotesIcon,
  BuildingOfficeIcon,
} from "@heroicons/react/24/outline";
import { StarIcon as StarIconSolid } from "@heroicons/react/24/solid";
import { supabase } from "../lib/supabase/client";

interface Record {
  id: string;
  name: string;
  branch_id?: string | null;
  is_primary: boolean | null;
  is_active: boolean | null;
  parent_id: string | null;
  safe_type: string | null;
  supports_drawers: boolean | null;
  branch?: {
    name: string;
  } | null;
}

interface RecordsSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectRecord?: (record: any, subSafe?: any) => void;
}

export default function RecordsSelectionModal({
  isOpen,
  onClose,
  onSelectRecord,
}: RecordsSelectionModalProps) {
  const [records, setRecords] = useState<Record[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRecords = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from("records")
        .select(
          `
          id,
          name,
          branch_id,
          is_primary,
          is_active,
          parent_id,
          safe_type,
          supports_drawers,
          branch:branches(name)
        `
        )
        .eq("is_active", true)
        .order("is_primary", { ascending: false })
        .order("name", { ascending: true });

      if (error) {
        console.error("Error fetching records:", error);
        setError("فشل في تحميل الخزن");
        return;
      }

      setRecords(data || []);
    } catch (error) {
      console.error("Error fetching records:", error);
      setError("حدث خطأ أثناء تحميل الخزن");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchRecords();
    }
  }, [isOpen]);

  // Group records: main safes with their children
  const mainRecords = records.filter((s) => s.safe_type !== "sub");
  const getChildren = (parentId: string) =>
    records.filter((s) => s.parent_id === parentId && s.safe_type === "sub");

  const recordsWithDrawers = mainRecords.filter(
    (s) => s.supports_drawers && getChildren(s.id).length > 0
  );
  const recordsWithoutDrawers = mainRecords.filter(
    (s) => !s.supports_drawers || getChildren(s.id).length === 0
  );

  const handleSelectSubSafe = (mainRecord: Record, subSafe: Record) => {
    if (onSelectRecord) {
      onSelectRecord(mainRecord, subSafe);
    }
    onClose();
  };

  const handleSelectMainRecord = (record: Record) => {
    if (onSelectRecord) {
      onSelectRecord(record);
    }
    onClose();
  };

  const handleNoSafeSelect = () => {
    if (onSelectRecord) {
      onSelectRecord({
        id: null as any,
        name: "لا يوجد",
        branch_id: null,
        is_primary: false,
        is_active: true,
        parent_id: null,
        safe_type: null,
        branch: null,
      });
    }
    onClose();
  };

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
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-[#1F2937] p-6 shadow-xl transition-all border border-gray-600">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <Dialog.Title className="text-xl font-bold text-white flex items-center gap-2">
                    <BanknotesIcon className="h-6 w-6 text-blue-400" />
                    اختيار الدرج / الخزنة
                  </Dialog.Title>
                  <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-gray-700"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>

                {/* Selection List */}
                <div className="space-y-2 max-h-[400px] overflow-y-auto scrollbar-hide">
                  {/* "No Safe" Option */}
                  <button
                    onClick={handleNoSafeSelect}
                    className="w-full flex items-center justify-between p-4 rounded-xl transition-all bg-[#374151] text-gray-200 border-2 border-dashed border-gray-500 hover:bg-[#4B5563] hover:border-gray-400"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#2B3544] flex items-center justify-center">
                        <XMarkIcon className="h-5 w-5 text-gray-400" />
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-gray-300">
                          لا يوجد
                        </div>
                        <div className="text-sm text-gray-500">
                          بدون تأثير على أي خزنة
                        </div>
                      </div>
                    </div>
                    <span className="text-xs bg-gray-600/50 text-gray-400 px-2 py-1 rounded-lg">
                      اختياري
                    </span>
                  </button>

                  {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-12">
                      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mb-4"></div>
                      <p className="text-gray-400">جاري تحميل الخزن...</p>
                    </div>
                  ) : error ? (
                    <div className="flex flex-col items-center justify-center py-12">
                      <BanknotesIcon className="h-12 w-12 text-red-500 mb-4" />
                      <p className="text-red-400 mb-2">{error}</p>
                      <button
                        onClick={fetchRecords}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors"
                      >
                        إعادة المحاولة
                      </button>
                    </div>
                  ) : records.length > 0 ? (
                    <>
                      {/* Records WITH drawers */}
                      {recordsWithDrawers.map((mainRecord) => {
                        const children = getChildren(mainRecord.id);
                        return (
                          <div key={mainRecord.id}>
                            <div className="flex items-center gap-2 px-3 py-2 mt-2">
                              <div className="h-px flex-1 bg-gray-600"></div>
                              <span className="text-xs text-gray-400 font-medium flex items-center gap-1">
                                <BanknotesIcon className="h-3.5 w-3.5" />
                                {mainRecord.name}
                                {mainRecord.is_primary && (
                                  <StarIconSolid className="h-3 w-3 text-yellow-500" />
                                )}
                              </span>
                              <div className="h-px flex-1 bg-gray-600"></div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 px-1">
                              {children.map((child) => (
                                <button
                                  key={child.id}
                                  onClick={() =>
                                    handleSelectSubSafe(mainRecord, child)
                                  }
                                  className="flex items-center gap-2 p-3 rounded-xl transition-all bg-[#2B3544] text-gray-200 border-2 border-transparent hover:bg-[#374151] hover:border-cyan-500/50"
                                >
                                  <div className="w-8 h-8 rounded-full bg-cyan-600/20 flex items-center justify-center flex-shrink-0">
                                    <span className="text-cyan-400 text-xs font-bold">
                                      #
                                    </span>
                                  </div>
                                  <div className="text-right min-w-0">
                                    <div className="font-medium text-sm truncate">
                                      {child.name}
                                    </div>
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })}

                      {/* Records WITHOUT drawers */}
                      {recordsWithoutDrawers.length > 0 && (
                        <>
                          {recordsWithDrawers.length > 0 && (
                            <div className="flex items-center gap-2 px-3 py-2 mt-2">
                              <div className="h-px flex-1 bg-gray-600"></div>
                              <span className="text-xs text-gray-400 font-medium">
                                خزن بدون أدراج
                              </span>
                              <div className="h-px flex-1 bg-gray-600"></div>
                            </div>
                          )}
                          {recordsWithoutDrawers.map((record) => (
                            <button
                              key={record.id}
                              onClick={() => handleSelectMainRecord(record)}
                              className="w-full flex items-center justify-between p-4 rounded-xl transition-all bg-[#2B3544] text-gray-200 border-2 border-transparent hover:bg-[#374151] hover:border-gray-500"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-[#374151] flex items-center justify-center">
                                  <BanknotesIcon className="h-5 w-5" />
                                </div>
                                <div className="text-right">
                                  <div className="font-semibold flex items-center gap-2">
                                    {record.name}
                                    {record.is_primary && (
                                      <StarIconSolid className="h-4 w-4 text-yellow-500" />
                                    )}
                                  </div>
                                  {record.branch?.name && (
                                    <div className="text-sm text-gray-400 flex items-center gap-1">
                                      <BuildingOfficeIcon className="h-3.5 w-3.5" />
                                      {record.branch.name}
                                    </div>
                                  )}
                                </div>
                              </div>
                              {record.is_primary && (
                                <span className="text-xs bg-yellow-500/20 text-yellow-500 px-2 py-1 rounded-lg">
                                  رئيسي
                                </span>
                              )}
                            </button>
                          ))}
                        </>
                      )}
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12">
                      <BanknotesIcon className="h-12 w-12 text-gray-500 mb-4" />
                      <p className="text-gray-400 mb-2">لا توجد خزن نشطة</p>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="mt-6 p-3 bg-[#2B3544] rounded-lg">
                  <p className="text-sm text-gray-400 text-center">
                    اضغط على الدرج أو الخزنة لاختيارها
                  </p>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
