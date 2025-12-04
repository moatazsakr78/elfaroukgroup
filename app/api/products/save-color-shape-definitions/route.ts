import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '../../../lib/supabase/admin'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { productId, colors, shapes, quantities } = body

    console.log('🔵 API: Received save-color-shape-definitions request')
    console.log('📦 API: productId:', productId)
    console.log('🎨 API: colors:', colors?.length || 0)
    console.log('🔶 API: shapes:', shapes?.length || 0)

    if (!productId) {
      return NextResponse.json(
        { success: false, error: 'Product ID is required' },
        { status: 400 }
      )
    }

    const supabaseAdmin = getSupabaseAdmin()

    // ✅ Step 1: Delete old definitions for this product
    // @ts-ignore
    await supabaseAdmin
      .from('product_color_shape_definitions')
      .delete()
      .eq('product_id', productId)

    // ✅ Step 2: Prepare new definitions
    const definitionsToInsert: any[] = []

    // Add color definitions
    if (colors && Array.isArray(colors)) {
      colors.forEach((color: any, index: number) => {
        definitionsToInsert.push({
          product_id: productId,
          variant_type: 'color',
          name: color.name,
          color_hex: color.color || null,
          image_url: color.image || null,
          barcode: color.barcode || null,
          sort_order: index
        })
      })
    }

    // Add shape definitions
    if (shapes && Array.isArray(shapes)) {
      shapes.forEach((shape: any, index: number) => {
        // ✅ Keep name as NULL if not provided (no auto-generation)
        const shapeName = shape.name && shape.name.trim() ? shape.name.trim() : null

        definitionsToInsert.push({
          product_id: productId,
          variant_type: 'shape',
          name: shapeName,  // NULL is allowed now after constraint fix
          color_hex: null,
          image_url: shape.image || null,
          barcode: shape.barcode || null,
          sort_order: index
        })
      })
    }

    // ✅ Step 3: Insert new definitions
    let insertedDefinitions: any[] = []
    if (definitionsToInsert.length > 0) {
      // @ts-ignore
      const { data, error: defError } = await supabaseAdmin
        .from('product_color_shape_definitions')
        .insert(definitionsToInsert)
        .select()

      if (defError) {
        console.error('❌ Error inserting definitions:', defError)
        return NextResponse.json(
          { success: false, error: defError.message },
          { status: 500 }
        )
      }

      insertedDefinitions = data || []
      console.log('✅ Inserted definitions:', insertedDefinitions.length)
    }

    // ✅ Step 4: Save quantities if provided
    if (quantities && Array.isArray(quantities) && insertedDefinitions.length > 0) {
      // Delete old quantities for these definitions
      const defIds = insertedDefinitions.map(d => d.id)
      // @ts-ignore
      await supabaseAdmin
        .from('product_variant_quantities')
        .delete()
        .in('variant_definition_id', defIds)

      // Prepare new quantities
      const quantitiesToInsert: any[] = []

      quantities.forEach((variant: any) => {
        // Find matching definition
        const definition = insertedDefinitions.find(d =>
          d.variant_type === variant.elementType &&
          d.name === variant.elementName
        )

        if (definition && variant.locationType === 'branch' && variant.locationId) {
          quantitiesToInsert.push({
            variant_definition_id: definition.id,
            branch_id: variant.locationId,
            quantity: variant.quantity || 0
          })
        }
      })

      // Insert quantities
      if (quantitiesToInsert.length > 0) {
        // @ts-ignore
        const { error: qtyError } = await supabaseAdmin
          .from('product_variant_quantities')
          .insert(quantitiesToInsert)

        if (qtyError) {
          console.error('❌ Error inserting quantities:', qtyError)
          // Don't fail the whole operation if quantities fail
          console.warn('⚠️ Quantities failed, but definitions were saved')
        } else {
          console.log('✅ Inserted quantities:', quantitiesToInsert.length)
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: insertedDefinitions
    })

  } catch (error) {
    console.error('❌ API error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
