'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../supabase/client'

export interface Branch {
  id: string
  name: string
  name_en: string | null
  address: string
  phone: string
  manager_id: string | null
  is_active: boolean | null
  created_at: string | null
  updated_at: string | null
  allow_variants: boolean
}

export interface BranchInventory {
  branch_id: string
  product_id: string
  quantity: number
  min_stock?: number
}

export interface ProductVariant {
  id: string
  product_id: string
  branch_id: string
  variant_type: 'color' | 'shape' | 'size'
  name: string
  value: string
  quantity: number
  created_at: string
  updated_at: string
}

export function useBranches() {
  const [branches, setBranches] = useState<Branch[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchBranches = async () => {
    try {
      setIsLoading(true)
      const { data, error } = await supabase
        .from('branches')
        .select('*')
        .eq('is_active', true)
        .order('name', { ascending: true })

      if (error) throw error

      setBranches(data || [])
      setError(null)
    } catch (err) {
      console.error('Error fetching branches:', err)
      setError('فشل في تحميل الفروع')
    } finally {
      setIsLoading(false)
    }
  }

  const fetchBranchInventory = async (productId: string) => {
    try {
      const { data, error } = await supabase
        .from('inventory')
        .select('branch_id, quantity, min_stock')
        .eq('product_id', productId)

      if (error) throw error

      return (data || []).reduce((acc, item) => {
        if (item.branch_id) {
          acc[item.branch_id] = {
            quantity: item.quantity,
            min_stock: item.min_stock || 0
          }
        }
        return acc
      }, {} as Record<string, { quantity: number, min_stock: number }>)
    } catch (err) {
      console.error('Error fetching branch inventory:', err)
      return {}
    }
  }

  const fetchProductVariants = async (productId: string, branchId?: string) => {
    try {
      // Step 1: Get color/shape definitions for this product
      const { data: variantDefs, error: defsError } = await supabase
        .from('product_color_shape_definitions')
        .select('*')
        .eq('product_id', productId)

      if (defsError) throw defsError

      if (!variantDefs || variantDefs.length === 0) {
        return []
      }

      // Step 2: Get quantities for these definitions
      const defIds = variantDefs.map(d => d.id)
      let quantitiesQuery = supabase
        .from('product_variant_quantities')
        .select('*')
        .in('variant_definition_id', defIds)

      if (branchId) {
        quantitiesQuery = quantitiesQuery.eq('branch_id', branchId)
      }

      const { data: quantities, error: quantitiesError } = await quantitiesQuery

      if (quantitiesError) throw quantitiesError

      // Step 3: Merge definitions with quantities to match old format
      const variants = variantDefs.flatMap(def => {
        const defQuantities = (quantities || []).filter(q => q.variant_definition_id === def.id)

        if (defQuantities.length === 0) {
          return [{
            id: def.id,
            product_id: def.product_id,
            variant_type: def.variant_type,
            name: def.name,
            quantity: 0,
            color_hex: def.color_hex,
            color_name: def.name,
            image_url: def.image_url,
            branch_id: null
          }]
        }

        return defQuantities.map(q => ({
          id: def.id,
          product_id: def.product_id,
          variant_type: def.variant_type,
          name: def.name,
          quantity: q.quantity,
          color_hex: def.color_hex,
          color_name: def.name,
          image_url: def.image_url,
          branch_id: q.branch_id
        }))
      })

      return variants
    } catch (err) {
      console.error('Error fetching product variants:', err)
      return []
    }
  }

  const handleBranchChange = (payload: any) => {
    if (payload.eventType === 'INSERT') {
      setBranches(prev => [...prev, payload.new])
    } else if (payload.eventType === 'UPDATE') {
      setBranches(prev => prev.map(branch => 
        branch.id === payload.new.id ? payload.new : branch
      ))
    } else if (payload.eventType === 'DELETE') {
      setBranches(prev => prev.filter(branch => branch.id !== payload.old.id))
    }
  }

  useEffect(() => {
    fetchBranches()

    // Subscribe to real-time changes
    const subscription = supabase
      .channel('branches')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'branches' },
        handleBranchChange
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  return {
    branches,
    isLoading,
    error,
    refetch: fetchBranches,
    fetchBranchInventory,
    fetchProductVariants
  }
}