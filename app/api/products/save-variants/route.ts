import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '../../../lib/supabase/admin'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { productId, colors, shapes, quantities } = body

    console.log('🔵 API: Received save-variants request')
    console.log('📦 API: productId:', productId)
    console.log('🎨 API: colors received:', colors)
    console.log('🔶 API: shapes received:', shapes)
    console.log('📊 API: quantities received:', quantities)

    if (!productId) {
      return NextResponse.json(
        { success: false, error: 'Product ID is required' },
        { status: 400 }
      )
    }

    const supabaseAdmin = getSupabaseAdmin()

    // Delete old definitions
    // @ts-ignore - TypeScript has issues with schema type inference
    const { error: deleteError } = await supabaseAdmin
      .from('product_color_shape_definitions')
      .delete()
      .eq('product_id', productId)

    if (deleteError) {
      console.error('❌ Error deleting old definitions:', deleteError)
      // Continue anyway - the delete might fail if there are no existing definitions
    }

    // Prepare color definitions
    const colorDefinitions = (colors || []).map((color: any, index: number) => ({
      product_id: productId,
      variant_type: 'color' as const,
      name: color.name,
      color_hex: color.color,
      image_url: color.image || null,
      barcode: color.barcode || null,
      sort_order: index
    }))

    // Prepare shape definitions
    const shapeDefinitions = (shapes || []).map((shape: any, index: number) => ({
      product_id: productId,
      variant_type: 'shape' as const,
      name: shape.name || null,
      color_hex: null,
      image_url: shape.image_url || null,
      barcode: shape.barcode || null,
      sort_order: index
    }))

    const allDefinitions = [...colorDefinitions, ...shapeDefinitions]

    if (allDefinitions.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No variants to save',
        data: []
      })
    }

    // Insert new definitions using service_role_key
    // @ts-ignore - TypeScript has issues with schema type inference
    const { data: savedDefinitions, error: insertError } = await supabaseAdmin
      .from('product_color_shape_definitions')
      .insert(allDefinitions)
      .select()

    if (insertError) {
      console.error('❌ Error inserting variant definitions:', insertError)
      return NextResponse.json(
        { success: false, error: insertError.message },
        { status: 500 }
      )
    }

    console.log('✅ Saved variant definitions:', savedDefinitions)

    // Save variant quantities if provided
    if (quantities && Array.isArray(quantities) && quantities.length > 0 && savedDefinitions && savedDefinitions.length > 0) {
      console.log('💾 Saving variant quantities...')

      // Delete old quantities for these definitions
      const definitionIds = savedDefinitions.map((d: any) => d.id)
      await supabaseAdmin
        .from('product_variant_quantities')
        .delete()
        .in('variant_definition_id', definitionIds)

      // Prepare quantities to save
      const quantitiesToSave = quantities.map((qty: any) => {
        // Find the matching definition by name and type
        const definition = savedDefinitions.find((d: any) =>
          d.variant_type === qty.elementType &&
          d.name === qty.elementName
        )

        if (!definition) {
          console.warn(`⚠️ No definition found for: ${qty.elementName}`)
          return null
        }

        return {
          variant_definition_id: definition.id,
          branch_id: qty.locationId,
          quantity: qty.quantity || 0
        }
      }).filter((q: any) => q !== null)

      if (quantitiesToSave.length > 0) {
        // @ts-ignore - TypeScript has issues with schema type inference
        const { error: qtyError } = await supabaseAdmin
          .from('product_variant_quantities')
          .insert(quantitiesToSave as any)

        if (qtyError) {
          console.error('❌ Error saving variant quantities:', qtyError)
          return NextResponse.json(
            { success: false, error: 'Failed to save quantities: ' + qtyError.message },
            { status: 500 }
          )
        }

        console.log('✅ Saved variant quantities:', quantitiesToSave.length)
      }
    }

    // ✨ Trigger revalidation to update the website immediately
    try {
      const revalidateUrl = `${request.nextUrl.origin}/api/revalidate`;
      await fetch(revalidateUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          secret: 'client-revalidate-request',
          productId,
          path: '/'
        })
      });
      console.log('✅ Triggered revalidation for product:', productId);
    } catch (revalidateError) {
      console.warn('⚠️ Revalidation failed (non-critical):', revalidateError);
      // Non-critical error - don't fail the main operation
    }

    return NextResponse.json({
      success: true,
      data: savedDefinitions
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
