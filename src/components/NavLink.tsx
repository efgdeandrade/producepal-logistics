import { NavLink as RouterNavLink, NavLinkProps as RouterNavLinkProps } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface NavLinkProps extends Omit<RouterNavLinkProps, 'className'> {
  className?: string;
  activeClassName?: string;
  children: React.ReactNode;
}

export function NavLink({ 
  className = '', 
  activeClassName = 'bg-sidebar-accent text-sidebar-accent-foreground font-medium', 
  children, 
  ...props 
}: NavLinkProps) {
  return (
    <RouterNavLink
      className={({ isActive }) =>
        cn(className, isActive && activeClassName)
      }
      {...props}
    >
      {children}
    </RouterNavLink>
  );
}
