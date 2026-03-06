'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../supabase/client'

export interface SupplierGroup {
  id: string
  name: string
  parent_id: string | null
  is_active: boolean | null
  sort_order: number | null
  created_at: string | null
  updated_at: string | null
  children?: SupplierGroup[]
  isExpanded?: boolean
  level?: number
  isDefault?: boolean
}

export function useSupplierGroups() {
  const [groups, setGroups] = useState<SupplierGroup[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const buildHierarchy = (flatGroups: SupplierGroup[]): SupplierGroup[] => {
    console.log('Building supplier groups hierarchy from:', flatGroups)
    
    // Find the "موردين" category
    const suppliersCategory = flatGroups.find(group => group.name === 'موردين' && group.is_active)
    console.log('Suppliers category found:', suppliersCategory)
    
    const groupMap = new Map<string, SupplierGroup>()
    const rootGroups: SupplierGroup[] = []

    // Initialize all groups in the map
    flatGroups.forEach(group => {
      groupMap.set(group.id, { 
        ...group, 
        children: [], 
        isExpanded: true,
        isDefault: group.name === 'موردين'
      })
    })

    // Build hierarchy
    flatGroups.forEach(group => {
      const groupWithChildren = groupMap.get(group.id)!
      
      if (group.parent_id) {
        const parent = groupMap.get(group.parent_id)
        if (parent) {
          parent.children!.push(groupWithChildren)
        }
      } else {
        rootGroups.push(groupWithChildren)
      }
    })

    // If "موردين" exists, ensure it's the root and expanded
    if (suppliersCategory) {
      const suppliersRoot = groupMap.get(suppliersCategory.id)
      if (suppliersRoot) {
        suppliersRoot.isExpanded = true
        suppliersRoot.isDefault = true
        console.log('Setting موردين as root:', suppliersRoot)
        return [suppliersRoot]
      }
    } else {
      // If "موردين" doesn't exist, create it as a virtual root
      const allOtherGroups = rootGroups.filter(group => group.name !== 'موردين')
      const virtualSuppliersRoot: SupplierGroup = {
        id: 'suppliers-root',
        name: 'موردين',
        parent_id: null,
        is_active: true,
        sort_order: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        children: allOtherGroups,
        isExpanded: true,
        isDefault: true
      }
      console.log('Creating virtual موردين root:', virtualSuppliersRoot)
      return [virtualSuppliersRoot]
    }

    return rootGroups
  }

  const fetchGroups = async () => {
    try {
      setIsLoading(true)
      const { data, error } = await supabase
        .from('supplier_groups')
        .select('*')
        .or('is_active.is.null,is_active.eq.true')
        .order('sort_order', { ascending: true, nullsFirst: false })

      if (error) throw error

      const hierarchicalGroups = buildHierarchy(data || [])
      setGroups(hierarchicalGroups)
      setError(null)
    } catch (err) {
      console.error('Error fetching supplier groups:', err)
      setError('فشل في تحميل مجموعات الموردين')
      setGroups([])
    } finally {
      setIsLoading(false)
    }
  }

  const handleGroupChange = (payload: any) => {
    console.log('Supplier group change:', payload)
    // Refetch to rebuild hierarchy properly
    fetchGroups()
  }

  useEffect(() => {
    fetchGroups()

    // Subscribe to real-time changes - exactly like useCustomerGroups
    const subscription = supabase
      .channel('supplier_groups')
      .on('postgres_changes', 
        { event: '*', schema: 'elfaroukgroup', table: 'supplier_groups' },
        handleGroupChange
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const toggleGroupExpansion = (groupId: string, groupsList: SupplierGroup[] = groups): SupplierGroup[] => {
    return groupsList.map(group => {
      if (group.id === groupId) {
        return { ...group, isExpanded: !group.isExpanded }
      }
      if (group.children && group.children.length > 0) {
        return { ...group, children: toggleGroupExpansion(groupId, group.children) }
      }
      return group
    })
  }

  const toggleGroup = (groupId: string) => {
    setGroups(prev => toggleGroupExpansion(groupId, prev))
  }

  // Function to flatten the hierarchy for dropdown usage
  const getFlatGroupsList = (groupsList: SupplierGroup[] = groups): SupplierGroup[] => {
    const flatList: SupplierGroup[] = []
    
    const traverse = (groups: SupplierGroup[], level = 0) => {
      groups.forEach(group => {
        flatList.push({ ...group, level })
        if (group.children && group.children.length > 0) {
          traverse(group.children, level + 1)
        }
      })
    }
    
    traverse(groupsList)
    return flatList
  }

  return {
    groups,
    isLoading,
    error,
    refetch: fetchGroups,
    toggleGroup,
    getFlatGroupsList
  }
}