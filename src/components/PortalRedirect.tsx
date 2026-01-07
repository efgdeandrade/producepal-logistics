import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

const roleToPortal: Record<string, string> = {
  driver: '/logistics',
  picker: '/distribution/picker',
  production: '/production',
  hr: '/hr',
  import: '/import',
  distribution: '/distribution',
  admin: '/', // Admin goes to executive dashboard
};

export function usePortalRedirect() {
  const { user, roles, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [hasRedirected, setHasRedirected] = useState(false);

  useEffect(() => {
    if (loading || hasRedirected || !user) return;

    // Only redirect from auth page after login
    if (location.pathname !== '/auth') return;

    const redirectToPortal = async () => {
      try {
        // First check if user has a saved default portal preference
        const { data: profile } = await supabase
          .from('profiles')
          .select('default_portal')
          .eq('id', user.id)
          .single();

        if (profile?.default_portal) {
          const portalPath = `/${profile.default_portal}`;
          setHasRedirected(true);
          navigate(portalPath, { replace: true });
          return;
        }

        // Otherwise, redirect based on their primary role
        if (roles.length > 0) {
          // Find the first matching portal for their roles
          for (const role of roles) {
            if (roleToPortal[role]) {
              setHasRedirected(true);
              navigate(roleToPortal[role], { replace: true });
              return;
            }
          }
        }

        // Default to executive dashboard if no role match
        setHasRedirected(true);
        navigate('/', { replace: true });
      } catch (error) {
        console.error('Portal redirect error:', error);
        navigate('/', { replace: true });
      }
    };

    redirectToPortal();
  }, [user, roles, loading, location.pathname, navigate, hasRedirected]);

  return { loading };
}

export function PortalRedirect({ children }: { children: React.ReactNode }) {
  usePortalRedirect();
  return <>{children}</>;
}
