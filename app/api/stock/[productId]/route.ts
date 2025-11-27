import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/app/lib/supabase/database.types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient<Database, 'elfaroukgroup'>(supabaseUrl, supabaseAnonKey, {
  db: {
    schema: 'elfaroukgroup' // Use elfaroukgroup schema for multi-tenant architecture
  }
});

/**
 * GET /api/stock/[productId]
 *
 * Returns real-time stock quantity for a product
 *
 * Caching Strategy:
 * - CDN Cache: 60 seconds (s-maxage)
 * - Stale-While-Revalidate: 30 seconds
 * - Result: Fast response + accurate data
 *
 * Performance:
 * - Even with 1000 concurrent users, the CDN serves most requests
 * - Database queries: ~1-2 per minute per product (instead of 1000!)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { productId: string } }
) {
  try {
    const { productId } = params;

    // Fetch stock from inventory table
    const { data: inventory, error } = await supabase
      .from('inventory')
      .select('quantity, min_stock')
      .eq('product_id', productId)
      .single();

    if (error) {
      // If no inventory record exists, assume unlimited stock
      return NextResponse.json(
        {
          productId,
          quantity: 999,
          available: true,
          low_stock: false,
          min_stock: 10
        },
        {
          headers: {
            // Short cache for non-existent items
            'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=60',
          },
        }
      );
    }

    const quantity = inventory?.quantity || 0;
    const min_stock = inventory?.min_stock || 10;
    const isLowStock = quantity < min_stock;
    const isAvailable = quantity > 0;

    return NextResponse.json(
      {
        productId,
        quantity,
        available: isAvailable,
        low_stock: isLowStock,
        min_stock
      },
      {
        headers: {
          // Cache for 60 seconds, allow stale for 30 seconds while revalidating
          // This means most users get cached response (fast!)
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30',
        },
      }
    );
  } catch (error) {
    console.error('Error fetching stock:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stock' },
      { status: 500 }
    );
  }
}
