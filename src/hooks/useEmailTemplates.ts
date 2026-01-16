import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface EmailTemplate {
  id: string;
  name: string;
  description: string | null;
  subject_template: string;
  body_template: string;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function useEmailTemplates() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('email_confirmation_templates')
        .select('*')
        .order('is_default', { ascending: false })
        .order('name');

      if (error) throw error;
      setTemplates(data || []);
    } catch (error: any) {
      console.error('Error fetching templates:', error);
      toast({
        title: 'Error',
        description: 'Failed to load email templates',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const createTemplate = async (template: Omit<EmailTemplate, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data, error } = await supabase
        .from('email_confirmation_templates')
        .insert(template)
        .select()
        .single();

      if (error) throw error;

      setTemplates(prev => [...prev, data]);
      toast({
        title: 'Success',
        description: 'Template created successfully',
      });
      return data;
    } catch (error: any) {
      console.error('Error creating template:', error);
      toast({
        title: 'Error',
        description: 'Failed to create template',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const updateTemplate = async (id: string, updates: Partial<EmailTemplate>) => {
    try {
      const { data, error } = await supabase
        .from('email_confirmation_templates')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      setTemplates(prev => prev.map(t => t.id === id ? data : t));
      toast({
        title: 'Success',
        description: 'Template updated successfully',
      });
      return data;
    } catch (error: any) {
      console.error('Error updating template:', error);
      toast({
        title: 'Error',
        description: 'Failed to update template',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const deleteTemplate = async (id: string) => {
    try {
      const { error } = await supabase
        .from('email_confirmation_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setTemplates(prev => prev.filter(t => t.id !== id));
      toast({
        title: 'Success',
        description: 'Template deleted successfully',
      });
    } catch (error: any) {
      console.error('Error deleting template:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete template',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const setDefaultTemplate = async (id: string) => {
    try {
      // First, unset all defaults
      await supabase
        .from('email_confirmation_templates')
        .update({ is_default: false })
        .neq('id', id);

      // Then set the new default
      const { data, error } = await supabase
        .from('email_confirmation_templates')
        .update({ is_default: true })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      setTemplates(prev => prev.map(t => ({
        ...t,
        is_default: t.id === id,
      })));
      
      toast({
        title: 'Success',
        description: 'Default template updated',
      });
      return data;
    } catch (error: any) {
      console.error('Error setting default template:', error);
      toast({
        title: 'Error',
        description: 'Failed to set default template',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const duplicateTemplate = async (id: string) => {
    const template = templates.find(t => t.id === id);
    if (!template) return;

    try {
      const { data, error } = await supabase
        .from('email_confirmation_templates')
        .insert({
          name: `${template.name} (Copy)`,
          description: template.description,
          subject_template: template.subject_template,
          body_template: template.body_template,
          is_default: false,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;

      setTemplates(prev => [...prev, data]);
      toast({
        title: 'Success',
        description: 'Template duplicated successfully',
      });
      return data;
    } catch (error: any) {
      console.error('Error duplicating template:', error);
      toast({
        title: 'Error',
        description: 'Failed to duplicate template',
        variant: 'destructive',
      });
      throw error;
    }
  };

  return {
    templates,
    loading,
    refetch: fetchTemplates,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    setDefaultTemplate,
    duplicateTemplate,
  };
}
