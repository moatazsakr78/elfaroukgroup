import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth.config';
import {
  BACKUP_VERSION,
  BACKUP_FORMAT,
  ALL_TABLES_ORDERED,
  BackupFile,
  ValidationResult,
} from '@/app/lib/backup/backup-config';
import { createHash } from 'crypto';

export const runtime = 'nodejs';

function computeChecksum(data: any): string {
  return createHash('sha256').update(JSON.stringify(data)).digest('hex');
}

function validateBackupFile(backup: any): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check top-level structure
  if (!backup || typeof backup !== 'object') {
    return { valid: false, errors: ['الملف ليس بتنسيق JSON صالح'], warnings: [], summary: null };
  }

  if (!backup._meta) {
    errors.push('الملف لا يحتوي على بيانات وصفية (_meta)');
    return { valid: false, errors, warnings, summary: null };
  }

  // Check format
  if (backup._meta.format !== BACKUP_FORMAT) {
    errors.push(`تنسيق الملف غير صحيح: ${backup._meta.format || 'غير محدد'}`);
  }

  // Check version
  if (backup._meta.version !== BACKUP_VERSION) {
    warnings.push(`إصدار النسخة (${backup._meta.version}) يختلف عن الإصدار الحالي (${BACKUP_VERSION})`);
  }

  // Check required fields
  if (!backup._manifest || typeof backup._manifest !== 'object') {
    errors.push('الملف لا يحتوي على سجل المحتويات (_manifest)');
  }

  if (!backup.tables || typeof backup.tables !== 'object') {
    errors.push('الملف لا يحتوي على بيانات الجداول (tables)');
  }

  if (errors.length > 0) {
    return { valid: false, errors, warnings, summary: null };
  }

  // Verify overall checksum
  const computedChecksum = computeChecksum(backup.tables);
  if (backup._meta.checksum && computedChecksum !== backup._meta.checksum) {
    errors.push('فشل التحقق من سلامة البيانات (checksum غير متطابق)');
  }

  // Verify per-table checksums and row counts
  const tableNames = Object.keys(backup.tables);
  for (const tableName of tableNames) {
    const tableData = backup.tables[tableName];
    const manifestEntry = backup._manifest[tableName];

    if (!manifestEntry) {
      warnings.push(`الجدول ${tableName} غير موجود في سجل المحتويات`);
      continue;
    }

    if (!Array.isArray(tableData)) {
      errors.push(`بيانات الجدول ${tableName} ليست مصفوفة`);
      continue;
    }

    // Check row count
    if (tableData.length !== manifestEntry.row_count) {
      errors.push(
        `عدد صفوف ${tableName}: متوقع ${manifestEntry.row_count}، موجود ${tableData.length}`
      );
    }

    // Check table checksum
    const tableChecksum = computeChecksum(tableData);
    if (manifestEntry.checksum && tableChecksum !== manifestEntry.checksum) {
      errors.push(`فشل التحقق من سلامة بيانات الجدول ${tableName}`);
    }
  }

  // Check for unknown tables
  const knownTables = new Set(ALL_TABLES_ORDERED);
  for (const tableName of tableNames) {
    if (!knownTables.has(tableName)) {
      warnings.push(`جدول غير معروف في النسخة: ${tableName}`);
    }
  }

  // Check for missing tables
  for (const tableName of ALL_TABLES_ORDERED) {
    if (!backup.tables[tableName]) {
      warnings.push(`الجدول ${tableName} غير موجود في النسخة`);
    }
  }

  const summary = {
    created_at: backup._meta.created_at || 'غير محدد',
    created_by: backup._meta.created_by || 'غير محدد',
    table_count: backup._meta.table_count || tableNames.length,
    total_rows: backup._meta.total_rows || 0,
  };

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    summary,
  };
}

export async function POST(request: Request) {
  try {
    // Auth check
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'لم يتم إرسال ملف' }, { status: 400 });
    }

    // Parse JSON
    let backup: BackupFile;
    try {
      const text = await file.text();
      backup = JSON.parse(text);
    } catch {
      return NextResponse.json({
        valid: false,
        errors: ['فشل قراءة الملف - تأكد أنه ملف JSON صالح'],
        warnings: [],
        summary: null,
      } satisfies ValidationResult);
    }

    const result = validateBackupFile(backup);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Validate error:', error);
    return NextResponse.json(
      { error: 'فشل التحقق: ' + error.message },
      { status: 500 }
    );
  }
}
