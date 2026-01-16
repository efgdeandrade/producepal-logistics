import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface GmailCredential {
  id: string;
  email_address: string;
  token_expiry: string | null;
  watch_expiration: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function useGmailCredentials() {
  const [credential, setCredential] = useState<GmailCredential | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchCredentials = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('gmail_credentials')
        .select('id, email_address, token_expiry, watch_expiration, is_active, created_at, updated_at')
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error fetching Gmail credentials:', error);
      } else {
        setCredential(data as GmailCredential | null);
      }
    } catch (err) {
      console.error('Error in fetchCredentials:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCredentials();
  }, [fetchCredentials]);

  const connect = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('gmail-oauth-init');
      
      if (error) {
        toast.error('Failed to initiate Gmail connection');
        console.error('OAuth init error:', error);
        return;
      }

      if (data?.authUrl) {
        window.location.href = data.authUrl;
      } else {
        toast.error('Failed to get OAuth URL');
      }
    } catch (err) {
      console.error('Error connecting Gmail:', err);
      toast.error('Failed to connect Gmail');
    }
  };

  const disconnect = async () => {
    try {
      const { error } = await supabase.functions.invoke('gmail-disconnect');
      
      if (error) {
        toast.error('Failed to disconnect Gmail');
        console.error('Disconnect error:', error);
        return;
      }

      setCredential(null);
      toast.success('Gmail disconnected successfully');
    } catch (err) {
      console.error('Error disconnecting Gmail:', err);
      toast.error('Failed to disconnect Gmail');
    }
  };

  const refreshStatus = async () => {
    setLoading(true);
    await fetchCredentials();
  };

  const isConnected = !!credential && credential.is_active;
  const isTokenExpired = credential?.token_expiry 
    ? new Date(credential.token_expiry) < new Date() 
    : false;
  const isWatchExpired = credential?.watch_expiration 
    ? new Date(credential.watch_expiration) < new Date() 
    : false;

  return {
    credential,
    loading,
    isConnected,
    isTokenExpired,
    isWatchExpired,
    connect,
    disconnect,
    refreshStatus,
  };
}
