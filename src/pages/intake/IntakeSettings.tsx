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

function TelegramSettingsTab() {
  const { toast } = useToast();
  const [testing, setTesting] = useState(false);
  const [tokenStatus, setTokenStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [registering, setRegistering] = useState(false);
  const [webhookResult, setWebhookResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [lastMessage, setLastMessage] = useState<string | null>(null);

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL || ''}/functions/v1/telegram-webhook`;

  // Load last message timestamp
  useEffect(() => {
    const fetchLastMessage = async () => {
      const { data } = await supabase
        .from('dre_messages')
        .select('created_at')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      if (data) {
        setLastMessage(new Date(data.created_at).toLocaleString());
      }
    };
    fetchLastMessage();
  }, []);

  const testToken = async () => {
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('test-telegram-token');
      if (error) throw error;
      if (data?.ok) {
        setTokenStatus({ ok: true, message: `Connected as @${data.bot_username}` });
      } else {
        setTokenStatus({ ok: false, message: data?.error || 'Not connected — check token' });
      }
    } catch (e: any) {
      setTokenStatus({ ok: false, message: e.message });
    } finally {
      setTesting(false);
    }
  };

  // Test on mount
  useEffect(() => { testToken(); }, []);

  const registerWebhook = async () => {
    setRegistering(true);
    try {
      const { data, error } = await supabase.functions.invoke('register-telegram-webhook');
      if (error) throw error;
      if (data?.ok) {
        setWebhookResult({ ok: true, message: 'Webhook registered' });
      } else {
        setWebhookResult({ ok: false, message: data?.description || JSON.stringify(data) });
      }
    } catch (e: any) {
      setWebhookResult({ ok: false, message: e.message });
    } finally {
      setRegistering(false);
    }
  };

  return (
    <div className="max-w-lg space-y-4 p-4 border rounded-lg bg-intake-surface">
      {/* Bot Token Status */}
      <div>
        <Label>Bot Token</Label>
        <div className="flex gap-2 mt-1">
          <Input type="password" value="••••••••••••••••" readOnly className="mt-0" />
          <Button
            variant="outline"
            className="h-10 text-xs shrink-0"
            onClick={testToken}
            disabled={testing}
          >
            {testing ? 'Testing…' : 'Test Connection'}
          </Button>
        </div>
        <p className="text-xs text-intake-text-muted mt-1">Managed via backend secrets.</p>
        {tokenStatus && (
          <p className={`text-xs mt-1 ${tokenStatus.ok ? 'text-green-600' : 'text-red-600'}`}>
            {tokenStatus.ok ? '✅' : '❌'} {tokenStatus.message}
          </p>
        )}
      </div>

      {/* Webhook URL */}
      <div>
        <Label>Webhook URL</Label>
        <Input readOnly value={webhookUrl} className="mt-1" />
        {webhookResult && (
          <p className={`text-xs mt-1 ${webhookResult.ok ? 'text-green-600' : 'text-red-600'}`}>
            {webhookResult.ok ? '✅' : '❌'} {webhookResult.message}
          </p>
        )}
      </div>

      <Button
        variant="outline"
        className="h-8 text-xs"
        onClick={registerWebhook}
        disabled={registering}
      >
        {registering ? 'Registering…' : 'Register Webhook'}
      </Button>

      {/* Status */}
      <div className="pt-2 border-t">
        <p className="text-xs text-intake-text-muted">
          Last message received: {lastMessage || 'No messages yet'}
        </p>
      </div>
    </div>
  );
}

function TrainingSettingsTab({ generalSettings, updateGeneralSetting, saveGeneral }: {
  generalSettings: Record<string, string>;
  updateGeneralSetting: (key: string, value: string) => void;
  saveGeneral: () => Promise<void>;
}) {
  const { toast } = useToast();
  const [sending, setSending] = useState(false);
  const [testingTTS, setTestingTTS] = useState(false);

  const sendTrainingNow = async () => {
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-daily-training');
      if (error) throw error;
      toast({ title: 'Training sent!', description: `${data?.questions_sent || 0} questions sent to Bolenga` });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const testTTS = async () => {
    setTestingTTS(true);
    toast({ title: 'TTS test', description: 'Sending a sample voice message to Bolenga...' });
    try {
      const { error } = await supabase.functions.invoke('send-daily-training');
      if (error) throw error;
      toast({ title: 'Sample sent!' });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setTestingTTS(false);
    }
  };

  return (
    <div className="max-w-lg space-y-4 p-4 border rounded-lg bg-intake-surface">
      <div>
        <Label>Bolenga's Telegram Chat ID</Label>
        <Input
          value={generalSettings.bolenga_telegram_chat_id || ''}
          onChange={(e) => updateGeneralSetting('bolenga_telegram_chat_id', e.target.value)}
        />
        <p className="text-xs text-intake-text-muted mt-1">
          Ask Bolenga to message the bot and copy the Chat ID from /intake/conversations
        </p>
      </div>
      <div>
        <Label>Daily Training Time</Label>
        <Input
          type="time"
          value={generalSettings.training_schedule_time || '09:00'}
          onChange={(e) => updateGeneralSetting('training_schedule_time', e.target.value)}
        />
      </div>
      <div>
        <Label>Questions Per Day (10-25)</Label>
        <Input
          type="number"
          min={10}
          max={25}
          value={generalSettings.training_questions_per_day || '15'}
          onChange={(e) => updateGeneralSetting('training_questions_per_day', e.target.value)}
        />
      </div>
      <div>
        <Label>TTS Voice</Label>
        <Select
          value={generalSettings.tts_voice || 'nova'}
          onValueChange={(v) => updateGeneralSetting('tts_voice', v)}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="nova">Nova</SelectItem>
            <SelectItem value="alloy">Alloy</SelectItem>
            <SelectItem value="shimmer">Shimmer</SelectItem>
            <SelectItem value="echo">Echo</SelectItem>
            <SelectItem value="onyx">Onyx</SelectItem>
            <SelectItem value="fable">Fable</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-intake-text-muted mt-1">Nova and Shimmer sound most natural for Papiamentu</p>
      </div>
      <div className="flex gap-2 pt-2">
        <Button className="bg-intake-brand hover:bg-intake-accent text-white" onClick={saveGeneral}>Save Settings</Button>
        <Button variant="outline" onClick={sendTrainingNow} disabled={sending}>
          {sending ? 'Sending...' : 'Send Training Now'}
        </Button>
        <Button variant="outline" onClick={testTTS} disabled={testingTTS}>
          {testingTTS ? 'Sending...' : 'Test TTS'}
        </Button>
      </div>
    </div>
  );
}

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
          <TabsTrigger value="training">Training</TabsTrigger>
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
              <div>
                <Label>Manager Telegram Handle</Label>
                <Input value={generalSettings.manager_telegram_handle || ''} onChange={(e) => updateGeneralSetting('manager_telegram_handle', e.target.value)} placeholder="@FuikManager" />
                <p className="text-xs text-intake-text-muted mt-1">Used when Dre needs to escalate in a group chat (e.g. @Eduardo)</p>
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

        {/* Training Tab */}
        <TabsContent value="training" className="space-y-4">
          <TrainingSettingsTab generalSettings={generalSettings} updateGeneralSetting={updateGeneralSetting} saveGeneral={saveGeneral} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
