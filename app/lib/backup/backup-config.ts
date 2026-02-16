// Backup system configuration - table ordering, types, constants

export const BACKUP_VERSION = '2.0';
export const BACKUP_FORMAT = 'elfaroukgroup-backup';
export const BATCH_INSERT_SIZE = 500;
export const EXPORT_PAGE_SIZE = 1000;

// ============================================================
// Types
// ============================================================

export interface BackupMeta {
  version: string;
  format: string;
  created_at: string;
  created_by: string;
  schema: 'elfaroukgroup';
  checksum: string;
  table_count: number;
  total_rows: number;
}

export interface BackupManifestEntry {
  row_count: number;
  checksum: string;
}

export interface BackupFile {
  _meta: BackupMeta;
  _manifest: Record<string, BackupManifestEntry>;
  tables: Record<string, any[]>;
}

export interface BackupProgress {
  operation: 'export' | 'import' | 'idle';
  phase: string;
  progress: number;
  currentTable: string;
  tablesCompleted: number;
  tablesTotal: number;
  error?: string;
}

export interface ValidationResult {
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

export interface ImportResult {
  success: boolean;
  results: {
    table: string;
    expected: number;
    inserted: number;
    status: 'ok' | 'partial' | 'error';
    error?: string;
  }[];
  verification: {
    table: string;
    expected: number;
    actual: number;
    match: boolean;
  }[];
}

// ============================================================
// Circular FK definitions - these columns are set to null first,
// then updated after all rows are inserted
// ============================================================

export interface CircularFK {
  table: string;
  column: string;
  referencedTable: string;
}

export const CIRCULAR_FKS: CircularFK[] = [
  { table: 'branches', column: 'manager_id', referencedTable: 'user_profiles' },
  { table: 'user_profiles', column: 'branch_id', referencedTable: 'branches' },
  { table: 'customers', column: 'linked_supplier_id', referencedTable: 'suppliers' },
  { table: 'suppliers', column: 'linked_customer_id', referencedTable: 'customers' },
];

// ============================================================
// Tables ordered by FK dependency levels (Level 0 = no deps)
// ============================================================

export const TABLE_LEVELS: string[][] = [
  // Level 0 - No foreign key dependencies
  [
    'brands',
    'categories',
    'branches',           // manager_id is circular → set null first
    'warehouses',
    'customer_groups',
    'supplier_groups',
    'payment_methods',
    'shipping_companies',
    'user_roles',
    'permission_categories',
    'permission_templates',
    'product_size_groups',
    'product_display_settings',
    'background_colors',
    'product_card_colors',
    'custom_currencies',
    'social_media_links',
    'social_media_settings',
  ],

  // Level 1 → depends on Level 0
  [
    'auth_users',
    'shipping_governorates',
    'permission_definitions',
    'permission_template_restrictions',
    'permissions',
    'system_settings',
    'store_theme_colors',
    'custom_sections',
    'store_categories',
  ],

  // Level 2 → depends on Level 1
  [
    'auth_sessions',
    'auth_accounts',
    'auth_verification_tokens',
    'user_profiles',       // branch_id is circular → set null first
    'role_restrictions',
    'permission_restrictions',
    'shipping_areas',
    'pos_tabs_state',
    'user_branch_assignments',
    'product_import_history',
  ],

  // Level 3 → depends on Level 2
  [
    'products',
    'suppliers',           // linked_customer_id is circular → set null first
    'customers',           // linked_supplier_id is circular → set null first
    'records',
    'api_settings',
    'expenses',
    'cashbox_entries',
    'cash_drawers',
    'user_column_preferences',
    'user_preferences',
  ],

  // Level 4 → depends on Level 3
  [
    'product_images',
    'product_videos',
    'product_variants',
    'product_sizes',
    'product_votes',
    'product_ratings',
    'product_cost_tracking',
    'product_color_shape_definitions',
    'product_size_group_items',
    'product_location_thresholds',
    'inventory',
    'branch_stocks',
    'warehouse_stocks',
    'brand_products',
    'store_category_products',
    'favorites',
    'cart_items',
    'purchase_invoices',
    'orders',
    'whatsapp_contacts',
    'whatsapp_lid_mappings',
    'customer_merges',
    'supplier_merges',
  ],

  // Level 5 → depends on Level 4
  [
    'sales',
    'purchase_invoice_items',
    'order_items',
    'payment_receipts',
    'product_variant_quantities',
    'whatsapp_messages',
    'whatsapp_reactions',
    'customer_payments',
    'supplier_payments',
  ],

  // Level 6 → depends on Level 5
  [
    'sale_items',
    'cash_drawer_transactions',
  ],
];

// Flat ordered list of all tables
export const ALL_TABLES_ORDERED = TABLE_LEVELS.flat();

// Tables that contain WhatsApp data (optional export)
export const WHATSAPP_TABLES = [
  'whatsapp_contacts',
  'whatsapp_lid_mappings',
  'whatsapp_messages',
  'whatsapp_reactions',
];

// Tables that contain auth session data (optional export)
export const AUTH_SESSION_TABLES = [
  'auth_sessions',
  'auth_accounts',
  'auth_verification_tokens',
];
