'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/app/lib/supabase/client';
import { RoleType } from '@/types/permissions';

export interface PermissionTemplate {
  id: string;
  name: string;
  description: string | null;
  role_type: RoleType;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PermissionTemplateRestriction {
  id: string;
  template_id: string;
  permission_code: string;
  created_at: string;
}

export interface TemplateWithRestrictions extends PermissionTemplate {
  restrictions: string[]; // Array of restricted permission codes
}

interface UsePermissionTemplatesReturn {
  templates: PermissionTemplate[];
  loading: boolean;
  error: string | null;

  // CRUD operations
  createTemplate: (name: string, roleType: RoleType, description?: string) => Promise<PermissionTemplate | null>;
  updateTemplate: (id: string, name: string, description?: string) => Promise<boolean>;
  deleteTemplate: (id: string) => Promise<boolean>;

  // Get template with its restrictions
  getTemplateWithRestrictions: (templateId: string) => Promise<TemplateWithRestrictions | null>;

  // Restriction operations for a specific template
  getTemplateRestrictions: (templateId: string) => Promise<string[]>;
  addRestriction: (templateId: string, permissionCode: string) => Promise<boolean>;
  removeRestriction: (templateId: string, permissionCode: string) => Promise<boolean>;
  setRestrictions: (templateId: string, permissionCodes: string[]) => Promise<boolean>;

  // Filter by role type
  getTemplatesByRole: (roleType: RoleType) => PermissionTemplate[];

  // Refresh data
  refetch: () => Promise<void>;
}

export function usePermissionTemplates(): UsePermissionTemplatesReturn {
  const [templates, setTemplates] = useState<PermissionTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch all templates
  const fetchTemplates = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await (supabase as any)
        .from('permission_templates')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      setTemplates((data || []) as PermissionTemplate[]);
    } catch (err) {
      console.error('Error fetching templates:', err);
      setError(err instanceof Error ? err.message : 'فشل في جلب قوالب الصلاحيات');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  // Create new template
  const createTemplate = useCallback(
    async (name: string, roleType: RoleType, description?: string): Promise<PermissionTemplate | null> => {
      try {
        console.log('[usePermissionTemplates] Creating template:', { name, roleType, description });

        const { data, error } = await (supabase as any)
          .from('permission_templates')
          .insert([{ name, role_type: roleType, description: description || null }])
          .select()
          .single();

        console.log('[usePermissionTemplates] Insert result:', { data, error });

        if (error) throw error;

        const newTemplate = data as PermissionTemplate;
        setTemplates((prev) => [newTemplate, ...prev]);
        console.log('[usePermissionTemplates] Template created successfully:', newTemplate);
        return newTemplate;
      } catch (err) {
        console.error('[usePermissionTemplates] Error creating template:', err);
        setError(err instanceof Error ? err.message : 'فشل في إنشاء الصلاحية');
        return null;
      }
    },
    []
  );

  // Get templates filtered by role type
  const getTemplatesByRole = useCallback(
    (roleType: RoleType): PermissionTemplate[] => {
      return templates.filter((t) => t.role_type === roleType);
    },
    [templates]
  );

  // Update template
  const updateTemplate = useCallback(
    async (id: string, name: string, description?: string): Promise<boolean> => {
      try {
        const { error } = await (supabase as any)
          .from('permission_templates')
          .update({
            name,
            description: description || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id);

        if (error) throw error;

        setTemplates((prev) =>
          prev.map((t) =>
            t.id === id
              ? { ...t, name, description: description || null, updated_at: new Date().toISOString() }
              : t
          )
        );
        return true;
      } catch (err) {
        console.error('Error updating template:', err);
        setError(err instanceof Error ? err.message : 'فشل في تحديث القالب');
        return false;
      }
    },
    []
  );

  // Delete template (soft delete by setting is_active to false)
  const deleteTemplate = useCallback(async (id: string): Promise<boolean> => {
    try {
      const { error } = await (supabase as any)
        .from('permission_templates')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;

      setTemplates((prev) => prev.filter((t) => t.id !== id));
      return true;
    } catch (err) {
      console.error('Error deleting template:', err);
      setError(err instanceof Error ? err.message : 'فشل في حذف القالب');
      return false;
    }
  }, []);

  // Get template restrictions
  const getTemplateRestrictions = useCallback(
    async (templateId: string): Promise<string[]> => {
      try {
        const { data, error } = await (supabase as any)
          .from('permission_template_restrictions')
          .select('permission_code')
          .eq('template_id', templateId);

        if (error) throw error;

        return (data || []).map((r: PermissionTemplateRestriction) => r.permission_code);
      } catch (err) {
        console.error('Error fetching template restrictions:', err);
        return [];
      }
    },
    []
  );

  // Get template with its restrictions
  const getTemplateWithRestrictions = useCallback(
    async (templateId: string): Promise<TemplateWithRestrictions | null> => {
      try {
        const template = templates.find((t) => t.id === templateId);
        if (!template) {
          // Fetch from database if not in local state
          const { data, error } = await (supabase as any)
            .from('permission_templates')
            .select('*')
            .eq('id', templateId)
            .single();

          if (error) throw error;
          if (!data) return null;

          const restrictions = await getTemplateRestrictions(templateId);
          return { ...(data as PermissionTemplate), restrictions };
        }

        const restrictions = await getTemplateRestrictions(templateId);
        return { ...template, restrictions };
      } catch (err) {
        console.error('Error fetching template with restrictions:', err);
        return null;
      }
    },
    [templates, getTemplateRestrictions]
  );

  // Add restriction to template
  const addRestriction = useCallback(
    async (templateId: string, permissionCode: string): Promise<boolean> => {
      try {
        const { error } = await (supabase as any)
          .from('permission_template_restrictions')
          .insert([{ template_id: templateId, permission_code: permissionCode }]);

        if (error) {
          // Ignore duplicate constraint error
          if (error.code === '23505') return true;
          throw error;
        }

        return true;
      } catch (err) {
        console.error('Error adding restriction:', err);
        setError(err instanceof Error ? err.message : 'فشل في إضافة القيد');
        return false;
      }
    },
    []
  );

  // Remove restriction from template
  const removeRestriction = useCallback(
    async (templateId: string, permissionCode: string): Promise<boolean> => {
      try {
        const { error } = await (supabase as any)
          .from('permission_template_restrictions')
          .delete()
          .eq('template_id', templateId)
          .eq('permission_code', permissionCode);

        if (error) throw error;

        return true;
      } catch (err) {
        console.error('Error removing restriction:', err);
        setError(err instanceof Error ? err.message : 'فشل في إزالة القيد');
        return false;
      }
    },
    []
  );

  // Set all restrictions for a template (replace existing)
  const setRestrictions = useCallback(
    async (templateId: string, permissionCodes: string[]): Promise<boolean> => {
      try {
        // Delete all existing restrictions
        const { error: deleteError } = await (supabase as any)
          .from('permission_template_restrictions')
          .delete()
          .eq('template_id', templateId);

        if (deleteError) throw deleteError;

        // Insert new restrictions if any
        if (permissionCodes.length > 0) {
          const { error: insertError } = await (supabase as any)
            .from('permission_template_restrictions')
            .insert(
              permissionCodes.map((code) => ({
                template_id: templateId,
                permission_code: code,
              }))
            );

          if (insertError) throw insertError;
        }

        return true;
      } catch (err) {
        console.error('Error setting restrictions:', err);
        setError(err instanceof Error ? err.message : 'فشل في تحديث القيود');
        return false;
      }
    },
    []
  );

  return {
    templates,
    loading,
    error,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    getTemplateWithRestrictions,
    getTemplateRestrictions,
    addRestriction,
    removeRestriction,
    setRestrictions,
    getTemplatesByRole,
    refetch: fetchTemplates,
  };
}
