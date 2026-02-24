'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export interface ActivityLogEntry {
  id: string;
  user_id: string | null;
  user_name: string;
  entity_type: string;
  action_type: string;
  entity_id: string | null;
  entity_name: string | null;
  description: string;
  details: Record<string, any>;
  created_at: string;
}

export interface ActivityLogsFilters {
  entityTypes: string[];
  actionTypes: string[];
  startDate?: string;
  endDate?: string;
  search: string;
}

interface UseActivityLogsResult {
  logs: ActivityLogEntry[];
  loading: boolean;
  error: string | null;
  total: number;
  page: number;
  totalPages: number;
  setPage: (page: number) => void;
  filters: ActivityLogsFilters;
  setFilters: (filters: ActivityLogsFilters) => void;
  refresh: () => void;
}

const LIMIT = 20;

export function useActivityLogs(): UseActivityLogsResult {
  const [logs, setLogs] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [filters, setFiltersState] = useState<ActivityLogsFilters>({
    entityTypes: [],
    actionTypes: [],
    search: '',
  });
  const isFetchingRef = useRef(false);

  const setFilters = useCallback((newFilters: ActivityLogsFilters) => {
    setFiltersState(newFilters);
    setPage(1);
  }, []);

  const fetchLogs = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(LIMIT));

      if (filters.entityTypes.length > 0) {
        params.set('entityType', filters.entityTypes.join(','));
      }
      if (filters.actionTypes.length > 0) {
        params.set('actionType', filters.actionTypes.join(','));
      }
      if (filters.startDate) params.set('startDate', filters.startDate);
      if (filters.endDate) params.set('endDate', filters.endDate);
      if (filters.search) params.set('search', filters.search);

      const res = await fetch(`/api/activity-logs?${params.toString()}`);

      if (!res.ok) {
        throw new Error('Failed to fetch logs');
      }

      const data = await res.json();
      setLogs(data.logs || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 0);
    } catch (err) {
      console.error('Error fetching activity logs:', err);
      setError('حدث خطأ في تحميل سجل النشاط');
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [page, filters]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const refresh = useCallback(() => {
    fetchLogs();
  }, [fetchLogs]);

  return {
    logs,
    loading,
    error,
    total,
    page,
    totalPages,
    setPage,
    filters,
    setFilters,
    refresh,
  };
}
