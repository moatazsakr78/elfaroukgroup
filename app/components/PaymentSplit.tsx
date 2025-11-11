'use client'

import { useState, useEffect } from 'react'
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
}

interface PaymentSplitProps {
  totalAmount: number
  onPaymentsChange: (payments: PaymentEntry[], creditAmount: number) => void
}

export default function PaymentSplit({ totalAmount, onPaymentsChange }: PaymentSplitProps) {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [payments, setPayments] = useState<PaymentEntry[]>([
    {
      id: '1',
      amount: totalAmount,
      paymentMethodId: ''
    }
  ])

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
        setPayments(updatedPayments)
      }
    }
  }, [paymentMethods])

  // Update first payment amount when total changes
  useEffect(() => {
    if (payments.length === 1) {
      const updatedPayments = [...payments]
      updatedPayments[0].amount = totalAmount
      setPayments(updatedPayments)
    }
  }, [totalAmount])

  // Notify parent component when payments change
  useEffect(() => {
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0)
    const creditAmount = Math.max(0, totalAmount - totalPaid)
    onPaymentsChange(payments, creditAmount)
  }, [payments, totalAmount, onPaymentsChange])

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

  const handlePaymentMethodChange = (id: string, methodId: string) => {
    const updatedPayments = payments.map(p =>
      p.id === id ? { ...p, paymentMethodId: methodId } : p
    )
    setPayments(updatedPayments)
  }

  const addPaymentRow = () => {
    const newPayment: PaymentEntry = {
      id: Date.now().toString(),
      amount: 0,
      paymentMethodId: paymentMethods.find(m => m.name.toLowerCase() === 'cash')?.id || ''
    }
    setPayments([...payments, newPayment])
  }

  const removePaymentRow = (id: string) => {
    if (payments.length > 1) {
      setPayments(payments.filter(p => p.id !== id))
    }
  }

  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0)
  const creditAmount = Math.max(0, totalAmount - totalPaid)

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
                onChange={(e) => handleAmountChange(payment.id, e.target.value)}
                placeholder="المبلغ"
                className="w-full px-2 py-1 bg-gray-700 text-white rounded border border-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs h-[26px]"
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

            {/* Action Buttons */}
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
          </div>
        ))}
      </div>

      {/* Compact Summary - Only show if there's credit or multiple payments */}
      {(creditAmount > 0 || payments.length > 1) && (
        <div className="mt-2 pt-2 border-t border-gray-600 flex items-center justify-between text-xs">
          <div className="flex items-center gap-3">
            <span className="text-gray-400">مدفوع: <span className="text-green-400 font-medium">{totalPaid.toFixed(0)}</span></span>
            {creditAmount > 0 && (
              <span className="text-gray-400">آجل: <span className="text-orange-400 font-medium">{creditAmount.toFixed(0)}</span></span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
