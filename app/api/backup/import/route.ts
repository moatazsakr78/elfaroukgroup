import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth.config';
import { createClient } from '@supabase/supabase-js';
import { CLIENT_CONFIG } from '@/client.config';
import {
  BACKUP_VERSION,
  BACKUP_FORMAT,
  BATCH_INSERT_SIZE,
  ALL_TABLES_ORDERED,
  TABLE_LEVELS,
  CIRCULAR_FKS,
  BackupFile,
  ImportResult,
} from '@/app/lib/backup/backup-config';
import { setProgress, resetProgress } from '@/app/lib/backup/progress';
import { createHash } from 'crypto';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    db: { schema: CLIENT_CONFIG.schema },
    auth: { persistSession: false, autoRefreshToken: false },
  }
);

function computeChecksum(data: any): string {
  return createHash('sha256').update(JSON.stringify(data)).digest('hex');
}

async function deleteTableData(tableName: string, protectUserId?: string) {
  if (protectUserId && tableName === 'auth_users') {
    // Delete all except current user
    const { error } = await supabaseAdmin
      .from(tableName)
      .delete()
      .neq('id', protectUserId);
    if (error) throw new Error(`حذف ${tableName}: ${error.message}`);
    return;
  }

  if (protectUserId && tableName === 'user_profiles') {
    const { error } = await supabaseAdmin
      .from(tableName)
      .delete()
      .neq('id', protectUserId);
    if (error) throw new Error(`حذف ${tableName}: ${error.message}`);
    return;
  }

  if (protectUserId && tableName === 'auth_sessions') {
    const { error } = await supabaseAdmin
      .from(tableName)
      .delete()
      .neq('user_id', protectUserId);
    if (error) throw new Error(`حذف ${tableName}: ${error.message}`);
    return;
  }

  if (protectUserId && tableName === 'auth_accounts') {
    const { error } = await supabaseAdmin
      .from(tableName)
      .delete()
      .neq('user_id', protectUserId);
    if (error) throw new Error(`حذف ${tableName}: ${error.message}`);
    return;
  }

  // Delete all rows
  // Use a broad filter to delete everything since .delete() requires a filter
  const { error } = await supabaseAdmin
    .from(tableName)
    .delete()
    .gte('id', '00000000-0000-0000-0000-000000000000');

  if (error) {
    // Try with numeric id or different approach
    const { error: error2 } = await supabaseAdmin
      .from(tableName)
      .delete()
      .not('id', 'is', null);

    if (error2) {
      // Some tables may use composite keys - use RPC or just log
      console.warn(`Could not delete ${tableName}: ${error2.message}`);
    }
  }
}

async function batchInsert(tableName: string, rows: any[]): Promise<{ inserted: number; error?: string }> {
  if (rows.length === 0) return { inserted: 0 };

  let inserted = 0;
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i += BATCH_INSERT_SIZE) {
    const batch = rows.slice(i, i + BATCH_INSERT_SIZE);
    const { error } = await supabaseAdmin.from(tableName).insert(batch as any);

    if (error) {
      errors.push(`Batch ${Math.floor(i / BATCH_INSERT_SIZE)}: ${error.message}`);
      // Try inserting one by one for this batch
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

function nullifyCircularColumns(rows: any[], tableName: string): { cleaned: any[]; originals: Map<string, any> } {
  const circularCols = CIRCULAR_FKS.filter((fk) => fk.table === tableName);
  if (circularCols.length === 0) return { cleaned: rows, originals: new Map() };

  const originals = new Map<string, any>();
  const cleaned = rows.map((row) => {
    const newRow = { ...row };
    for (const fk of circularCols) {
      if (newRow[fk.column] != null) {
        // Store original value keyed by row id + column
        originals.set(`${newRow.id}::${fk.column}`, newRow[fk.column]);
        newRow[fk.column] = null;
      }
    }
    return newRow;
  });

  return { cleaned, originals };
}

export async function POST(request: Request) {
  try {
    // Auth check
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }

    // Check admin
    const { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .select('is_admin')
      .eq('id', session.user.id)
      .single();

    if (!profile?.is_admin) {
      return NextResponse.json({ error: 'يجب أن تكون مدير لاستعادة النسخة' }, { status: 403 });
    }

    // Get current user ID for protection
    const { data: currentUser } = await supabaseAdmin
      .from('auth_users')
      .select('id')
      .eq('email', session.user.email)
      .single();

    const protectUserId = currentUser?.id;

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'لم يتم إرسال ملف' }, { status: 400 });
    }

    let backup: BackupFile;
    try {
      const text = await file.text();
      backup = JSON.parse(text);
    } catch {
      return NextResponse.json({ error: 'فشل قراءة ملف النسخة' }, { status: 400 });
    }

    // Quick validation
    if (!backup._meta?.format?.endsWith('-backup')) {
      return NextResponse.json({ error: 'تنسيق الملف غير صحيح' }, { status: 400 });
    }

    // Verify checksum
    const computedChecksum = computeChecksum(backup.tables);
    if (backup._meta.checksum && computedChecksum !== backup._meta.checksum) {
      return NextResponse.json({ error: 'فشل التحقق من سلامة البيانات' }, { status: 400 });
    }

    const tablesToImport = ALL_TABLES_ORDERED.filter((t) => backup.tables[t] && backup.tables[t].length > 0);
    const allTablesInBackup = ALL_TABLES_ORDERED.filter((t) => backup.tables[t] !== undefined);
    const totalSteps = allTablesInBackup.length * 2 + 2; // delete + insert + circular updates + verify
    let completedSteps = 0;

    resetProgress();
    setProgress({
      operation: 'import',
      phase: 'جاري مسح البيانات القديمة...',
      progress: 0,
      tablesTotal: allTablesInBackup.length,
      tablesCompleted: 0,
    });

    // Store circular FK original values for later update
    const allCircularOriginals: { table: string; originals: Map<string, any> }[] = [];

    // ============================
    // Phase 1: Delete data (reverse order)
    // ============================
    const reversedLevels = [...TABLE_LEVELS].reverse();
    for (const level of reversedLevels) {
      for (const tableName of level) {
        if (!allTablesInBackup.includes(tableName)) continue;

        setProgress({
          phase: `جاري مسح ${tableName}...`,
          currentTable: tableName,
        });

        try {
          await deleteTableData(tableName, protectUserId);
        } catch (err: any) {
          console.warn(`Delete warning for ${tableName}:`, err.message);
        }

        completedSteps++;
        setProgress({
          progress: Math.round((completedSteps / totalSteps) * 100),
        });
      }
    }

    // ============================
    // Phase 2: Insert data (level order)
    // ============================
    setProgress({ phase: 'جاري استيراد البيانات...' });

    const results: ImportResult['results'] = [];

    for (const level of TABLE_LEVELS) {
      for (const tableName of level) {
        const rows = backup.tables[tableName];
        if (!rows || !Array.isArray(rows)) continue;

        setProgress({
          phase: `جاري استيراد ${tableName} (${rows.length} صف)...`,
          currentTable: tableName,
        });

        // Filter out the protected user row from auth tables
        let filteredRows = rows;
        if (protectUserId && tableName === 'auth_users') {
          filteredRows = rows.filter((r) => r.id !== protectUserId);
        }
        if (protectUserId && tableName === 'user_profiles') {
          filteredRows = rows.filter((r) => r.id !== protectUserId);
        }

        // Nullify circular FK columns
        const { cleaned, originals } = nullifyCircularColumns(filteredRows, tableName);
        if (originals.size > 0) {
          allCircularOriginals.push({ table: tableName, originals });
        }

        const { inserted, error } = await batchInsert(tableName, cleaned);

        results.push({
          table: tableName,
          expected: filteredRows.length,
          inserted,
          status: error ? (inserted > 0 ? 'partial' : 'error') : 'ok',
          error,
        });

        completedSteps++;
        setProgress({
          progress: Math.round((completedSteps / totalSteps) * 100),
          tablesCompleted: results.length,
        });
      }
    }

    // ============================
    // Phase 3: Update circular FK values
    // ============================
    setProgress({ phase: 'جاري تحديث العلاقات الدائرية...' });

    for (const { table, originals } of allCircularOriginals) {
      for (const [key, value] of Array.from(originals.entries())) {
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
    completedSteps++;

    // ============================
    // Phase 4: Verify row counts
    // ============================
    setProgress({ phase: 'جاري التحقق النهائي...' });

    const verification: ImportResult['verification'] = [];

    for (const tableName of tablesToImport) {
      const expected = backup.tables[tableName]?.length || 0;
      const { count } = await supabaseAdmin
        .from(tableName)
        .select('*', { count: 'exact', head: true });

      verification.push({
        table: tableName,
        expected,
        actual: count || 0,
        match: count === expected || (count !== null && Math.abs(count - expected) <= 1), // Allow ±1 for protected user
      });
    }
    completedSteps++;

    setProgress({
      phase: 'تم الاستيراد بنجاح',
      progress: 100,
      currentTable: '',
    });

    setTimeout(() => resetProgress(), 5000);

    const importResult: ImportResult = {
      success: results.every((r) => r.status !== 'error'),
      results,
      verification,
    };

    return NextResponse.json(importResult);
  } catch (error: any) {
    console.error('Import error:', error);
    setProgress({
      operation: 'idle',
      phase: '',
      progress: 0,
      error: error.message,
    });
    return NextResponse.json(
      { error: 'فشل الاستيراد: ' + error.message },
      { status: 500 }
    );
  }
}
