"use client";

import { Fragment, useState, useEffect } from "react";
import { Dialog, Transition } from "@headlessui/react";
import {
  XMarkIcon,
  UserIcon,
  MagnifyingGlassIcon,
  CheckIcon,
  UsersIcon,
} from "@heroicons/react/24/outline";
import { StarIcon as StarIconSolid } from "@heroicons/react/24/solid";
import { supabase } from "../lib/supabase/client";

interface Customer {
  id: string;
  name: string;
  phone: string | null;
  city: string | null;
  opening_balance: number | null;
  calculated_balance: number; // Calculated: opening_balance + sales - payments + loans
  rank: string | null;
  category: string | null;
  loyalty_points: number | null;
  is_active: boolean | null;
  group_id: string | null;
}

interface CustomerGroup {
  id: string;
  name: string;
  parent_id: string | null;
  count: number;
  isSelected?: boolean;
  is_active: boolean | null;
  sort_order: number | null;
}

interface CustomerSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCustomer?: (customer: Customer) => void;
}

export default function CustomerSelectionModal({
  isOpen,
  onClose,
  onSelectCustomer,
}: CustomerSelectionModalProps) {
  const [selectedGroup, setSelectedGroup] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerGroups, setCustomerGroups] = useState<CustomerGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch customers and customer groups from database
  const fetchCustomers = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch customers with opening_balance
      const { data: customersData, error: customersError } = await supabase
        .from("customers")
        .select("id, name, phone, city, opening_balance, rank, category, loyalty_points, is_active, group_id")
        .eq("is_active", true)
        .order("name", { ascending: true });

      if (customersError) {
        console.error("Error fetching customers:", customersError);
        setError("فشل في تحميل العملاء");
        return;
      }

      // Fetch all sales for balance calculation
      const { data: salesData } = await supabase
        .from("sales")
        .select("customer_id, total_amount");

      // Fetch all customer payments for balance calculation (includes notes to identify loans)
      const { data: paymentsData } = await supabase
        .from("customer_payments")
        .select("customer_id, amount, notes");

      // Calculate balance for each customer
      const customersWithBalance = (customersData || []).map((customer) => {
        const openingBalance = customer.opening_balance || 0;

        // Sum of all sales for this customer
        const salesBalance = (salesData || [])
          .filter((sale) => sale.customer_id === customer.id)
          .reduce((total, sale) => total + (sale.total_amount || 0), 0);

        // Calculate payments with proper handling for loans vs regular payments
        // السلفة (loan) = adds to balance (customer owes more) - identified by notes starting with "سلفة"
        // الدفعة (payment) = reduces balance (customer paid their debt)
        let totalLoans = 0;
        let totalRegularPayments = 0;

        (paymentsData || [])
          .filter((p) => p.customer_id === customer.id)
          .forEach((payment) => {
            const isLoan = payment.notes?.startsWith('سلفة');
            if (isLoan) {
              totalLoans += (payment.amount || 0);
            } else {
              totalRegularPayments += (payment.amount || 0);
            }
          });

        // Final balance = opening + sales + loans - payments
        const calculatedBalance = openingBalance + salesBalance + totalLoans - totalRegularPayments;

        return {
          ...customer,
          calculated_balance: calculatedBalance,
        };
      });

      setCustomers(customersWithBalance);

      // Fetch customer groups with customer counts
      const { data: groupsData, error: groupsError } = await supabase
        .from("customer_groups")
        .select(`id, name, parent_id, is_active, sort_order`)
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });

      if (groupsError) {
        console.error("Error fetching customer groups:", groupsError);
        setError("فشل في تحميل مجموعات العملاء");
        return;
      }

      // Calculate customer counts per group
      const groups = (groupsData || []).map((group) => {
        const customerCount = (customersData || []).filter(
          (c) => c.group_id === group.id
        ).length;
        return {
          ...group,
          count: customerCount,
        };
      });

      // Add "All Customers" group at the beginning
      const allCustomersGroup = {
        id: "all",
        name: "جميع العملاء",
        parent_id: null,
        count: (customersData || []).length,
        isSelected: true,
        is_active: true,
        sort_order: -1,
      };

      setCustomerGroups([allCustomersGroup, ...groups]);
    } catch (error) {
      console.error("Error fetching data:", error);
      setError("حدث خطأ أثناء تحميل البيانات");
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch customers when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchCustomers();
      setSearchQuery("");
      setSelectedGroup("all");
    }
  }, [isOpen]);

  const handleSelect = (customer: Customer) => {
    if (onSelectCustomer) {
      onSelectCustomer(customer);
    }
    onClose();
  };

  const getRankColor = (rank: string | null) => {
    switch (rank) {
      case "immortal":
        return "text-red-500";
      case "vip":
        return "text-yellow-500";
      case "gold":
        return "text-yellow-600";
      case "silver":
        return "text-gray-400";
      case "bronze":
        return "text-orange-600";
      default:
        return "text-gray-400";
    }
  };

  // Check if customer is the default customer
  const isDefaultCustomer = (customer: Customer) => customer.name === "عميل";

  // Filter and sort customers - default customer first
  const filteredCustomers = customers
    .filter((customer) => {
      const matchesSearch =
        searchQuery === "" ||
        customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (customer.phone && customer.phone.includes(searchQuery)) ||
        (customer.city && customer.city.includes(searchQuery));

      if (selectedGroup === "all") return matchesSearch;

      // Filter by specific customer group
      return matchesSearch && customer.group_id === selectedGroup;
    })
    .sort((a, b) => {
      // Default customer always first
      if (isDefaultCustomer(a)) return -1;
      if (isDefaultCustomer(b)) return 1;
      return a.name.localeCompare(b.name, "ar");
    });

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
                    <UserIcon className="h-6 w-6 text-blue-400" />
                    اختيار عميل
                  </Dialog.Title>
                  <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-gray-700"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>

                {/* Search */}
                <div className="p-4 border-b border-gray-600">
                  <div className="relative">
                    <MagnifyingGlassIcon className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="البحث عن عميل بالاسم أو الهاتف..."
                      className="w-full pl-4 pr-12 py-3 bg-[#2B3544] border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      autoFocus
                    />
                  </div>

                  {/* Customer Groups */}
                  {customerGroups.length > 1 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {customerGroups.map((group) => (
                        <button
                          key={group.id}
                          onClick={() => setSelectedGroup(group.id)}
                          className={`px-3 py-1.5 rounded-lg text-sm transition-all flex items-center gap-1 ${
                            selectedGroup === group.id
                              ? "bg-blue-600 text-white"
                              : "bg-[#2B3544] text-gray-300 hover:bg-[#374151]"
                          }`}
                        >
                          <UsersIcon className="h-3.5 w-3.5" />
                          {group.name}
                          <span
                            className={`text-xs px-1.5 py-0.5 rounded-full ${
                              selectedGroup === group.id
                                ? "bg-blue-700"
                                : "bg-gray-600"
                            }`}
                          >
                            {group.count}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Customers List */}
                <div className="max-h-[400px] overflow-y-auto scrollbar-hide">
                  {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-12">
                      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mb-4"></div>
                      <p className="text-gray-400">جاري تحميل العملاء...</p>
                    </div>
                  ) : error ? (
                    <div className="flex flex-col items-center justify-center py-12">
                      <UserIcon className="h-12 w-12 text-red-500 mb-4" />
                      <p className="text-red-400 mb-2">{error}</p>
                      <button
                        onClick={fetchCustomers}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors"
                      >
                        إعادة المحاولة
                      </button>
                    </div>
                  ) : filteredCustomers.length > 0 ? (
                    <div className="p-2 space-y-1">
                      {filteredCustomers.map((customer) => (
                        <button
                          key={customer.id}
                          onClick={() => handleSelect(customer)}
                          className={`w-full flex items-center justify-between p-4 rounded-xl transition-all border-2 hover:border-gray-500 ${
                            isDefaultCustomer(customer)
                              ? "bg-green-500/10 border-green-500/30 hover:bg-green-500/20"
                              : "bg-[#2B3544] border-transparent hover:bg-[#374151]"
                          } text-gray-200`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                              isDefaultCustomer(customer) ? "bg-green-500/20" : "bg-[#374151]"
                            }`}>
                              <UserIcon className={`h-5 w-5 ${isDefaultCustomer(customer) ? "text-green-400" : ""}`} />
                            </div>
                            <div className="text-right">
                              <div className="font-semibold flex items-center gap-2">
                                {customer.name}
                                {isDefaultCustomer(customer) && (
                                  <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-lg">
                                    افتراضي
                                  </span>
                                )}
                                {customer.rank && (
                                  <StarIconSolid
                                    className={`h-4 w-4 ${getRankColor(customer.rank)}`}
                                  />
                                )}
                              </div>
                              <div className="text-sm text-gray-400 flex items-center gap-3">
                                {customer.phone && <span>{customer.phone}</span>}
                                {customer.city && (
                                  <span className="text-gray-500">
                                    {customer.city}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="text-left">
                            <div
                              className={`font-medium ${
                                customer.calculated_balance > 0
                                  ? "text-green-400"
                                  : customer.calculated_balance < 0
                                  ? "text-red-400"
                                  : "text-gray-400"
                              }`}
                            >
                              {customer.calculated_balance.toLocaleString()}{" "}
                              ج.م
                            </div>
                            {customer.loyalty_points && customer.loyalty_points > 0 && (
                              <div className="text-xs text-yellow-500">
                                {customer.loyalty_points} نقطة
                              </div>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12">
                      <UserIcon className="h-12 w-12 text-gray-500 mb-4" />
                      <p className="text-gray-400 mb-2">لا توجد عملاء</p>
                      <p className="text-gray-500 text-sm">
                        جرب تغيير معايير البحث
                      </p>
                    </div>
                  )}
                </div>

                {/* Footer Note */}
                <div className="p-4 border-t border-gray-600 bg-[#2B3544]">
                  <p className="text-sm text-gray-400 text-center">
                    اضغط على العميل لاختياره • إجمالي العملاء:{" "}
                    {filteredCustomers.length}
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
