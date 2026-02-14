import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth.config';
import { createClient } from '@supabase/supabase-js';
import { CLIENT_CONFIG } from '@/client.config';
import { ALL_TABLES_ORDERED } from '@/app/lib/backup/backup-config';
import { setProgress, resetProgress } from '@/app/lib/backup/progress';

export const runtime = 'nodejs';
export const maxDuration = 120;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    db: { schema: CLIENT_CONFIG.schema },
    auth: { persistSession: false, autoRefreshToken: false },
  }
);

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }

    const body = await request.json();
    const { circularUpdates, tableManifest } = body;
    // circularUpdates: Array<{ table, entries: Record<"rowId::column", value> }>
    // tableManifest: Record<tableName, expectedRowCount>

    // Phase: Update circular FK values
    setProgress({
      operation: 'import',
      phase: 'جاري تحديث العلاقات الدائرية...',
      progress: 90,
    });

    if (circularUpdates && Array.isArray(circularUpdates)) {
      for (const { table, entries } of circularUpdates) {
        for (const [key, value] of Object.entries(entries)) {
          const [rowId, column] = key.split('::');
          try {
            await supabaseAdmin
              .from(table)
              .update({ [column]: value } as any)
              .eq('id', rowId);
          } catch (err: any) {
            console.warn(`Circular FK update ${table}.${column} for ${rowId}:`, err.message);
          }
        }
      }
    }

    // Phase: Verify row counts
    setProgress({ phase: 'جاري التحقق النهائي...', progress: 95 });

    const verification: { table: string; expected: number; actual: number; match: boolean }[] = [];

    if (tableManifest && typeof tableManifest === 'object') {
      const tablesToVerify = ALL_TABLES_ORDERED.filter((t) => tableManifest[t] !== undefined);
      for (const tableName of tablesToVerify) {
        const expected = tableManifest[tableName] || 0;
        const { count } = await supabaseAdmin
          .from(tableName)
          .select('*', { count: 'exact', head: true });

        verification.push({
          table: tableName,
          expected,
          actual: count || 0,
          match: count === expected || (count !== null && Math.abs(count - expected) <= 1),
        });
      }
    }

    setProgress({
      phase: 'تم الاستيراد بنجاح',
      progress: 100,
      currentTable: '',
    });

    setTimeout(() => resetProgress(), 5000);

    return NextResponse.json({ success: true, verification });
  } catch (error: any) {
    console.error('Import finalize error:', error);
    setProgress({ operation: 'idle', phase: '', progress: 0, error: error.message });
    return NextResponse.json(
      { error: 'فشل إنهاء الاستيراد: ' + error.message },
      { status: 500 }
    );
  }
}
