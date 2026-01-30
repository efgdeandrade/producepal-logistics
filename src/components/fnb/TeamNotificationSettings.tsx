import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Trash2, Bell, MessageSquare, AlertTriangle, ShoppingCart, Loader2 } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface TeamMember {
  id: string;
  user_id: string | null;
  whatsapp_phone: string;
  notify_on_new_orders: boolean;
  notify_on_escalations: boolean;
  notify_on_complaints: boolean;
  is_active: boolean;
  created_at: string;
  profile?: {
    full_name: string | null;
    email: string | null;
  };
}

export function TeamNotificationSettings() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newMember, setNewMember] = useState({
    whatsapp_phone: '',
    notify_on_new_orders: true,
    notify_on_escalations: true,
    notify_on_complaints: true,
  });

  useEffect(() => {
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('team_notification_settings')
        .select(`
          *,
          profile:profiles(full_name, email)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMembers(data || []);
    } catch (error) {
      console.error('Error fetching team members:', error);
      toast.error('Failed to load team notification settings');
    } finally {
      setLoading(false);
    }
  };

  const addMember = async () => {
    if (!newMember.whatsapp_phone.trim()) {
      toast.error('WhatsApp phone number is required');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('team_notification_settings')
        .insert({
          whatsapp_phone: newMember.whatsapp_phone.trim(),
          notify_on_new_orders: newMember.notify_on_new_orders,
          notify_on_escalations: newMember.notify_on_escalations,
          notify_on_complaints: newMember.notify_on_complaints,
          is_active: true,
        });

      if (error) throw error;

      toast.success('Team member added');
      setNewMember({
        whatsapp_phone: '',
        notify_on_new_orders: true,
        notify_on_escalations: true,
        notify_on_complaints: true,
      });
      setDialogOpen(false);
      fetchMembers();
    } catch (error) {
      console.error('Error adding team member:', error);
      toast.error('Failed to add team member');
    } finally {
      setSaving(false);
    }
  };

  const toggleSetting = async (
    memberId: string,
    field: 'notify_on_new_orders' | 'notify_on_escalations' | 'notify_on_complaints' | 'is_active',
    currentValue: boolean
  ) => {
    try {
      const { error } = await supabase
        .from('team_notification_settings')
        .update({ [field]: !currentValue })
        .eq('id', memberId);

      if (error) throw error;

      setMembers(members.map(m => 
        m.id === memberId ? { ...m, [field]: !currentValue } : m
      ));
    } catch (error) {
      console.error('Error updating setting:', error);
      toast.error('Failed to update setting');
    }
  };

  const deleteMember = async (memberId: string) => {
    try {
      const { error } = await supabase
        .from('team_notification_settings')
        .delete()
        .eq('id', memberId);

      if (error) throw error;

      toast.success('Team member removed');
      setMembers(members.filter(m => m.id !== memberId));
    } catch (error) {
      console.error('Error deleting team member:', error);
      toast.error('Failed to remove team member');
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              Team Notifications
            </CardTitle>
            <CardDescription>
              Configure which team members receive WhatsApp alerts for orders and escalations
            </CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Member
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Team Member</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">WhatsApp Phone Number</Label>
                  <Input
                    id="phone"
                    placeholder="+5999XXXXXXX"
                    value={newMember.whatsapp_phone}
                    onChange={(e) => setNewMember({ ...newMember, whatsapp_phone: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Include country code (e.g., +5999 for Curaçao)
                  </p>
                </div>

                <div className="space-y-3">
                  <Label>Notification Preferences</Label>
                  
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <ShoppingCart className="h-4 w-4 text-green-600" />
                      <span className="text-sm">New Orders</span>
                    </div>
                    <Switch
                      checked={newMember.notify_on_new_orders}
                      onCheckedChange={(checked) => 
                        setNewMember({ ...newMember, notify_on_new_orders: checked })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-orange-600" />
                      <span className="text-sm">Escalations</span>
                    </div>
                    <Switch
                      checked={newMember.notify_on_escalations}
                      onCheckedChange={(checked) => 
                        setNewMember({ ...newMember, notify_on_escalations: checked })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                      <span className="text-sm">Complaints</span>
                    </div>
                    <Switch
                      checked={newMember.notify_on_complaints}
                      onCheckedChange={(checked) => 
                        setNewMember({ ...newMember, notify_on_complaints: checked })
                      }
                    />
                  </div>
                </div>

                <Button onClick={addMember} disabled={saving} className="w-full">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Add Team Member
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {members.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Bell className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No team members configured</p>
            <p className="text-sm">Add team members to receive WhatsApp notifications when orders come in</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Phone</TableHead>
                <TableHead className="text-center">Orders</TableHead>
                <TableHead className="text-center">Escalations</TableHead>
                <TableHead className="text-center">Complaints</TableHead>
                <TableHead className="text-center">Active</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => (
                <TableRow key={member.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-green-600" />
                      <span className="font-mono text-sm">{member.whatsapp_phone}</span>
                      {member.profile?.full_name && (
                        <Badge variant="secondary" className="text-xs">
                          {member.profile.full_name}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={member.notify_on_new_orders}
                      onCheckedChange={() => 
                        toggleSetting(member.id, 'notify_on_new_orders', member.notify_on_new_orders)
                      }
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={member.notify_on_escalations}
                      onCheckedChange={() => 
                        toggleSetting(member.id, 'notify_on_escalations', member.notify_on_escalations)
                      }
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={member.notify_on_complaints}
                      onCheckedChange={() => 
                        toggleSetting(member.id, 'notify_on_complaints', member.notify_on_complaints)
                      }
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={member.is_active}
                      onCheckedChange={() => 
                        toggleSetting(member.id, 'is_active', member.is_active)
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteMember(member.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
