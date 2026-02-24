import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Simple Supabase client setup with elfaroukgroup schema
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    db: { schema: 'elfaroukgroup' }
  }
)

export async function POST(request: NextRequest) {
  try {
    const { action, productId, branchId, quantity, auditStatus, fromBranchId, toBranchId, transferQuantity } = await request.json()

    console.log('API request:', { action, productId, branchId, quantity, auditStatus })
    
    if (action === 'update_inventory') {
      console.log('Updating inventory:', { productId, branchId, quantity })

      // First check if the record exists
      const { data: existingRecord, error: checkError } = await supabase
        .from('inventory')
        .select('id, quantity, product_id, branch_id')
        .eq('product_id', productId)
        .eq('branch_id', branchId)
        .maybeSingle()

      if (checkError) {
        console.error('Error checking inventory record:', checkError)
        return NextResponse.json(
          {
            success: false,
            error: 'Error checking inventory record',
            details: checkError.message
          },
          { status: 500 }
        )
      }

      const newQuantity = parseInt(quantity)
      let data
      let error

      if (existingRecord) {
        // Update existing record
        const result = await supabase
          .from('inventory')
          .update({
            quantity: newQuantity,
            last_updated: new Date().toISOString()
          })
          .eq('id', existingRecord.id)
          .select('*')
          .single()

        data = result.data
        error = result.error
      } else {
        // Insert new record
        const result = await supabase
          .from('inventory')
          .insert({
            product_id: productId,
            branch_id: branchId,
            quantity: newQuantity,
            last_updated: new Date().toISOString()
          })
          .select('*')
          .single()

        data = result.data
        error = result.error
      }

      if (error) {
        console.error('Supabase error:', error)
        return NextResponse.json(
          {
            success: false,
            error: 'Failed to update inventory',
            details: error.message
          },
          { status: 500 }
        )
      }

      console.log('Successfully updated inventory:', data)

      return NextResponse.json({
        success: true,
        data,
        message: 'Inventory updated successfully',
        previousQuantity: existingRecord?.quantity || 0
      })
    }
    
    if (action === 'update_audit_status') {
      console.log('Updating audit status:', { productId, branchId, auditStatus })
      
      // First check if the record exists
      const { data: existingRecord, error: checkError } = await supabase
        .from('inventory')
        .select('id, audit_status, product_id, branch_id')
        .eq('product_id', productId)
        .eq('branch_id', branchId)
        .maybeSingle()
        
      if (checkError) {
        console.error('Error checking record:', checkError)
        return NextResponse.json(
          { 
            success: false, 
            error: 'Error checking inventory record',
            details: checkError.message 
          },
          { status: 500 }
        )
      }
      
      if (!existingRecord) {
        console.error('No inventory record found for:', { productId, branchId })
        return NextResponse.json(
          { 
            success: false, 
            error: 'No inventory record found for this product and branch',
            details: { productId, branchId }
          },
          { status: 404 }
        )
      }
      
      console.log('Found existing record:', existingRecord)
      
      // Update the record
      const { data, error } = await supabase
        .from('inventory')
        .update({ 
          audit_status: auditStatus,
          last_updated: new Date().toISOString()
        })
        .eq('id', existingRecord.id)
        .select('*')
        .single()
        
      if (error) {
        console.error('Update error:', error)
        return NextResponse.json(
          { 
            success: false, 
            error: 'Failed to update audit status',
            details: error.message 
          },
          { status: 500 }
        )
      }
      
      console.log('Successfully updated audit status:', data)
      
      // Note: Cache invalidation should be handled by the real-time subscription
      // No manual cache clearing needed here
      
      return NextResponse.json({ 
        success: true, 
        data: data,
        message: `Audit status updated to "${auditStatus}"`,
        previousStatus: existingRecord.audit_status
      })
    }
    
    if (action === 'transfer_inventory') {
      console.log('Transferring inventory:', { productId, fromBranchId, toBranchId, transferQuantity })

      if (!productId || !fromBranchId || !toBranchId || !transferQuantity) {
        return NextResponse.json(
          { success: false, error: 'Missing required fields for transfer' },
          { status: 400 }
        )
      }

      const transferQty = parseInt(transferQuantity)
      if (transferQty <= 0) {
        return NextResponse.json(
          { success: false, error: 'Transfer quantity must be greater than 0' },
          { status: 400 }
        )
      }

      // Get current quantities for both branches
      const { data: fromRecord, error: fromError } = await supabase
        .from('inventory')
        .select('id, quantity')
        .eq('product_id', productId)
        .eq('branch_id', fromBranchId)
        .maybeSingle()

      if (fromError) {
        return NextResponse.json(
          { success: false, error: 'Error checking source branch inventory', details: fromError.message },
          { status: 500 }
        )
      }

      const { data: toRecord, error: toError } = await supabase
        .from('inventory')
        .select('id, quantity')
        .eq('product_id', productId)
        .eq('branch_id', toBranchId)
        .maybeSingle()

      if (toError) {
        return NextResponse.json(
          { success: false, error: 'Error checking destination branch inventory', details: toError.message },
          { status: 500 }
        )
      }

      const fromCurrentQty = fromRecord?.quantity || 0
      const toCurrentQty = toRecord?.quantity || 0
      const fromNewQty = fromCurrentQty - transferQty
      const toNewQty = toCurrentQty + transferQty

      // Update source branch
      let fromResult
      if (fromRecord) {
        fromResult = await supabase
          .from('inventory')
          .update({ quantity: fromNewQty, last_updated: new Date().toISOString() })
          .eq('id', fromRecord.id)
          .select('*')
          .single()
      } else {
        fromResult = await supabase
          .from('inventory')
          .insert({ product_id: productId, branch_id: fromBranchId, quantity: fromNewQty, last_updated: new Date().toISOString() })
          .select('*')
          .single()
      }

      if (fromResult.error) {
        return NextResponse.json(
          { success: false, error: 'Failed to update source branch', details: fromResult.error.message },
          { status: 500 }
        )
      }

      // Update destination branch
      let toResult
      if (toRecord) {
        toResult = await supabase
          .from('inventory')
          .update({ quantity: toNewQty, last_updated: new Date().toISOString() })
          .eq('id', toRecord.id)
          .select('*')
          .single()
      } else {
        toResult = await supabase
          .from('inventory')
          .insert({ product_id: productId, branch_id: toBranchId, quantity: toNewQty, last_updated: new Date().toISOString() })
          .select('*')
          .single()
      }

      if (toResult.error) {
        return NextResponse.json(
          { success: false, error: 'Failed to update destination branch', details: toResult.error.message },
          { status: 500 }
        )
      }

      console.log('Successfully transferred inventory:', { from: fromResult.data, to: toResult.data })

      return NextResponse.json({
        success: true,
        data: { from: fromResult.data, to: toResult.data },
        message: 'Inventory transferred successfully',
        fromNewQty,
        toNewQty
      })
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Invalid action'
      },
      { status: 400 }
    )
    
  } catch (error: any) {
    console.error('API Error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Internal server error',
        details: error
      },
      { status: 500 }
    )
  }
}