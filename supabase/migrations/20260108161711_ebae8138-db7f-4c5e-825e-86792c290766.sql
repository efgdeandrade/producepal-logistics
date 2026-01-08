-- Insert default permissions for the interim role
INSERT INTO public.role_permissions (role, resource, can_view, can_create, can_update, can_delete) VALUES
  ('interim', 'dashboard', true, false, false, false),
  ('interim', 'orders', true, true, false, false),
  ('interim', 'analytics', true, false, false, false),
  ('interim', 'logistics', true, false, false, false),
  ('interim', 'production', true, false, false, false),
  ('interim', 'settings', false, false, false, false),
  ('interim', 'users', false, false, false, false),
  ('interim', 'others', true, false, false, false);