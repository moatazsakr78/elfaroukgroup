import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth.config';
import { createClient } from '@supabase/supabase-js';
import { CLIENT_CONFIG } from '@/client.config';
import {
  BACKUP_FORMAT,
  TABLE_LEVELS,
  ALL_TABLES_ORDERED,
} from '@/app/lib/backup/backup-config';
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

async function deleteTableData(tableName: string, protectUserId?: string) {
  if (protectUserId && tableName === 'auth_users') {
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
      .neq('user_id', protectUserId);
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

  const { error } = await supabaseAdmin
    .from(tableName)
    .delete()
    .gte('id', '00000000-0000-0000-0000-000000000000');

  if (error) {
    const { error: error2 } = await supabaseAdmin
      .from(tableName)
      .delete()
      .not('id', 'is', null);

    if (error2) {
      console.warn(`Could not delete ${tableName}: ${error2.message}`);
    }
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }

    const { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .select('is_admin, user_id')
      .eq('email', session.user.email)
      .single();

    if (!profile?.is_admin) {
      return NextResponse.json({ error: 'يجب أن تكون مدير لاستعادة النسخة' }, { status: 403 });
    }

    const { data: currentUser } = await supabaseAdmin
      .from('auth_users')
      .select('id')
      .eq('email', session.user.email)
      .single();

    const protectUserId = currentUser?.id;

    const body = await request.json();
    const { _meta, tableList } = body;

    if (!_meta || _meta.format !== BACKUP_FORMAT) {
      return NextResponse.json({ error: 'تنسيق الملف غير صحيح' }, { status: 400 });
    }

    if (!tableList || !Array.isArray(tableList)) {
      return NextResponse.json({ error: 'قائمة الجداول مطلوبة' }, { status: 400 });
    }

    const allTablesInBackup = ALL_TABLES_ORDERED.filter((t) => tableList.includes(t));

    resetProgress();
    setProgress({
      operation: 'import',
      phase: 'جاري مسح البيانات القديمة...',
      progress: 0,
      tablesTotal: allTablesInBackup.length,
      tablesCompleted: 0,
    });

    // Delete data in reverse dependency order
    const reversedLevels = [...TABLE_LEVELS].reverse();
    let deletedCount = 0;
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

        deletedCount++;
        setProgress({
          progress: Math.round((deletedCount / (allTablesInBackup.length * 2 + 2)) * 100),
        });
      }
    }

    return NextResponse.json({
      success: true,
      protectUserId,
      tablesTotal: allTablesInBackup.length,
    });
  } catch (error: any) {
    console.error('Import init error:', error);
    setProgress({ operation: 'idle', phase: '', progress: 0, error: error.message });
    return NextResponse.json({ error: 'فشل تهيئة الاستيراد: ' + error.message }, { status: 500 });
  }
}
