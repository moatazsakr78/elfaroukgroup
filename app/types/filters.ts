// Report Filters Types
// تعريف أنواع الفلاتر للتقارير

// خيار فلتر واحد
export interface FilterOption {
  id: string;
  name: string;
  secondaryText?: string; // مثل رقم الهاتف أو البريد الإلكتروني
  groupId?: string; // للربط بالمجموعة
}

// مجموعة فلترة
export interface FilterGroup {
  id: string;
  name: string;
  parentId?: string | null;
  itemCount?: number;
}

// خيار موقع (فرع أو مخزن)
export interface LocationOption {
  id: string;
  name: string;
  type: 'branch' | 'warehouse';
  label: string; // مثل "فرع: المحل الرئيسي"
}

// نتيجة الفلتر البسيط (اختيار واحد)
export interface SimpleFiltersResult {
  customerId: string | null;
  customerGroupId: string | null;
  userId: string | null;
  productId: string | null;
  categoryId: string | null;
  safeId: string | null;
  locationId: string | null;
  locationType: 'branch' | 'warehouse' | null;
}

// نتيجة الفلتر المتعدد (اختيار متعدد)
export interface MultiFiltersResult {
  customerIds: string[];
  customerGroupIds: string[];
  userIds: string[];
  productIds: string[];
  categoryIds: string[];
  safeIds: string[];
  locationIds: string[]; // فروع ومخازن مدمجة
}

// القيم الافتراضية للفلتر البسيط
export const initialSimpleFilters: SimpleFiltersResult = {
  customerId: null,
  customerGroupId: null,
  userId: null,
  productId: null,
  categoryId: null,
  safeId: null,
  locationId: null,
  locationType: null
};

// القيم الافتراضية للفلتر المتعدد
export const initialMultiFilters: MultiFiltersResult = {
  customerIds: [],
  customerGroupIds: [],
  userIds: [],
  productIds: [],
  categoryIds: [],
  safeIds: [],
  locationIds: []
};

// نوع الفلتر النشط
export type ActiveFilterType = 'simple' | 'multi' | null;

// بيانات الفلاتر المجمعة
export interface ReportFiltersData {
  customers: FilterOption[];
  customerGroups: FilterGroup[];
  users: FilterOption[];
  products: FilterOption[];
  categories: FilterGroup[];
  safes: FilterOption[];
  locations: LocationOption[]; // فروع ومخازن مدمجة
  isLoading: boolean;
  error: string | null;
}

// دالة مساعدة لحساب عدد الفلاتر النشطة في الفلتر البسيط
export function getSimpleFiltersCount(filters: SimpleFiltersResult): number {
  let count = 0;
  if (filters.customerId) count++;
  if (filters.customerGroupId) count++;
  if (filters.userId) count++;
  if (filters.productId) count++;
  if (filters.categoryId) count++;
  if (filters.safeId) count++;
  if (filters.locationId) count++;
  return count;
}

// دالة مساعدة لحساب عدد الفلاتر النشطة في الفلتر المتعدد
export function getMultiFiltersCount(filters: MultiFiltersResult): number {
  return (
    filters.customerIds.length +
    filters.customerGroupIds.length +
    filters.userIds.length +
    filters.productIds.length +
    filters.categoryIds.length +
    filters.safeIds.length +
    filters.locationIds.length
  );
}
