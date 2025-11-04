import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function usePermissions() {
  const { roles, isAdmin } = useAuth();
  const [permissions, setPermissions] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPermissions();
  }, [roles]);

  const loadPermissions = async () => {
    try {
      if (isAdmin()) {
        // Admin has all permissions
        setPermissions({
          dashboard: { can_view: true },
          orders: { can_view: true },
          others: { can_view: true },
          logistics: { can_view: true },
          production: { can_view: true },
          analytics: { can_view: true },
          settings: { can_view: true },
          users: { can_view: true },
        });
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('role_permissions')
        .select('*')
        .in('role', roles as any);

      if (error) throw error;

      // Aggregate permissions across all user roles
      const aggregated: Record<string, any> = {};
      data?.forEach((perm) => {
        if (!aggregated[perm.resource]) {
          aggregated[perm.resource] = {
            can_view: false,
            can_create: false,
            can_update: false,
            can_delete: false,
          };
        }
        // If any role has a permission, the user has it
        aggregated[perm.resource].can_view = aggregated[perm.resource].can_view || perm.can_view;
        aggregated[perm.resource].can_create = aggregated[perm.resource].can_create || perm.can_create;
        aggregated[perm.resource].can_update = aggregated[perm.resource].can_update || perm.can_update;
        aggregated[perm.resource].can_delete = aggregated[perm.resource].can_delete || perm.can_delete;
      });

      setPermissions(aggregated);
    } catch (error) {
      console.error('Error loading permissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const canView = (resource: string) => {
    return isAdmin() || permissions[resource]?.can_view || false;
  };

  const canCreate = (resource: string) => {
    return isAdmin() || permissions[resource]?.can_create || false;
  };

  const canUpdate = (resource: string) => {
    return isAdmin() || permissions[resource]?.can_update || false;
  };

  const canDelete = (resource: string) => {
    return isAdmin() || permissions[resource]?.can_delete || false;
  };

  return {
    permissions,
    loading,
    canView,
    canCreate,
    canUpdate,
    canDelete,
  };
}
