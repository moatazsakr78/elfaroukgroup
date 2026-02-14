import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth.config';
import { createClient } from '@supabase/supabase-js';
import { CLIENT_CONFIG } from '@/client.config';
import {
  BATCH_INSERT_SIZE,
  CIRCULAR_FKS,
} from '@/app/lib/backup/backup-config';
import { setProgress } from '@/app/lib/backup/progress';

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

async function batchInsert(tableName: string, rows: any[]): Promise<{ inserted: number; error?: string }> {
  if (rows.length === 0) return { inserted: 0 };

  let inserted = 0;
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i += BATCH_INSERT_SIZE) {
    const batch = rows.slice(i, i + BATCH_INSERT_SIZE);
    const { error } = await supabaseAdmin.from(tableName).insert(batch as any);

    if (error) {
      errors.push(`Batch ${Math.floor(i / BATCH_INSERT_SIZE)}: ${error.message}`);
      for (const row of batch) {
        const { error: singleError } = await supabaseAdmin.from(tableName).insert(row as any);
        if (!singleError) {
          inserted++;
        }
      }
    } else {
      inserted += batch.length;
    }
  }

  return {
    inserted,
    error: errors.length > 0 ? errors.join('; ') : undefined,
  };
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }

    const body = await request.json();
    const { tableName, rows, protectUserId, progressInfo } = body;

    if (!tableName || !Array.isArray(rows)) {
      return NextResponse.json({ error: 'اسم الجدول والبيانات مطلوبة' }, { status: 400 });
    }

    setProgress({
      operation: 'import',
      phase: `جاري استيراد ${tableName} (${rows.length} صف)...`,
      currentTable: tableName,
      ...(progressInfo || {}),
    });

    // Filter out the protected user row from auth tables
    let filteredRows = rows;
    if (protectUserId && tableName === 'auth_users') {
      filteredRows = rows.filter((r: any) => r.id !== protectUserId);
    }
    if (protectUserId && tableName === 'user_profiles') {
      filteredRows = rows.filter((r: any) => r.user_id !== protectUserId);
    }

    // Nullify circular FK columns, return originals for later update
    const circularCols = CIRCULAR_FKS.filter((fk) => fk.table === tableName);
    const circularOriginals: Record<string, any> = {};

    let cleanedRows = filteredRows;
    if (circularCols.length > 0) {
      cleanedRows = filteredRows.map((row: any) => {
        const newRow = { ...row };
        for (const fk of circularCols) {
          if (newRow[fk.column] != null) {
            circularOriginals[`${newRow.id}::${fk.column}`] = newRow[fk.column];
            newRow[fk.column] = null;
          }
        }
        return newRow;
      });
    }

    const { inserted, error } = await batchInsert(tableName, cleanedRows);

    const result = {
      table: tableName,
      expected: filteredRows.length,
      inserted,
      status: error ? (inserted > 0 ? 'partial' : 'error') : 'ok',
      error,
      circularOriginals: Object.keys(circularOriginals).length > 0 ? circularOriginals : undefined,
    };

    return NextResponse.json(result);
  } catch (error: any) {
    console.error(`Import table error:`, error);
    return NextResponse.json(
      { error: `فشل استيراد الجدول: ${error.message}` },
      { status: 500 }
    );
  }
}
