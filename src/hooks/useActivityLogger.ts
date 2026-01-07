import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../integrations/supabase/client';
import { z } from 'zod';

// Validation schema for activity log details
const activityDetailsSchema = z.record(z.unknown()).refine(
  (obj) => Object.keys(obj).length <= 50,
  { message: 'Activity details cannot exceed 50 keys' }
);

const MAX_DETAILS_SIZE = 10000; // 10KB limit

export function useActivityLogger() {
  const { user } = useAuth();

  const logActivity = async (
    action: string,
    entityType?: string,
    entityId?: string,
    details?: any
  ) => {
    if (!user) return;

    let validatedDetails = null;
    if (details) {
      // Validate structure
      const result = activityDetailsSchema.safeParse(details);
      if (!result.success) {
        console.error('Invalid activity details structure:', result.error);
        return;
      }
      
      // Check size limit
      const size = JSON.stringify(details).length;
      if (size > MAX_DETAILS_SIZE) {
        console.error('Activity details too large (max 10KB)');
        return;
      }
      
      validatedDetails = details;
    }

    try {
      await supabase.from('user_activity').insert({
        user_id: user.id,
        user_email: user.email || 'unknown',
        action,
        entity_type: entityType || null,
        entity_id: entityId || null,
        details: validatedDetails,
      });
    } catch (error) {
      console.error('Failed to log activity:', error);
    }
  };

  return { logActivity };
}
