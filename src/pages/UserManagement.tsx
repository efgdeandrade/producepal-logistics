import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { UserPlus, Trash2, Mail, Edit } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';

const inviteSchema = z.object({
  email: z.string().email({ message: 'Invalid email address' }),
  fullName: z.string().min(2, { message: 'Name must be at least 2 characters' }),
  role: z.enum(['admin', 'management', 'driver', 'production', 'logistics', 'accounting', 'manager']),
});

interface Profile {
  id: string;
  email: string;
  full_name: string;
  created_at: string;
  roles: string[];
}

export default function UserManagement() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editRolesOpen, setEditRolesOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [inviteForm, setInviteForm] = useState({
    email: '',
    fullName: '',
    role: 'driver' as const,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const availableRoles = ['admin', 'management', 'driver', 'production', 'logistics', 'accounting', 'manager'] as const;
  type AppRole = typeof availableRoles[number];

  const fetchUsers = async () => {
    setLoading(true);
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, full_name, created_at')
      .order('created_at', { ascending: false });

    if (profileError) {
      toast({
        title: 'Error',
        description: 'Failed to fetch users',
        variant: 'destructive',
      });
      setLoading(false);
      return;
    }

    const { data: userRoles, error: rolesError } = await supabase
      .from('user_roles')
      .select('user_id, role');

    if (rolesError) {
      toast({
        title: 'Error',
        description: 'Failed to fetch roles',
        variant: 'destructive',
      });
      setLoading(false);
      return;
    }

    const usersWithRoles = profiles.map((profile) => ({
      ...profile,
      roles: userRoles
        .filter((ur) => ur.user_id === profile.id)
        .map((ur) => ur.role),
    }));

    setUsers(usersWithRoles);
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin()) {
      fetchUsers();
    }
  }, []);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = inviteSchema.safeParse(inviteForm);
    if (!result.success) {
      const newErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) newErrors[err.path[0] as string] = err.message;
      });
      setErrors(newErrors);
      return;
    }

    try {
      // Use admin API to create user and send invitation email
      const { data: userData, error: createError } = await supabase.auth.admin.createUser({
        email: inviteForm.email,
        email_confirm: true,
        user_metadata: {
          full_name: inviteForm.fullName,
        },
      });

      if (createError) {
        toast({
          title: 'Error',
          description: createError.message,
          variant: 'destructive',
        });
        return;
      }

      if (userData.user) {
        // Assign role
        const { error: roleError } = await supabase
          .from('user_roles')
          .insert({
            user_id: userData.user.id,
            role: inviteForm.role,
          });

        if (roleError) {
          toast({
            title: 'Error',
            description: `User created but failed to assign role: ${roleError.message}`,
            variant: 'destructive',
          });
          return;
        }

        // Send password reset email as invitation
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(
          inviteForm.email,
          {
            redirectTo: `${window.location.origin}/auth`,
          }
        );

        if (resetError) {
          toast({
            title: 'Warning',
            description: 'User created but invitation email failed to send',
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'Success',
            description: `Invitation email sent to ${inviteForm.email}`,
          });
        }

        setInviteForm({ email: '', fullName: '', role: 'driver' });
        setInviteOpen(false);
        fetchUsers();
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to invite user',
        variant: 'destructive',
      });
    }
  };

  const handleRemoveUser = async (userId: string, email: string) => {
    if (!confirm(`Are you sure you want to remove ${email}?`)) return;

    const { error } = await supabase.auth.admin.deleteUser(userId);

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to remove user',
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Success',
      description: 'User removed successfully',
    });

    fetchUsers();
  };

  const handleEditRoles = (user: Profile) => {
    setSelectedUser(user);
    setSelectedRoles(user.roles);
    setEditRolesOpen(true);
  };

  const handleSaveRoles = async () => {
    if (!selectedUser) return;

    // Delete all existing roles for this user
    const { error: deleteError } = await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', selectedUser.id);

    if (deleteError) {
      toast({
        title: 'Error',
        description: 'Failed to update roles',
        variant: 'destructive',
      });
      return;
    }

    // Insert new roles
    if (selectedRoles.length > 0) {
      const { error: insertError } = await supabase
        .from('user_roles')
        .insert(selectedRoles.map(role => ({
          user_id: selectedUser.id,
          role: role as any,
        })));

      if (insertError) {
        toast({
          title: 'Error',
          description: 'Failed to assign roles',
          variant: 'destructive',
        });
        return;
      }
    }

    toast({
      title: 'Success',
      description: 'User roles updated successfully',
    });

    setEditRolesOpen(false);
    setSelectedUser(null);
    setSelectedRoles([]);
    fetchUsers();
  };

  const toggleRole = (role: string) => {
    setSelectedRoles(prev =>
      prev.includes(role)
        ? prev.filter(r => r !== role)
        : [...prev, role]
    );
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin':
        return 'default';
      case 'management':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  if (!isAdmin()) {
    return (
      <>
        <Header />
        <div className="container mx-auto p-8">
          <Card>
            <CardHeader>
              <CardTitle>Access Denied</CardTitle>
              <CardDescription>
                You don't have permission to access this page.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </>
    );
  }

  return (
    <>
      <Header />
      <div className="container mx-auto p-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">User Management</h1>
            <p className="text-muted-foreground">Manage users and their roles</p>
          </div>

          <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="mr-2 h-4 w-4" />
                Invite User
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleInvite}>
                <DialogHeader>
                  <DialogTitle>Invite New User</DialogTitle>
                  <DialogDescription>
                    Send an invitation email to a new user
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Full Name</Label>
                    <Input
                      id="fullName"
                      value={inviteForm.fullName}
                      onChange={(e) => setInviteForm({ ...inviteForm, fullName: e.target.value })}
                    />
                    {errors.fullName && <p className="text-sm text-destructive">{errors.fullName}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={inviteForm.email}
                      onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                    />
                    {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="role">Role</Label>
                    <Select
                      value={inviteForm.role}
                      onValueChange={(value: any) => setInviteForm({ ...inviteForm, role: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="management">Management</SelectItem>
                        <SelectItem value="driver">Driver</SelectItem>
                        <SelectItem value="production">Production</SelectItem>
                        <SelectItem value="logistics">Logistics</SelectItem>
                        <SelectItem value="accounting">Accounting</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.role && <p className="text-sm text-destructive">{errors.role}</p>}
                  </div>
                </div>

                <DialogFooter>
                  <Button type="submit">
                    <Mail className="mr-2 h-4 w-4" />
                    Send Invitation
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Users</CardTitle>
            <CardDescription>View and manage all users in the system</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center">
                      No users found
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.full_name}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {user.roles.map((role) => (
                            <Badge key={role} variant={getRoleBadgeVariant(role)}>
                              {role}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        {new Date(user.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditRoles(user)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveUser(user.id, user.email)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Dialog open={editRolesOpen} onOpenChange={setEditRolesOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit User Roles</DialogTitle>
              <DialogDescription>
                Manage roles for {selectedUser?.full_name} ({selectedUser?.email})
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-3">
                <Label>Assign Roles</Label>
                {availableRoles.map((role) => (
                  <div key={role} className="flex items-center space-x-2">
                    <Checkbox
                      id={role}
                      checked={selectedRoles.includes(role)}
                      onCheckedChange={() => toggleRole(role)}
                    />
                    <label
                      htmlFor={role}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 capitalize"
                    >
                      {role}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setEditRolesOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveRoles}>
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
