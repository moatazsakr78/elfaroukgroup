import { BackupProgress } from './backup-config';

const defaultProgress: BackupProgress = {
  operation: 'idle',
  phase: '',
  progress: 0,
  currentTable: '',
  tablesCompleted: 0,
  tablesTotal: 0,
};

// Use globalThis to share state across API routes in the same Node.js process
const globalKey = '__backup_progress__';

function getGlobal(): BackupProgress {
  return (globalThis as any)[globalKey] || { ...defaultProgress };
}

function setGlobal(p: BackupProgress) {
  (globalThis as any)[globalKey] = p;
}

export function getProgress(): BackupProgress {
  return getGlobal();
}

export function setProgress(update: Partial<BackupProgress>) {
  setGlobal({ ...getGlobal(), ...update });
}

export function resetProgress() {
  setGlobal({ ...defaultProgress });
}
