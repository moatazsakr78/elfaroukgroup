'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../supabase/client'

export interface SelectionData {
  record: any | null
  customer: any | null
  branch: any | null
}

const STORAGE_KEY = 'pos_selections'

export function usePersistentSelections(userProfileBranchId?: string | null) {
  const [selections, setSelections] = useState<SelectionData>({
    record: null,
    customer: null,
    branch: null
  })

  const [isLoaded, setIsLoaded] = useState(false)
  const [defaultCustomer, setDefaultCustomer] = useState<any>(null)
  const [defaultBranch, setDefaultBranch] = useState<any>(null)

  // Load default customer from database
  // البحث عن العميل الافتراضي بناءً على الاسم "عميل"
  const loadDefaultCustomer = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('name', 'عميل')
        .maybeSingle()

      if (error) {
        console.error('Error loading default customer:', error)
        return null
      }

      return data
    } catch (error) {
      console.error('Error in loadDefaultCustomer:', error)
      return null
    }
  }

  // Load default branch for the user
  // الأولوية: 1. فرع الموظف من user_profiles 2. الفرع الافتراضي 3. أول فرع نشط
  const loadDefaultBranch = async (userBranchId?: string | null) => {
    try {
      // 1. إذا كان الموظف مرتبط بفرع، جلبه
      if (userBranchId) {
        const { data: userBranch, error: userBranchError } = await supabase
          .from('branches')
          .select('id, name, address, phone, is_active, is_default')
          .eq('id', userBranchId)
          .eq('is_active', true)
          .single()

        if (!userBranchError && userBranch) {
          return userBranch
        }
      }

      // 2. جلب الفرع الافتراضي
      const { data: defaultBranchData, error: defaultError } = await supabase
        .from('branches')
        .select('id, name, address, phone, is_active, is_default')
        .eq('is_default', true)
        .eq('is_active', true)
        .single()

      if (!defaultError && defaultBranchData) {
        return defaultBranchData
      }

      // 3. جلب أول فرع نشط
      const { data: firstBranch, error: firstError } = await supabase
        .from('branches')
        .select('id, name, address, phone, is_active, is_default')
        .eq('is_active', true)
        .order('created_at', { ascending: true })
        .limit(1)
        .single()

      if (!firstError && firstBranch) {
        return firstBranch
      }

      return null
    } catch (error) {
      console.error('Error in loadDefaultBranch:', error)
      return null
    }
  }

  // Refresh record data from database to get latest name
  const refreshRecordData = async (recordId: string) => {
    try {
      const { data, error } = await supabase
        .from('records')
        .select(`
          id,
          name,
          branch_id,
          is_primary,
          is_active,
          branch:branches(name)
        `)
        .eq('id', recordId)
        .single()

      if (error) {
        console.error('Error refreshing record data:', error)
        return null
      }

      return data
    } catch (error) {
      console.error('Error in refreshRecordData:', error)
      return null
    }
  }

  // Load from localStorage on mount
  useEffect(() => {
    const initializeSelections = async () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY)
        let loadedSelections: SelectionData = {
          record: null,
          customer: null,
          branch: null
        }

        if (stored) {
          loadedSelections = JSON.parse(stored)
        }

        // Always ensure default customer is set if no customer is selected
        const defaultCust = await loadDefaultCustomer()
        if (defaultCust) {
          setDefaultCustomer(defaultCust) // Store default customer for later use
          if (!loadedSelections.customer) {
            loadedSelections.customer = defaultCust
          }
        }

        // تحميل الفرع الافتراضي للموظف
        // الأولوية: 1. فرع الموظف 2. الفرع الافتراضي 3. أول فرع
        const defaultBranchData = await loadDefaultBranch(userProfileBranchId)
        if (defaultBranchData) {
          setDefaultBranch(defaultBranchData)
          // إذا لم يكن هناك فرع محدد مسبقاً، استخدم الافتراضي
          if (!loadedSelections.branch) {
            loadedSelections.branch = defaultBranchData
          }
        }

        // Refresh record data from database to get latest name
        if (loadedSelections.record && loadedSelections.record.id) {
          const freshRecordData = await refreshRecordData(loadedSelections.record.id)
          if (freshRecordData) {
            loadedSelections.record = freshRecordData
          }
        }

        setSelections(loadedSelections)
      } catch (error) {
        console.error('Error loading selections from localStorage:', error)
        // Even if there's an error, try to load the default customer and branch
        const defaultCustomer = await loadDefaultCustomer()
        const defaultBranchData = await loadDefaultBranch(userProfileBranchId)
        if (defaultCustomer || defaultBranchData) {
          setSelections(prev => ({
            ...prev,
            customer: defaultCustomer || prev.customer,
            branch: defaultBranchData || prev.branch
          }))
        }
      } finally {
        setIsLoaded(true)
      }
    }

    initializeSelections()
  }, [userProfileBranchId])

  // Save to localStorage whenever selections change
  useEffect(() => {
    if (isLoaded) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(selections))
      } catch (error) {
        console.error('Error saving selections to localStorage:', error)
      }
    }
  }, [selections, isLoaded])

  const setRecord = (record: any) => {
    setSelections(prev => ({ ...prev, record }))
  }

  const setCustomer = (customer: any) => {
    setSelections(prev => ({ ...prev, customer }))
  }

  const setBranch = (branch: any) => {
    setSelections(prev => ({ ...prev, branch }))
  }

  const clearSelections = () => {
    setSelections({
      record: null,
      customer: null,
      branch: null
    })
  }

  // Reset customer to default customer
  const resetToDefaultCustomer = async () => {
    const defaultCustomer = await loadDefaultCustomer()
    if (defaultCustomer) {
      setSelections(prev => ({ ...prev, customer: defaultCustomer }))
    }
  }

  const isComplete = () => {
    return selections.record && selections.customer && selections.branch
  }

  const hasRequiredForCart = () => {
    // At minimum, branch must be selected for cart operations
    return selections.branch !== null
  }

  const hasRequiredForSale = () => {
    // All three selections required for completing sale
    return selections.record && selections.customer && selections.branch
  }

  return {
    selections,
    isLoaded,
    setRecord,
    setCustomer,
    setBranch,
    clearSelections,
    resetToDefaultCustomer,
    isComplete,
    hasRequiredForCart,
    hasRequiredForSale,
    defaultCustomer, // Export default customer for use in new tabs
    defaultBranch    // Export default branch for POS
  }
}