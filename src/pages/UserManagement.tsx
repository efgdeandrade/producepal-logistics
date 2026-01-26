import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { UserPlus, Trash2, Mail, Edit, RefreshCw, Copy, ArrowLeft, Phone, MessageSquare } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';

const inviteSchema = z.object({
  email: z.string().email({ message: 'Invalid email address' }),
  fullName: z.string().min(2, { message: 'Name must be at least 2 characters' }),
  role: z.enum(['admin', 'management', 'driver', 'production', 'logistics', 'accounting', 'manager', 'hr', 'interim']),
});

interface Profile {
  id: string;
  email: string;
  full_name: string;
  created_at: string;
  roles: string[];
  whatsapp_phone?: string | null;
  team_role?: string | null;
  is_fuik_team?: boolean | null;
}

export default function UserManagement() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [editRolesOpen, setEditRolesOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [teamSettings, setTeamSettings] = useState({
    whatsapp_phone: '',
    team_role: '',
    is_fuik_team: false,
  });
  const [inviteForm, setInviteForm] = useState({
    email: '',
    fullName: '',
    role: 'driver' as const,
  });
  const [createUserForm, setCreateUserForm] = useState({
    email: '',
    fullName: '',
    role: 'driver' as const,
  });
  const [resetLink, setResetLink] = useState<string>('');
  const [showResetLink, setShowResetLink] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const availableRoles = ['admin', 'management', 'driver', 'production', 'logistics', 'accounting', 'manager', 'hr', 'interim'] as const;
  type AppRole = typeof availableRoles[number];

  const fetchUsers = async () => {
    setLoading(true);
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, full_name, created_at, whatsapp_phone, team_role, is_fuik_team')
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
      const { data, error } = await supabase.functions.invoke('invite-user', {
        body: {
          email: inviteForm.email,
          fullName: inviteForm.fullName,
          role: inviteForm.role,
        },
      });

      if (error) {
        throw error;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      toast({
        title: 'Success',
        description: `Invitation email sent to ${inviteForm.email}`,
      });

      setInviteForm({ email: '', fullName: '', role: 'driver' });
      setInviteOpen(false);
      fetchUsers();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to invite user',
        variant: 'destructive',
      });
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setResetLink('');
    setShowResetLink(false);

    const result = inviteSchema.safeParse(createUserForm);
    if (!result.success) {
      const newErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) newErrors[err.path[0] as string] = err.message;
      });
      setErrors(newErrors);
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('create-user-direct', {
        body: {
          email: createUserForm.email,
          fullName: createUserForm.fullName,
          role: createUserForm.role,
        },
      });

      if (error) {
        throw error;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      setResetLink(data.temporaryPassword);
      setShowResetLink(true);
      
      toast({
        title: 'Success',
        description: `User created successfully`,
      });

      fetchUsers();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create user',
        variant: 'destructive',
      });
    }
  };

  const handleCopyResetLink = async () => {
    if (resetLink) {
      await navigator.clipboard.writeText(resetLink);
      toast({
        title: 'Copied!',
        description: 'Reset link copied to clipboard',
      });
    }
  };

  const handleCloseCreateUser = () => {
    setCreateUserOpen(false);
    setCreateUserForm({ email: '', fullName: '', role: 'driver' });
    setResetLink('');
    setShowResetLink(false);
    setErrors({});
  };

  const handleRemoveUser = async (userId: string, email: string) => {
    if (!confirm(`Are you sure you want to remove ${email}?`)) return;

    try {
      const { data, error } = await supabase.functions.invoke('delete-user', {
        body: { userId },
      });

      if (error) {
        throw error;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      toast({
        title: 'Success',
        description: 'User removed successfully',
      });

      fetchUsers();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to remove user',
        variant: 'destructive',
      });
    }
  };

  const handleResendInvitation = async (email: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('resend-invitation', {
        body: { email },
      });

      if (error) {
        throw error;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      // Copy temporary password to clipboard
      if (data.temporaryPassword) {
        await navigator.clipboard.writeText(data.temporaryPassword);
        toast({
          title: 'New Password Generated',
          description: `Temporary password for ${email} copied to clipboard. Share it with the user.`,
        });
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to generate reset link',
        variant: 'destructive',
      });
    }
  };

  const handleEditRoles = (user: Profile) => {
    setSelectedUser(user);
    setSelectedRoles(user.roles);
    setTeamSettings({
      whatsapp_phone: user.whatsapp_phone || '',
      team_role: user.team_role || '',
      is_fuik_team: user.is_fuik_team || false,
    });
    setEditRolesOpen(true);
  };

  const handleSaveRoles = async () => {
    if (!selectedUser) return;

    // Update roles using security definer function
    const { error: rolesError } = await supabase.rpc('update_user_roles', {
      target_user_id: selectedUser.id,
      new_roles: selectedRoles as any,
    });

    if (rolesError) {
      toast({
        title: 'Error',
        description: rolesError.message || 'Failed to update roles',
        variant: 'destructive',
      });
      return;
    }

    // Update team settings in profiles table
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        whatsapp_phone: teamSettings.whatsapp_phone || null,
        team_role: teamSettings.team_role || null,
        is_fuik_team: teamSettings.is_fuik_team,
      })
      .eq('id', selectedUser.id);

    if (profileError) {
      toast({
        title: 'Error',
        description: profileError.message || 'Failed to update team settings',
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Success',
      description: 'User settings updated successfully',
    });

    setEditRolesOpen(false);
    setSelectedUser(null);
    setSelectedRoles([]);
    setTeamSettings({ whatsapp_phone: '', team_role: '', is_fuik_team: false });
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
    );
  }

  return (
    <div className="container mx-auto p-8">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/settings')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">User Management</h1>
              <p className="text-muted-foreground">Manage users and their roles</p>
            </div>
          </div>

          <div className="flex gap-2">
            <Dialog open={createUserOpen} onOpenChange={setCreateUserOpen}>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Create User Directly
                </Button>
              </DialogTrigger>
              <DialogContent>
                {!showResetLink ? (
                  <form onSubmit={handleCreateUser}>
                    <DialogHeader>
                      <DialogTitle>Create User Directly</DialogTitle>
                      <DialogDescription>
                        Create a new user with a password reset link
                      </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="createFullName">Full Name</Label>
                        <Input
                          id="createFullName"
                          value={createUserForm.fullName}
                          onChange={(e) => setCreateUserForm({ ...createUserForm, fullName: e.target.value })}
                        />
                        {errors.fullName && <p className="text-sm text-destructive">{errors.fullName}</p>}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="createEmail">Email</Label>
                        <Input
                          id="createEmail"
                          type="email"
                          value={createUserForm.email}
                          onChange={(e) => setCreateUserForm({ ...createUserForm, email: e.target.value })}
                        />
                        {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="createRole">Role</Label>
                        <Select
                          value={createUserForm.role}
                          onValueChange={(value: any) => setCreateUserForm({ ...createUserForm, role: value })}
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
                            <SelectItem value="hr">HR</SelectItem>
                            <SelectItem value="interim">Interim</SelectItem>
                          </SelectContent>
                        </Select>
                        {errors.role && <p className="text-sm text-destructive">{errors.role}</p>}
                      </div>
                    </div>

                    <DialogFooter>
                      <Button type="submit">Create User</Button>
                    </DialogFooter>
                  </form>
                ) : (
                  <>
                    <DialogHeader>
                      <DialogTitle>✅ User Created Successfully!</DialogTitle>
                      <DialogDescription>
                        Share this temporary password with the user
                      </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>Temporary Password</Label>
                        <div className="flex gap-2">
                          <Input
                            value={resetLink}
                            readOnly
                            className="font-mono text-sm"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={handleCopyResetLink}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md p-3">
                        <p className="text-sm text-blue-900 dark:text-blue-100">
                          ℹ️ <strong>Important:</strong> Share this password with the user. 
                          They will be required to change it on first login.
                        </p>
                      </div>
                    </div>

                    <DialogFooter>
                      <Button onClick={handleCloseCreateUser}>Done</Button>
                    </DialogFooter>
                  </>
                )}
              </DialogContent>
            </Dialog>

            <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Mail className="mr-2 h-4 w-4" />
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
                          <SelectItem value="hr">HR</SelectItem>
                          <SelectItem value="interim">Interim</SelectItem>
                        </SelectContent>
                      </Select>
                      {errors.role && <p className="text-sm text-destructive">{errors.role}</p>}
                    </div>
                  </div>

                  <DialogFooter>
                    <Button type="submit">Send Invitation</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
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
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {user.full_name}
                          {user.is_fuik_team && (
                            <Badge variant="outline" className="text-green-600 border-green-600">
                              <MessageSquare className="h-3 w-3 mr-1" />
                              {user.team_role || 'Team'}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
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
                            onClick={() => handleResendInvitation(user.email)}
                            title="Resend invitation email"
                          >
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditRoles(user)}
                            title="Edit roles"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveUser(user.id, user.email)}
                            title="Delete user"
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

            <div className="space-y-6 py-4 max-h-[60vh] overflow-y-auto">
              <div className="space-y-3">
                <Label>Assign Roles</Label>
                <div className="grid grid-cols-2 gap-2">
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

              <div className="border-t pt-4 space-y-4">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-green-600" />
                  <Label className="text-base font-semibold">FUIK Team Settings</Label>
                </div>
                <p className="text-sm text-muted-foreground">
                  Configure this user for WhatsApp escalations. Dre will tag them in group chats when needed.
                </p>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="is_fuik_team">FUIK Team Member</Label>
                    <p className="text-xs text-muted-foreground">Enable to allow Dre to tag this person</p>
                  </div>
                  <Switch
                    id="is_fuik_team"
                    checked={teamSettings.is_fuik_team}
                    onCheckedChange={(checked) => setTeamSettings({ ...teamSettings, is_fuik_team: checked })}
                  />
                </div>

                {teamSettings.is_fuik_team && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="whatsapp_phone">
                        <Phone className="h-3 w-3 inline mr-1" />
                        WhatsApp Phone Number
                      </Label>
                      <Input
                        id="whatsapp_phone"
                        placeholder="+5999XXXXXXX"
                        value={teamSettings.whatsapp_phone}
                        onChange={(e) => setTeamSettings({ ...teamSettings, whatsapp_phone: e.target.value })}
                      />
                      <p className="text-xs text-muted-foreground">
                        Include country code (e.g., +5999 for Curaçao)
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="team_role">Team Responsibility</Label>
                      <Select
                        value={teamSettings.team_role}
                        onValueChange={(value) => setTeamSettings({ ...teamSettings, team_role: value })}
                      >
                        <SelectTrigger id="team_role">
                          <SelectValue placeholder="Select responsibility" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Logistics">Logistics (order changes, picking issues)</SelectItem>
                          <SelectItem value="Management">Management (escalations, complaints)</SelectItem>
                          <SelectItem value="Accounting">Accounting (pricing, payments)</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Dre will tag this person based on their responsibility
                      </p>
                    </div>
                  </>
                )}
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
  );
}
