'use client';

import { useCallback } from 'react';
import { useUserProfile } from '@/lib/contexts/UserProfileContext';
import { logActivity, type EntityType, type ActionType } from '@/app/lib/services/activityLogger';

interface LogParams {
  entityType: EntityType;
  actionType: ActionType;
  entityId?: string;
  entityName?: string;
  description?: string;
  details?: Record<string, any>;
}

export function useActivityLogger() {
  const { profile } = useUserProfile();

  const log = useCallback(
    (params: LogParams) => {
      logActivity({
        userId: profile?.id,
        userName: profile?.full_name || 'مستخدم',
        ...params,
      });
    },
    [profile?.id, profile?.full_name],
  );

  return log;
}
