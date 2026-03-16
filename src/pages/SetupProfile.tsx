import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

export default function SetupProfile() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !user) return;
    setSaving(true);

    let profilePhotoUrl: string | null = null;

    // Upload photo if selected
    if (photoFile) {
      const ext = photoFile.name.split('.').pop();
      const path = `${user.id}/profile.${ext}`;
      const { error } = await supabase.storage.from('employee-photos').upload(path, photoFile, { upsert: true });
      if (!error) {
        const { data: urlData } = supabase.storage.from('employee-photos').getPublicUrl(path);
        profilePhotoUrl = urlData.publicUrl;
      }
    }

    // Upsert profile
    const { error: profileError } = await supabase.from('profiles').upsert({
      id: user.id,
      email: user.email || '',
      full_name: fullName.trim(),
      phone: phone || null,
      profile_photo_url: profilePhotoUrl,
    }, { onConflict: 'id' });

    if (profileError) {
      toast({ title: 'Error', description: profileError.message, variant: 'destructive' });
      setSaving(false);
      return;
    }

    // Insert default role (employee) if no roles exist
    const { data: existingRoles } = await supabase.from('user_roles').select('id').eq('user_id', user.id);
    if (!existingRoles || existingRoles.length === 0) {
      await supabase.from('user_roles').insert({ user_id: user.id, role: 'employee' });
    }

    toast({ title: 'Profile set up successfully!' });
    navigate('/intake', { replace: true });
    setSaving(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <img src="/logo.png" alt="FUIK Logo" className="h-16 object-contain" />
          </div>
          <CardTitle className="text-xl">Welcome — let's set up your profile</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Full Name *</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </div>
            <div>
              <Label>Profile Photo (optional)</Label>
              <Input type="file" accept="image/*" onChange={(e) => setPhotoFile(e.target.files?.[0] || null)} />
            </div>
            <div>
              <Label>Phone (optional)</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <Button type="submit" className="w-full bg-intake-brand hover:bg-intake-accent text-white" disabled={saving || !fullName.trim()}>
              {saving ? 'Setting up...' : 'Get Started'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
