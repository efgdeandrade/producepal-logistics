import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

const ROLE_OPTIONS = ['director', 'business_partner', 'right_hand', 'manager', 'employee', 'driver'];

export default function IntakeSettings() {
  const { user, hasRole } = useAuth();
  const { toast } = useToast();
  const canChangeRoles = hasRole('director') || hasRole('right_hand') || hasRole('admin');

  // General tab
  const [generalSettings, setGeneralSettings] = useState<Record<string, string>>({});
  const [generalLoading, setGeneralLoading] = useState(true);

  // WhatsApp tab
  const [waSettings, setWaSettings] = useState<any>({});
  const [waLoading, setWaLoading] = useState(true);

  // Team tab
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [teamLoading, setTeamLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');

  // Load general settings
  useEffect(() => {
    const fetchGeneral = async () => {
      const { data } = await supabase.from('app_settings').select('key, value');
      const settings: Record<string, string> = {};
      (data || []).forEach((s: any) => { settings[s.key] = s.value; });
      setGeneralSettings(settings);
      setGeneralLoading(false);
    };

    const fetchWA = async () => {
      const { data } = await supabase.from('whatsapp_settings').select('*').eq('id', 1).single();
      setWaSettings(data || {});
      setWaLoading(false);
    };

    const fetchTeam = async () => {
      const { data: profiles } = await supabase.from('profiles').select('id, full_name, email, department');
      const { data: roles } = await supabase.from('user_roles').select('user_id, role');
      const roleMap: Record<string, string[]> = {};
      (roles || []).forEach((r: any) => {
        if (!roleMap[r.user_id]) roleMap[r.user_id] = [];
        roleMap[r.user_id].push(r.role);
      });
      setTeamMembers((profiles || []).map((p: any) => ({ ...p, roles: roleMap[p.id] || [] })));
      setTeamLoading(false);
    };

    fetchGeneral();
    fetchWA();
    fetchTeam();
  }, []);

  const updateGeneralSetting = (key: string, value: string) => {
    setGeneralSettings({ ...generalSettings, [key]: value });
  };

  const saveGeneral = async () => {
    for (const [key, value] of Object.entries(generalSettings)) {
      await supabase.from('app_settings').upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    }
    toast({ title: 'Settings saved' });
  };

  const saveWhatsApp = async () => {
    await supabase.from('whatsapp_settings').upsert({
      id: 1,
      telegram_link: waSettings.telegram_link || null,
      redirect_message_en: waSettings.redirect_message_en || null,
      redirect_message_nl: waSettings.redirect_message_nl || null,
      redirect_message_pap: waSettings.redirect_message_pap || null,
      redirect_message_es: waSettings.redirect_message_es || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });
    toast({ title: 'WhatsApp templates saved' });
  };

  const changeRole = async (userId: string, newRole: string) => {
    try {
      await supabase.rpc('update_user_roles', {
        target_user_id: userId,
        new_roles: [newRole] as any,
      });
      toast({ title: 'Role updated' });
      // Refresh
      const { data: roles } = await supabase.from('user_roles').select('user_id, role');
      const roleMap: Record<string, string[]> = {};
      (roles || []).forEach((r: any) => {
        if (!roleMap[r.user_id]) roleMap[r.user_id] = [];
        roleMap[r.user_id].push(r.role);
      });
      setTeamMembers(teamMembers.map((m) => ({ ...m, roles: roleMap[m.id] || [] })));
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const sendInvite = async () => {
    if (!inviteEmail.trim()) return;
    try {
      const { error } = await supabase.functions.invoke('invite-user', {
        body: { email: inviteEmail.trim() },
      });
      if (error) throw error;
      toast({ title: 'Invitation sent' });
      setInviteEmail('');
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold text-intake-text mb-6">Settings</h1>

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="telegram">Telegram</TabsTrigger>
          <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
          <TabsTrigger value="email-po">Email PO</TabsTrigger>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
        </TabsList>

        {/* Telegram Tab */}
        <TabsContent value="telegram" className="space-y-4">
          <TelegramSettingsTab />
        </TabsContent>

        {/* WhatsApp Tab */}
        <TabsContent value="whatsapp" className="space-y-4">
          <div className="max-w-lg space-y-4 p-4 border rounded-lg bg-intake-surface">
            <div>
              <Label>API Token</Label>
              <Input type="password" placeholder="••••••••" disabled />
              <p className="text-xs text-intake-text-muted mt-1">Managed via backend secrets.</p>
            </div>
            <div>
              <Label>Phone Number ID</Label>
              <Input placeholder="Managed via backend secrets" disabled />
            </div>
            <div>
              <Label>Telegram Redirect Link</Label>
              <Input value={waSettings.telegram_link || ''} onChange={(e) => setWaSettings({ ...waSettings, telegram_link: e.target.value })} />
            </div>
            <div>
              <Label>English Redirect Message</Label>
              <Textarea value={waSettings.redirect_message_en || ''} onChange={(e) => setWaSettings({ ...waSettings, redirect_message_en: e.target.value })} className="h-20" />
            </div>
            <div>
              <Label>Dutch Redirect Message</Label>
              <Textarea value={waSettings.redirect_message_nl || ''} onChange={(e) => setWaSettings({ ...waSettings, redirect_message_nl: e.target.value })} className="h-20" />
            </div>
            <div>
              <Label>Papiamentu Redirect Message</Label>
              <Textarea value={waSettings.redirect_message_pap || ''} onChange={(e) => setWaSettings({ ...waSettings, redirect_message_pap: e.target.value })} className="h-20" />
            </div>
            <div>
              <Label>Spanish Redirect Message</Label>
              <Textarea value={waSettings.redirect_message_es || ''} onChange={(e) => setWaSettings({ ...waSettings, redirect_message_es: e.target.value })} className="h-20" />
            </div>
            <Button className="bg-intake-brand hover:bg-intake-accent text-white" onClick={saveWhatsApp}>Save Templates</Button>
          </div>
        </TabsContent>

        {/* Email PO Tab */}
        <TabsContent value="email-po" className="space-y-4">
          <div className="max-w-lg space-y-4 p-4 border rounded-lg bg-intake-surface">
            <div>
              <Label>IMAP Host</Label>
              <Input placeholder="Managed via backend secrets" disabled />
            </div>
            <div>
              <Label>IMAP Port</Label>
              <Input placeholder="993" disabled />
            </div>
            <div>
              <Label>IMAP Username</Label>
              <Input placeholder="Managed via backend secrets" disabled />
            </div>
            <div>
              <Label>IMAP Password</Label>
              <Input type="password" placeholder="••••••••" disabled />
            </div>
            <p className="text-xs text-intake-text-muted">Polling interval: Every 5 minutes (automatic)</p>
            <div className="flex gap-2">
              <Button variant="outline" className="h-8 text-xs" disabled>Test Connection</Button>
              <Button variant="outline" className="h-8 text-xs" disabled>Poll Now</Button>
            </div>
          </div>
        </TabsContent>

        {/* General Tab */}
        <TabsContent value="general" className="space-y-4">
          {generalLoading ? (
            <div className="space-y-3"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
          ) : (
            <div className="max-w-lg space-y-4 p-4 border rounded-lg bg-intake-surface">
              <div>
                <Label>Business Name</Label>
                <Input value={generalSettings.business_name || ''} onChange={(e) => updateGeneralSetting('business_name', e.target.value)} />
              </div>
              <div>
                <Label>Business Phone</Label>
                <Input value={generalSettings.business_phone || ''} onChange={(e) => updateGeneralSetting('business_phone', e.target.value)} />
              </div>
              <div>
                <Label>Same-day Cut-off Time</Label>
                <Input type="time" value={generalSettings.cutoff_time || ''} onChange={(e) => updateGeneralSetting('cutoff_time', e.target.value)} />
              </div>
              <div>
                <Label>Stock Window Close Time</Label>
                <Input type="time" value={generalSettings.stock_window_time || ''} onChange={(e) => updateGeneralSetting('stock_window_time', e.target.value)} />
              </div>
              <div>
                <Label>Anomaly Volume Threshold (%)</Label>
                <Input type="number" value={generalSettings.anomaly_volume_threshold || ''} onChange={(e) => updateGeneralSetting('anomaly_volume_threshold', e.target.value)} />
              </div>
              <div>
                <Label>Telegram Link</Label>
                <Input value={generalSettings.telegram_link || ''} onChange={(e) => updateGeneralSetting('telegram_link', e.target.value)} />
              </div>
              <Button className="bg-intake-brand hover:bg-intake-accent text-white" onClick={saveGeneral}>Save</Button>
            </div>
          )}
        </TabsContent>

        {/* Team Tab */}
        <TabsContent value="team" className="space-y-4">
          {teamLoading ? (
            <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : (
            <>
              <div className="flex gap-2 mb-4">
                <Input placeholder="Email address" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} className="max-w-xs" />
                <Button className="bg-intake-brand hover:bg-intake-accent text-white" onClick={sendInvite}>Invite Team Member</Button>
              </div>
              <div className="border rounded-lg bg-intake-surface overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Department</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {teamMembers.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="text-sm">{m.full_name || '—'}</TableCell>
                        <TableCell className="text-sm">{m.email}</TableCell>
                        <TableCell>
                          {canChangeRoles ? (
                            <Select
                              value={m.roles[0] || 'employee'}
                              onValueChange={(v) => changeRole(m.id, v)}
                            >
                              <SelectTrigger className="h-8 text-xs w-[140px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {ROLE_OPTIONS.map((r) => (
                                  <SelectItem key={r} value={r}>{r}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge variant="outline" className="text-xs">{m.roles[0] || 'employee'}</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">{m.department || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
