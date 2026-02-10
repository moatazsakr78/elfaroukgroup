'use client'

import { useState, useEffect, useRef } from 'react'
import { PlusIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { supabase } from '../lib/supabase/client'

interface PaymentMethod {
  id: string
  name: string
  is_active: boolean | null
  is_default: boolean | null
}

interface PaymentEntry {
  id: string
  amount: number
  paymentMethodId: string
  paymentMethodName?: string
}

interface PaymentSplitProps {
  totalAmount: number
  onPaymentsChange: (payments: PaymentEntry[], creditAmount: number) => void
  isDefaultCustomer?: boolean // العميل الافتراضي - لا يسمح بالآجل
  isReturnMode?: boolean // وضع المرتجع
  isPurchaseMode?: boolean // وضع الشراء من المورد
}

// Default customer ID constant
const DEFAULT_CUSTOMER_ID = '00000000-0000-0000-0000-000000000001'

export default function PaymentSplit({ totalAmount, onPaymentsChange, isDefaultCustomer = false, isReturnMode = false, isPurchaseMode = false }: PaymentSplitProps) {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [payments, setPayments] = useState<PaymentEntry[]>([
    {
      id: '1',
      amount: totalAmount,
      paymentMethodId: ''
    }
  ])

  // Ref to store callback to avoid re-renders
  const onPaymentsChangeRef = useRef(onPaymentsChange)
  onPaymentsChangeRef.current = onPaymentsChange

  // Load payment methods from database
  useEffect(() => {
    loadPaymentMethods()
  }, [])

  // Set default payment method when methods are loaded
  useEffect(() => {
    if (paymentMethods.length > 0 && payments[0].paymentMethodId === '') {
      const defaultMethod = paymentMethods.find(m => m.name.toLowerCase() === 'cash')
      if (defaultMethod) {
        const updatedPayments = [...payments]
        updatedPayments[0].paymentMethodId = defaultMethod.id
        updatedPayments[0].paymentMethodName = defaultMethod.name
        setPayments(updatedPayments)
      }
    }
  }, [paymentMethods])

  // Update first payment amount when total changes - only for default customer
  useEffect(() => {
    // فقط للعميل الافتراضي نملأ المبلغ تلقائياً عند تغيير الإجمالي
    if (payments.length === 1 && isDefaultCustomer) {
      const updatedPayments = [...payments]
      updatedPayments[0].amount = totalAmount
      setPayments(updatedPayments)
    }
  }, [totalAmount, isDefaultCustomer])

  // Notify parent component when payments change
  useEffect(() => {
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0)
    // العميل الافتراضي: لا آجل - المبلغ المتبقي دائماً 0
    const creditAmount = isDefaultCustomer ? 0 : Math.max(0, totalAmount - totalPaid)
    onPaymentsChangeRef.current(payments, creditAmount)
  }, [payments, totalAmount, isDefaultCustomer])

  // Reset amount when customer type changes
  useEffect(() => {
    if (payments.length === 1) {
      const updatedPayments = [...payments]
      if (isDefaultCustomer) {
        // العميل الافتراضي: يدفع كامل المبلغ
        updatedPayments[0].amount = totalAmount
      } else {
        // عميل آجل أو مورد: يبدأ من صفر
        updatedPayments[0].amount = 0
      }
      setPayments(updatedPayments)
    }
  }, [isDefaultCustomer])

  const loadPaymentMethods = async () => {
    try {
      const { data, error } = await supabase
        .from('payment_methods')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error loading payment methods:', error)
        return
      }

      setPaymentMethods(data || [])
    } catch (error) {
      console.error('Error loading payment methods:', error)
    }
  }

  const handleAmountChange = (id: string, value: string) => {
    const numValue = parseFloat(value) || 0
    const updatedPayments = payments.map(p =>
      p.id === id ? { ...p, amount: numValue } : p
    )
    setPayments(updatedPayments)
  }

  // Handle keyboard arrows to toggle between 0 and full amount
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, paymentId: string) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault()
      const currentPayment = payments.find(p => p.id === paymentId)
      if (currentPayment) {
        // التبديل بين 0 ومبلغ الفاتورة الكامل
        const newAmount = currentPayment.amount === 0 ? totalAmount : 0
        handleAmountChange(paymentId, newAmount.toString())
      }
    }
  }

  const handlePaymentMethodChange = (id: string, methodId: string) => {
    const methodName = paymentMethods.find(m => m.id === methodId)?.name || ''
    const updatedPayments = payments.map(p =>
      p.id === id ? { ...p, paymentMethodId: methodId, paymentMethodName: methodName } : p
    )
    setPayments(updatedPayments)
  }

  const addPaymentRow = () => {
    const defaultMethod = paymentMethods.find(m => m.name.toLowerCase() === 'cash')
    const newPayment: PaymentEntry = {
      id: Date.now().toString(),
      amount: 0,
      paymentMethodId: defaultMethod?.id || '',
      paymentMethodName: defaultMethod?.name || 'cash'
    }
    setPayments([...payments, newPayment])
  }

  const removePaymentRow = (id: string) => {
    if (payments.length > 1) {
      setPayments(payments.filter(p => p.id !== id))
    }
  }

  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0)
  // العميل الافتراضي: لا آجل
  const creditAmount = isDefaultCustomer ? 0 : Math.max(0, totalAmount - totalPaid)

  return (
    <div className="mb-2">
      <div className="space-y-1.5">
        {payments.map((payment, index) => (
          <div key={payment.id} className="flex items-center gap-1.5">
            {/* Amount Input */}
            <div className="flex-1">
              <input
                type="number"
                value={payment.amount}
                onChange={(e) => !isDefaultCustomer ? handleAmountChange(payment.id, e.target.value) : undefined}
                readOnly={isDefaultCustomer}
                onFocus={(e) => e.target.select()}
                onKeyDown={(e) => !isDefaultCustomer ? handleKeyDown(e, payment.id) : undefined}
                placeholder={isReturnMode ? "مبلغ المرتجع" : isPurchaseMode ? "المبلغ المدفوع للمورد" : "المبلغ"}
                className={`w-full px-2 py-1 text-white rounded border focus:outline-none focus:ring-1 text-xs h-[26px] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${
                  isDefaultCustomer
                    ? "bg-gray-800 border-gray-700 cursor-not-allowed opacity-75"
                    : isReturnMode
                    ? "bg-gray-700 border-red-500 focus:ring-red-500 text-red-400"
                    : isPurchaseMode
                    ? "bg-gray-700 border-purple-500 focus:ring-purple-500"
                    : "bg-gray-700 border-gray-600 focus:ring-blue-500"
                }`}
                style={{ MozAppearance: 'textfield' }}
                min="0"
                step="0.01"
              />
            </div>

            {/* Payment Method Select */}
            <div className="flex-1">
              <select
                value={payment.paymentMethodId}
                onChange={(e) => handlePaymentMethodChange(payment.id, e.target.value)}
                className="w-full px-2 py-1 bg-gray-700 text-white rounded border border-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs h-[26px] appearance-none"
                style={{ lineHeight: '1' }}
              >
                <option value="">طريقة الدفع</option>
                {paymentMethods.map((method) => (
                  <option key={method.id} value={method.id}>
                    {method.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Action Buttons - مخفية للعميل الافتراضي */}
            {!isDefaultCustomer && (
              <div className="flex items-center gap-0.5">
                {/* Add Button (only show on last row) */}
                {index === payments.length - 1 && (
                  <button
                    onClick={addPaymentRow}
                    className="p-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                    title="إضافة"
                  >
                    <PlusIcon className="h-3 w-3" />
                  </button>
                )}

                {/* Remove Button (only show if more than one payment) */}
                {payments.length > 1 && (
                  <button
                    onClick={() => removePaymentRow(payment.id)}
                    className="p-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                    title="حذف"
                  >
                    <XMarkIcon className="h-3 w-3" />
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Compact Summary - Only show if there's credit or multiple payments */}
      {(creditAmount > 0 || payments.length > 1) && !isDefaultCustomer && (
        <div className="mt-2 pt-2 border-t border-gray-600 flex items-center justify-between text-xs">
          <div className="flex items-center gap-3">
            <span className="text-gray-400">
              {isPurchaseMode ? "مدفوع للمورد: " : "مدفوع: "}
              <span className={`font-medium ${isPurchaseMode ? "text-purple-400" : "text-green-400"}`}>{totalPaid.toFixed(0)}</span>
            </span>
            {creditAmount > 0 && (
              <span className="text-gray-400">
                {isPurchaseMode ? "متبقي للمورد: " : "آجل: "}
                <span className="text-orange-400 font-medium">{creditAmount.toFixed(0)}</span>
              </span>
            )}
          </div>
        </div>
      )}

    </div>
  )
}
