import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth.config';
import { createClient } from '@supabase/supabase-js';
import { CLIENT_CONFIG } from '@/client.config';
import {
  BACKUP_VERSION,
  BACKUP_FORMAT,
  EXPORT_PAGE_SIZE,
  ALL_TABLES_ORDERED,
  WHATSAPP_TABLES,
  AUTH_SESSION_TABLES,
  BackupFile,
  BackupManifestEntry,
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

async function fetchAllRows(tableName: string): Promise<any[]> {
  const allRows: any[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabaseAdmin
      .from(tableName)
      .select('*')
      .range(offset, offset + EXPORT_PAGE_SIZE - 1);

    if (error) {
      // Table might not exist or be empty - treat as empty
      console.warn(`Warning fetching ${tableName}:`, error.message);
      return allRows;
    }

    if (data && data.length > 0) {
      allRows.push(...data);
      offset += data.length;
      if (data.length < EXPORT_PAGE_SIZE) {
        hasMore = false;
      }
    } else {
      hasMore = false;
    }
  }

  return allRows;
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
      return NextResponse.json({ error: 'يجب أن تكون مدير للنسخ الاحتياطي' }, { status: 403 });
    }

    // Parse options
    let includeWhatsapp = false;
    let includeAuth = false;
    try {
      const body = await request.json();
      includeWhatsapp = body.includeWhatsapp ?? false;
      includeAuth = body.includeAuth ?? false;
    } catch {
      // No body or invalid JSON - use defaults
    }

    // Filter tables based on options
    const tablesToExport = ALL_TABLES_ORDERED.filter((t) => {
      if (!includeWhatsapp && WHATSAPP_TABLES.includes(t)) return false;
      if (!includeAuth && AUTH_SESSION_TABLES.includes(t)) return false;
      return true;
    });

    resetProgress();
    setProgress({
      operation: 'export',
      phase: 'جاري تصدير البيانات...',
      progress: 0,
      tablesTotal: tablesToExport.length,
      tablesCompleted: 0,
    });

    const tables: Record<string, any[]> = {};
    const manifest: Record<string, BackupManifestEntry> = {};
    let totalRows = 0;

    for (let i = 0; i < tablesToExport.length; i++) {
      const tableName = tablesToExport[i];

      setProgress({
        currentTable: tableName,
        tablesCompleted: i,
        progress: Math.round((i / tablesToExport.length) * 100),
      });

      const rows = await fetchAllRows(tableName);
      tables[tableName] = rows;
      manifest[tableName] = {
        row_count: rows.length,
        checksum: computeChecksum(rows),
      };
      totalRows += rows.length;
    }

    const backupData: BackupFile = {
      _meta: {
        version: BACKUP_VERSION,
        format: BACKUP_FORMAT,
        created_at: new Date().toISOString(),
        created_by: session.user.email,
        schema: 'elfaroukgroup',
        checksum: '', // Will be computed below
        table_count: tablesToExport.length,
        total_rows: totalRows,
      },
      _manifest: manifest,
      tables,
    };

    // Compute overall checksum (on tables data only)
    backupData._meta.checksum = computeChecksum(backupData.tables);

    setProgress({
      phase: 'تم التصدير بنجاح',
      progress: 100,
      tablesCompleted: tablesToExport.length,
      currentTable: '',
    });

    // Reset after a short delay
    setTimeout(() => resetProgress(), 3000);

    // Return as downloadable JSON
    const jsonStr = JSON.stringify(backupData);
    return new NextResponse(jsonStr, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="elfaroukgroup-backup-${new Date().toISOString().slice(0, 10)}.json"`,
      },
    });
  } catch (error: any) {
    console.error('Export error:', error);
    setProgress({
      operation: 'idle',
      phase: '',
      progress: 0,
      error: error.message,
    });
    return NextResponse.json(
      { error: 'فشل التصدير: ' + error.message },
      { status: 500 }
    );
  }
}
