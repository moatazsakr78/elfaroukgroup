'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  ShieldCheckIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  TABLE_LEVELS,
  ALL_TABLES_ORDERED,
} from '@/app/lib/backup/backup-config';

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  summary: {
    created_at: string;
    created_by: string;
    table_count: number;
    total_rows: number;
  } | null;
}

interface ParsedBackup {
  _meta: any;
  _manifest: Record<string, any>;
  tables: Record<string, any[]>;
}

function validateBackupClientSide(backup: any): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!backup || typeof backup !== 'object') {
    return { valid: false, errors: ['الملف ليس بتنسيق JSON صالح'], warnings: [], summary: null };
  }

  if (!backup._meta) {
    return { valid: false, errors: ['الملف لا يحتوي على بيانات وصفية (_meta)'], warnings: [], summary: null };
  }

  if (backup._meta.format !== BACKUP_FORMAT) {
    if (typeof backup._meta.format === 'string' && backup._meta.format.endsWith('-backup')) {
      warnings.push(`النسخة من مشروع مختلف: ${backup._meta.format}`);
    } else {
      errors.push(`تنسيق الملف غير صحيح: ${backup._meta.format || 'غير محدد'}`);
    }
  }

  if (backup._meta.version !== BACKUP_VERSION) {
    warnings.push(`إصدار النسخة (${backup._meta.version}) يختلف عن الإصدار الحالي (${BACKUP_VERSION})`);
  }

  if (!backup._manifest || typeof backup._manifest !== 'object') {
    errors.push('الملف لا يحتوي على سجل المحتويات (_manifest)');
  }

  if (!backup.tables || typeof backup.tables !== 'object') {
    errors.push('الملف لا يحتوي على بيانات الجداول (tables)');
  }

  if (errors.length > 0) {
    return { valid: false, errors, warnings, summary: null };
  }

  // Verify per-table row counts against manifest
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

    if (tableData.length !== manifestEntry.row_count) {
      errors.push(
        `عدد صفوف ${tableName}: متوقع ${manifestEntry.row_count}، موجود ${tableData.length}`
      );
    }
  }

  const summary = {
    created_at: backup._meta.created_at || 'غير محدد',
    created_by: backup._meta.created_by || 'غير محدد',
    table_count: backup._meta.table_count || tableNames.length,
    total_rows: backup._meta.total_rows || 0,
  };

  return { valid: errors.length === 0, errors, warnings, summary };
}

interface ProgressState {
  operation: 'export' | 'import' | 'idle';
  phase: string;
  progress: number;
  currentTable: string;
  tablesCompleted: number;
  tablesTotal: number;
  error?: string;
}

interface ImportVerification {
  table: string;
  expected: number;
  actual: number;
  match: boolean;
}

interface ImportResult {
  success: boolean;
  results: {
    table: string;
    expected: number;
    inserted: number;
    status: 'ok' | 'partial' | 'error';
    error?: string;
  }[];
  verification: ImportVerification[];
}

export default function BackupSettings() {
  // Export state
  const [includeWhatsapp, setIncludeWhatsapp] = useState(false);
  const [includeAuth, setIncludeAuth] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState('');

  // Import state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedBackup, setParsedBackup] = useState<ParsedBackup | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);

  // Progress polling
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Drag and drop state
  const [isDragging, setIsDragging] = useState(false);

  const startPolling = useCallback(() => {
    if (pollingRef.current) return;
    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch('/api/backup/status');
        const data = await res.json();
        setProgress(data);
        if (data.operation === 'idle' && data.progress === 0 && !data.phase) {
          stopPolling();
        }
      } catch {
        // Ignore polling errors
      }
    }, 500);
  }, []);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  // ============================
  // Export
  // ============================
  const handleExport = async () => {
    setIsExporting(true);
    setExportError('');
    startPolling();

    try {
      const res = await fetch('/api/backup/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ includeWhatsapp, includeAuth }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'فشل التصدير');
      }

      // Download the file
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `elfaroukgroup-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setExportError(err.message);
    } finally {
      setIsExporting(false);
      setTimeout(stopPolling, 3000);
    }
  };

  // ============================
  // File selection & validation
  // ============================
  const handleFileSelect = async (file: File) => {
    setSelectedFile(file);
    setValidation(null);
    setParsedBackup(null);
    setImportResult(null);
    setImportError('');
    setShowConfirm(false);
    setConfirmText('');

    // Client-side validation - no server call needed
    setIsValidating(true);
    try {
      const text = await file.text();
      let backup: any;
      try {
        backup = JSON.parse(text);
      } catch {
        setValidation({
          valid: false,
          errors: ['فشل قراءة الملف - تأكد أنه ملف JSON صالح'],
          warnings: [],
          summary: null,
        });
        return;
      }

      const result = validateBackupClientSide(backup);
      setValidation(result);

      if (result.valid) {
        setParsedBackup(backup);
      }
    } catch (err: any) {
      setValidation({
        valid: false,
        errors: ['فشل التحقق: ' + err.message],
        warnings: [],
        summary: null,
      });
    } finally {
      setIsValidating(false);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.json')) {
      handleFileSelect(file);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  // ============================
  // Import
  // ============================
  const handleImport = async () => {
    if (!parsedBackup || confirmText !== 'تأكيد') return;

    setIsImporting(true);
    setImportError('');
    setImportResult(null);
    setShowConfirm(false);
    startPolling();

    try {
      const backup = parsedBackup;
      const tableList = Object.keys(backup.tables);

      // Phase 1: Init - send meta + table list, server deletes old data
      const initRes = await fetch('/api/backup/import/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ _meta: backup._meta, tableList }),
      });

      if (!initRes.ok) {
        const err = await initRes.json();
        throw new Error(err.error || 'فشل تهيئة الاستيراد');
      }

      const { protectUserId, tablesTotal } = await initRes.json();

      // Phase 2: Send tables one by one in dependency order
      const tablesToImport = TABLE_LEVELS.flat().filter(
        (t) => backup.tables[t] && backup.tables[t].length > 0
      );

      const results: ImportResult['results'] = [];
      const allCircularUpdates: { table: string; entries: Record<string, any> }[] = [];

      for (let i = 0; i < tablesToImport.length; i++) {
        const tableName = tablesToImport[i];
        const rows = backup.tables[tableName];

        const tableRes = await fetch('/api/backup/import/table', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tableName,
            rows,
            protectUserId,
            progressInfo: {
              progress: Math.round(((tablesTotal + i + 1) / (tablesTotal * 2 + 2)) * 100),
              tablesCompleted: i + 1,
              tablesTotal,
            },
          }),
        });

        if (!tableRes.ok) {
          const err = await tableRes.json();
          results.push({
            table: tableName,
            expected: rows.length,
            inserted: 0,
            status: 'error',
            error: err.error || 'فشل الاستيراد',
          });
          continue;
        }

        const tableResult = await tableRes.json();
        results.push({
          table: tableResult.table,
          expected: tableResult.expected,
          inserted: tableResult.inserted,
          status: tableResult.status,
          error: tableResult.error,
        });

        if (tableResult.circularOriginals) {
          allCircularUpdates.push({
            table: tableName,
            entries: tableResult.circularOriginals,
          });
        }
      }

      // Phase 3: Finalize - circular FK updates + verification
      const tableManifest: Record<string, number> = {};
      for (const t of ALL_TABLES_ORDERED) {
        if (backup.tables[t]) {
          tableManifest[t] = backup.tables[t].length;
        }
      }

      const finalRes = await fetch('/api/backup/import/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          circularUpdates: allCircularUpdates,
          tableManifest,
        }),
      });

      if (!finalRes.ok) {
        const err = await finalRes.json();
        throw new Error(err.error || 'فشل إنهاء الاستيراد');
      }

      const { verification } = await finalRes.json();

      const importResult: ImportResult = {
        success: results.every((r) => r.status !== 'error'),
        results,
        verification: verification || [],
      };

      setImportResult(importResult);
    } catch (err: any) {
      setImportError(err.message);
    } finally {
      setIsImporting(false);
      setConfirmText('');
      setTimeout(stopPolling, 5000);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString('ar-EG', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const isOperationRunning = isExporting || isImporting;
  const showProgress = progress && progress.operation !== 'idle' && progress.phase;

  return (
    <div className="space-y-6">
      {/* Section A: Export */}
      <div className="bg-[#1F2937] rounded-lg p-6 border border-gray-700">
        <div className="flex items-center gap-3 mb-4">
          <ArrowDownTrayIcon className="w-6 h-6 text-blue-400" />
          <h3 className="text-white text-lg font-bold">تصدير نسخة احتياطية</h3>
        </div>

        <p className="text-gray-400 text-sm mb-4">
          إنشاء نسخة احتياطية كاملة من قاعدة البيانات. سيتم تحميل ملف JSON يحتوي على جميع البيانات.
        </p>

        {/* Options */}
        <div className="space-y-3 mb-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={includeWhatsapp}
              onChange={(e) => setIncludeWhatsapp(e.target.checked)}
              className="w-4 h-4 rounded border-gray-600 bg-[#2B3544] text-blue-500 focus:ring-blue-500"
            />
            <span className="text-gray-300 text-sm">تضمين رسائل WhatsApp</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={includeAuth}
              onChange={(e) => setIncludeAuth(e.target.checked)}
              className="w-4 h-4 rounded border-gray-600 bg-[#2B3544] text-blue-500 focus:ring-blue-500"
            />
            <span className="text-gray-300 text-sm">تضمين جلسات المصادقة (sessions)</span>
          </label>
        </div>

        {/* Export button */}
        <button
          onClick={handleExport}
          disabled={isOperationRunning}
          className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors text-sm font-medium"
        >
          {isExporting ? (
            <>
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              جاري التصدير...
            </>
          ) : (
            <>
              <ArrowDownTrayIcon className="w-4 h-4" />
              إنشاء نسخة احتياطية
            </>
          )}
        </button>

        {exportError && (
          <div className="mt-3 p-3 bg-red-900/30 border border-red-700 rounded-lg flex items-center gap-2">
            <XCircleIcon className="w-5 h-5 text-red-400 flex-shrink-0" />
            <span className="text-red-300 text-sm">{exportError}</span>
          </div>
        )}
      </div>

      {/* Progress bar (shared for export and import) */}
      {showProgress && (
        <div className="bg-[#1F2937] rounded-lg p-4 border border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-300 text-sm">{progress.phase}</span>
            <span className="text-blue-400 text-sm font-mono">{progress.progress}%</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2.5">
            <div
              className="bg-blue-500 h-2.5 rounded-full transition-all duration-300"
              style={{ width: `${progress.progress}%` }}
            />
          </div>
          {progress.currentTable && (
            <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
              <span>{progress.currentTable}</span>
              <span>{progress.tablesCompleted} / {progress.tablesTotal} جدول</span>
            </div>
          )}
        </div>
      )}

      {/* Section B: Import */}
      <div className="bg-[#1F2937] rounded-lg p-6 border border-gray-700">
        <div className="flex items-center gap-3 mb-4">
          <ArrowUpTrayIcon className="w-6 h-6 text-green-400" />
          <h3 className="text-white text-lg font-bold">استيراد نسخة احتياطية</h3>
        </div>

        {/* Warning */}
        <div className="mb-4 p-3 bg-yellow-900/20 border border-yellow-700/50 rounded-lg flex items-start gap-2">
          <ExclamationTriangleIcon className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
          <span className="text-yellow-300 text-sm">
            الاستعادة ستحل محل كل البيانات الحالية. تأكد من أخذ نسخة احتياطية قبل المتابعة.
          </span>
        </div>

        {/* Drop zone */}
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            isDragging
              ? 'border-blue-400 bg-blue-900/20'
              : 'border-gray-600 hover:border-gray-500 hover:bg-[#2B3544]/50'
          }`}
        >
          <DocumentTextIcon className="w-10 h-10 text-gray-500 mx-auto mb-3" />
          {selectedFile ? (
            <div>
              <p className="text-white text-sm font-medium">{selectedFile.name}</p>
              <p className="text-gray-500 text-xs mt-1">
                {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
              </p>
            </div>
          ) : (
            <div>
              <p className="text-gray-400 text-sm">اسحب ملف النسخة الاحتياطية هنا</p>
              <p className="text-gray-600 text-xs mt-1">أو اضغط لاختيار ملف (.json)</p>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileSelect(file);
            }}
          />
        </div>

        {/* Validation loading */}
        {isValidating && (
          <div className="mt-4 flex items-center gap-2 text-gray-400 text-sm">
            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            جاري التحقق من الملف...
          </div>
        )}

        {/* Validation results */}
        {validation && (
          <div className="mt-4 space-y-3">
            {/* Summary */}
            {validation.summary && (
              <div className="p-3 bg-[#2B3544] rounded-lg space-y-1">
                <div className="flex items-center gap-2 text-sm">
                  <InformationCircleIcon className="w-4 h-4 text-blue-400" />
                  <span className="text-gray-300">تاريخ النسخة: {formatDate(validation.summary.created_at)}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-400 mr-6">المنشئ: {validation.summary.created_by}</span>
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-400 mr-6">
                  <span>{validation.summary.table_count} جدول</span>
                  <span>{validation.summary.total_rows.toLocaleString('ar-EG')} صف</span>
                </div>
              </div>
            )}

            {/* Errors */}
            {validation.errors.map((err, i) => (
              <div key={`err-${i}`} className="flex items-center gap-2 text-sm">
                <XCircleIcon className="w-4 h-4 text-red-400 flex-shrink-0" />
                <span className="text-red-300">{err}</span>
              </div>
            ))}

            {/* Warnings */}
            {validation.warnings.map((warn, i) => (
              <div key={`warn-${i}`} className="flex items-center gap-2 text-sm">
                <ExclamationTriangleIcon className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                <span className="text-yellow-300">{warn}</span>
              </div>
            ))}

            {/* Valid checkmark */}
            {validation.valid && (
              <div className="flex items-center gap-2 text-sm">
                <CheckCircleIcon className="w-4 h-4 text-green-400" />
                <span className="text-green-300">الملف صالح وجاهز للاستيراد</span>
              </div>
            )}

            {/* Import button */}
            {validation.valid && !showConfirm && (
              <button
                onClick={() => setShowConfirm(true)}
                disabled={isOperationRunning}
                className="mt-2 flex items-center gap-2 px-6 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors text-sm font-medium"
              >
                <ArrowUpTrayIcon className="w-4 h-4" />
                استعادة النسخة
              </button>
            )}

            {/* Confirmation dialog */}
            {showConfirm && !isImporting && (
              <div className="p-4 bg-red-900/20 border border-red-700/50 rounded-lg space-y-3">
                <div className="flex items-center gap-2">
                  <ShieldCheckIcon className="w-5 h-5 text-red-400" />
                  <span className="text-red-300 text-sm font-medium">
                    هل أنت متأكد؟ سيتم استبدال جميع البيانات الحالية.
                  </span>
                </div>
                <div>
                  <label className="text-gray-400 text-xs block mb-1">
                    اكتب &quot;تأكيد&quot; للمتابعة
                  </label>
                  <input
                    type="text"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder='تأكيد'
                    className="w-full px-3 py-2 bg-[#2B3544] border border-gray-600 rounded text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-red-500 text-sm text-right"
                    dir="rtl"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleImport}
                    disabled={confirmText !== 'تأكيد'}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded transition-colors text-sm"
                  >
                    تأكيد الاستعادة
                  </button>
                  <button
                    onClick={() => { setShowConfirm(false); setConfirmText(''); }}
                    className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded transition-colors text-sm"
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {importError && (
          <div className="mt-3 p-3 bg-red-900/30 border border-red-700 rounded-lg flex items-center gap-2">
            <XCircleIcon className="w-5 h-5 text-red-400 flex-shrink-0" />
            <span className="text-red-300 text-sm">{importError}</span>
          </div>
        )}

        {/* Import results */}
        {importResult && (
          <div className="mt-4 space-y-3">
            <div className={`flex items-center gap-2 text-sm font-medium ${importResult.success ? 'text-green-400' : 'text-yellow-400'}`}>
              {importResult.success ? (
                <CheckCircleIcon className="w-5 h-5" />
              ) : (
                <ExclamationTriangleIcon className="w-5 h-5" />
              )}
              {importResult.success ? 'تم الاستيراد بنجاح' : 'تم الاستيراد مع بعض المشاكل'}
            </div>

            {/* Failed tables */}
            {importResult.results.filter((r) => r.status !== 'ok').length > 0 && (
              <div className="p-3 bg-[#2B3544] rounded-lg space-y-1 max-h-40 overflow-y-auto scrollbar-hide">
                <p className="text-gray-400 text-xs font-medium mb-2">تفاصيل المشاكل:</p>
                {importResult.results
                  .filter((r) => r.status !== 'ok')
                  .map((r) => (
                    <div key={r.table} className="flex items-center gap-2 text-xs">
                      <span className={r.status === 'error' ? 'text-red-400' : 'text-yellow-400'}>
                        {r.table}
                      </span>
                      <span className="text-gray-500">
                        ({r.inserted}/{r.expected})
                      </span>
                      {r.error && <span className="text-gray-600 truncate">{r.error}</span>}
                    </div>
                  ))}
              </div>
            )}

            {/* Verification summary */}
            <div className="p-3 bg-[#2B3544] rounded-lg">
              <p className="text-gray-400 text-xs font-medium mb-2">نتائج التحقق:</p>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-green-400">
                  ✓ {importResult.verification.filter((v) => v.match).length} متطابق
                </span>
                {importResult.verification.filter((v) => !v.match).length > 0 && (
                  <span className="text-yellow-400">
                    ⚠ {importResult.verification.filter((v) => !v.match).length} غير متطابق
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Section C: Info */}
      <div className="bg-[#1F2937] rounded-lg p-6 border border-gray-700">
        <div className="flex items-center gap-3 mb-3">
          <InformationCircleIcon className="w-6 h-6 text-gray-400" />
          <h3 className="text-white text-lg font-bold">معلومات</h3>
        </div>
        <ul className="space-y-2 text-sm text-gray-400">
          <li>• النسخة الاحتياطية تشمل جميع جداول قاعدة البيانات (81 جدول)</li>
          <li>• الصور والفيديوهات لا يتم تضمينها - فقط روابطها (URLs)</li>
          <li>• حجم النسخة المتوقع: 5-15 ميجابايت</li>
          <li>• المستخدم الحالي لا يتم مسحه أثناء الاستعادة</li>
          <li className="text-yellow-400/80">• الاستعادة ستحل محل كل البيانات الحالية في قاعدة البيانات</li>
        </ul>
      </div>
    </div>
  );
}
