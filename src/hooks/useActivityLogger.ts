import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export function useActivityLogger() {
  const { user } = useAuth();

  const logActivity = async (
    action: string,
    entityType?: string,
    entityId?: string,
    details?: any
  ) => {
    if (!user) return;

    try {
      await supabase.from('user_activity').insert({
        user_id: user.id,
        user_email: user.email || 'unknown',
        action,
        entity_type: entityType || null,
        entity_id: entityId || null,
        details: details || null,
      });
    } catch (error) {
      console.error('Failed to log activity:', error);
    }
  };

  return { logActivity };
}
