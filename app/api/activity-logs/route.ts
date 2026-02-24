import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth.config';
import { supabaseAdmin } from '@/app/lib/supabase/admin';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
    const entityType = searchParams.get('entityType'); // comma-separated
    const actionType = searchParams.get('actionType'); // comma-separated
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const userId = searchParams.get('userId');
    const search = searchParams.get('search');

    const offset = (page - 1) * limit;

    // Build query
    let query = (supabaseAdmin as any)
      .from('activity_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (entityType) {
      const types = entityType.split(',').filter(Boolean);
      if (types.length === 1) {
        query = query.eq('entity_type', types[0]);
      } else if (types.length > 1) {
        query = query.in('entity_type', types);
      }
    }

    if (actionType) {
      const actions = actionType.split(',').filter(Boolean);
      if (actions.length === 1) {
        query = query.eq('action_type', actions[0]);
      } else if (actions.length > 1) {
        query = query.in('action_type', actions);
      }
    }

    if (startDate) {
      query = query.gte('created_at', startDate);
    }
    if (endDate) {
      query = query.lte('created_at', endDate);
    }
    if (userId) {
      query = query.eq('user_id', userId);
    }
    if (search) {
      query = query.or(`description.ilike.%${search}%,entity_name.ilike.%${search}%`);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('Activity logs fetch error:', error);
      return NextResponse.json({ error: 'Failed to fetch logs' }, { status: 500 });
    }

    const total = count || 0;
    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      logs: data || [],
      total,
      page,
      limit,
      totalPages,
    });
  } catch (err) {
    console.error('Activity logs API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
