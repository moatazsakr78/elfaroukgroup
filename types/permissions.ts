// تعريفات نظام الصلاحيات

/**
 * تصنيف الصلاحيات
 */
export interface PermissionCategory {
  id: string;
  name: string;
  name_en: string;
  icon: string | null;
  sort_order: number;
  is_active: boolean;
  parent_type: 'admin' | 'store';
  created_at: string;
  updated_at: string;
}

/**
 * تعريف الصلاحية
 */
export interface PermissionDefinition {
  id: string;
  category_id: string;
  code: string;
  name: string;
  description: string | null;
  permission_type: 'button' | 'feature' | 'view';
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * قيد الصلاحية (المنطق المعكوس: وجود القيد = الصلاحية ممنوعة)
 */
export interface RoleRestriction {
  id: string;
  role_id: string;
  permission_code: string;
  created_at: string;
  created_by: string | null;
}

/**
 * تصنيف الصلاحيات مع الصلاحيات المرتبطة
 */
export interface PermissionCategoryWithPermissions extends PermissionCategory {
  permissions: PermissionDefinition[];
}

/**
 * إحصائيات التصنيف
 */
export interface CategoryStats {
  categoryId: string;
  total: number;
  restricted: number;
}

/**
 * بيانات إنشاء صلاحية جديدة
 */
export interface CreatePermissionInput {
  category_id: string;
  code: string;
  name: string;
  description?: string;
  permission_type: 'button' | 'feature' | 'view';
}

/**
 * بيانات تحديث صلاحية
 */
export interface UpdatePermissionInput {
  name?: string;
  description?: string;
  permission_type?: 'button' | 'feature' | 'view';
  is_active?: boolean;
}

/**
 * بيانات إنشاء تصنيف جديد
 */
export interface CreateCategoryInput {
  name: string;
  name_en: string;
  icon?: string;
  sort_order?: number;
  parent_type?: 'admin' | 'store';
}

/**
 * أنواع الصلاحيات
 */
export type PermissionType = 'button' | 'feature' | 'view';

/**
 * ترجمة أنواع الصلاحيات
 */
export const PERMISSION_TYPE_LABELS: Record<PermissionType, string> = {
  button: 'زر',
  feature: 'ميزة',
  view: 'عرض',
};

/**
 * ألوان أنواع الصلاحيات
 */
export const PERMISSION_TYPE_COLORS: Record<PermissionType, string> = {
  button: 'bg-blue-500/20 text-blue-400',
  feature: 'bg-green-500/20 text-green-400',
  view: 'bg-purple-500/20 text-purple-400',
};

/**
 * أيقونات التصنيفات
 */
export const CATEGORY_ICONS: Record<string, string> = {
  // صفحات الإدارة
  pos: 'ShoppingCartIcon',
  products: 'CubeIcon',
  inventory: 'ArchiveBoxIcon',
  customers: 'UserGroupIcon',
  suppliers: 'TruckIcon',
  customer_orders: 'ClipboardDocumentListIcon',
  safes: 'BanknotesIcon',
  reports: 'ChartBarIcon',
  whatsapp: 'ChatBubbleLeftRightIcon',
  permissions: 'ShieldCheckIcon',
  settings: 'Cog6ToothIcon',
  // صفحات المتجر
  store_orders: 'ClipboardDocumentListIcon',
  store_products: 'CubeIcon',
  store_management: 'BuildingStorefrontIcon',
  shipping_details: 'TruckIcon',
};

/**
 * أنواع الأدوار المتاحة
 */
export type RoleType = 'أدمن رئيسي' | 'موظف' | 'عميل' | 'جملة';

/**
 * قائمة الأدوار الثابتة
 */
export const ROLE_TYPES: RoleType[] = ['أدمن رئيسي', 'موظف', 'عميل', 'جملة'];

/**
 * ألوان الأدوار
 */
export const ROLE_TYPE_COLORS: Record<RoleType, string> = {
  'أدمن رئيسي': 'bg-red-500/20 text-red-400',
  'موظف': 'bg-orange-500/20 text-orange-400',
  'عميل': 'bg-blue-500/20 text-blue-400',
  'جملة': 'bg-green-500/20 text-green-400',
};

/**
 * قالب الصلاحيات
 */
export interface PermissionTemplate {
  id: string;
  name: string;
  description: string | null;
  role_type: RoleType;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * قيد قالب الصلاحيات (الصلاحيات الممنوعة في القالب)
 */
export interface PermissionTemplateRestriction {
  id: string;
  template_id: string;
  permission_code: string;
  created_at: string;
}

/**
 * قالب الصلاحيات مع القيود
 */
export interface TemplateWithRestrictions extends PermissionTemplate {
  restrictions: string[];
}

/**
 * عقدة شجرة الصلاحيات (للعرض في صفحة الصلاحيات)
 */
export interface PermissionTreeNode {
  id: string;
  name: string;
  name_en?: string;
  pageAccessCode?: string;  // كود صلاحية الصفحة: 'page_access.pos', 'page_access.products', etc.
  icon?: React.ComponentType<{ className?: string }>;
  count?: { selected: number; total: number };
  children?: PermissionTreeNode[];
  isExpanded?: boolean;
}

/**
 * خريطة أكواد صلاحيات الصفحات
 */
export const PAGE_ACCESS_MAP: Record<string, string> = {
  '/dashboard': 'page_access.dashboard',
  '/pos': 'page_access.pos',
  '/products': 'page_access.products',
  '/inventory': 'page_access.inventory',
  '/customers': 'page_access.customers',
  '/suppliers': 'page_access.suppliers',
  '/customer-orders': 'page_access.customer_orders',
  '/whatsapp': 'page_access.whatsapp',
  '/safes': 'page_access.safes',
  '/reports': 'page_access.reports',
  '/permissions': 'page_access.permissions',
  '/settings': 'page_access.settings',
  '/activity-logs': 'page_access.activity_logs',
  // صفحات المتجر
  '/admin/products': 'page_access.store_products',
  '/shipping': 'page_access.shipping_details',
};
