import { supabase } from '@/app/lib/supabase/client';

export type EntityType =
  | 'product'
  | 'sale'
  | 'customer'
  | 'supplier'
  | 'inventory'
  | 'purchase'
  | 'order'
  | 'expense'
  | 'cash_drawer'
  | 'payment_method'
  | 'category'
  | 'setting'
  | 'permission'
  | 'user';

export type ActionType = 'create' | 'update' | 'delete';

export interface LogActivityParams {
  userId?: string;
  userName?: string;
  entityType: EntityType;
  actionType: ActionType;
  entityId?: string;
  entityName?: string;
  description?: string;
  details?: Record<string, any>;
}

const entityLabels: Record<EntityType, string> = {
  product: 'منتج',
  sale: 'فاتورة',
  customer: 'عميل',
  supplier: 'مورد',
  inventory: 'مخزون',
  purchase: 'فاتورة شراء',
  order: 'طلب',
  expense: 'مصروف',
  cash_drawer: 'خزنة',
  payment_method: 'طريقة دفع',
  category: 'صنف',
  setting: 'إعداد',
  permission: 'صلاحية',
  user: 'مستخدم',
};

const actionLabels: Record<ActionType, string> = {
  create: 'أضاف',
  update: 'عدّل',
  delete: 'حذف',
};

function generateDescription(
  actionType: ActionType,
  entityType: EntityType,
  entityName?: string,
): string {
  const action = actionLabels[actionType];
  const entity = entityLabels[entityType];
  if (entityName) {
    return `${action} ${entity}: ${entityName}`;
  }
  return `${action} ${entity}`;
}

/**
 * Fire-and-forget activity logger.
 * Never await this - it runs in the background.
 */
export function logActivity(params: LogActivityParams): void {
  const {
    userId,
    userName = 'نظام',
    entityType,
    actionType,
    entityId,
    entityName,
    details = {},
  } = params;

  const description =
    params.description || generateDescription(actionType, entityType, entityName);

  supabase
    .from('activity_logs' as any)
    .insert({
      user_id: userId || null,
      user_name: userName,
      entity_type: entityType,
      action_type: actionType,
      entity_id: entityId || null,
      entity_name: entityName || null,
      description,
      details,
    } as any)
    .then(({ error }) => {
      if (error) {
        console.error('Activity log error:', error.message);
      }
    });
}
