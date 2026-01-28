import { ReactNode, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: string;
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { user, loading, hasRole, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Check if user has required access (admin can access everything)
  const hasRequiredAccess = !requiredRole || isAdmin() || hasRole(requiredRole);

  useEffect(() => {
    if (!loading && !user) {
      const from = `${location.pathname}${location.search}${location.hash}`;
      navigate('/auth', {
        replace: true,
        state: { from },
      });
    }

    if (!loading && user && requiredRole && !hasRequiredAccess) {
      navigate('/');
    }
  }, [user, loading, requiredRole, hasRequiredAccess, navigate, location.pathname, location.search, location.hash]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (requiredRole && !hasRequiredAccess) {
    return null;
  }

  return <>{children}</>;
}
