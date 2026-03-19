import { useState, useRef, useMemo } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Pencil, Trash2, ArrowLeft, Search, MessageSquare, Route, Upload, FileSpreadsheet, Loader2, MapPin, Wand2, GitMerge, X, Map as MapIcon, Copy, Send, CheckCircle, XCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Progress } from '@/components/ui/progress';
import { CustomerMergeDialog } from '@/components/fnb/CustomerMergeDialog';
import { CustomerLocationPicker } from '@/components/fnb/CustomerLocationPicker';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ExportButton } from '@/components/reports/ExportButton';

type CustomerType = "regular" | "supermarket" | "cod" | "credit";

interface FnbCustomer {
  id: string;
  name: string;
  whatsapp_phone: string;
  preferred_language: string;
  address: string | null;
  delivery_zone: string | null;
  major_zone_id: string | null;
  customer_type: CustomerType;
  notes: string | null;
  latitude?: number | null;
  longitude?: number | null;
  pricing_tier_id?: string | null;
  telegram_chat_id?: string | null;
}

interface MajorZone {
  id: string;
  name: string;
}

interface SubZone {
  id: string;
  name: string;
  parent_zone_id: string | null;
}

const emptyCustomer: Omit<FnbCustomer, 'id'> = {
  name: '',
  whatsapp_phone: '',
  preferred_language: 'pap',
  address: '',
  delivery_zone: '',
  major_zone_id: null,
  customer_type: 'regular',
  notes: '',
  pricing_tier_id: null,
  latitude: null,
  longitude: null,
};

const languageLabels: Record<string, string> = {
  pap: 'Papiamento',
  en: 'English',
  nl: 'Dutch',
  es: 'Spanish',
};

const customerTypeLabels: Record<CustomerType, string> = {
  regular: 'Regular',
  supermarket: 'Supermarket (Receipt Required)',
  cod: 'COD (Cash on Delivery)',
  credit: 'Credit Account',
};

interface CsvCustomer {
  name: string;
  whatsapp_phone: string;
  address: string;
  notes: string;
}

interface GeocodeResult {
  latitude: number;
  longitude: number;
  matchedZone: string | null;
  matchedMajorZoneId: string | null;
  matchedMajorZoneName: string | null;
  distance: number | null;
  allZoneDistances: { name: string; distance: number; withinRadius: boolean; majorZoneId?: string }[];
}

export default function FnbCustomers() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<FnbCustomer | null>(null);
  const [formData, setFormData] = useState<Omit<FnbCustomer, 'id'>>(emptyCustomer);
  const [searchTerm, setSearchTerm] = useState('');
  const [zoneFilter, setZoneFilter] = useState<string>('all');
  const [csvData, setCsvData] = useState<CsvCustomer[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [isDetectingZone, setIsDetectingZone] = useState(false);
  const [detectedZoneInfo, setDetectedZoneInfo] = useState<GeocodeResult | null>(null);
  const [isBulkAssigning, setIsBulkAssigning] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0, matched: 0, failed: 0 });
  const [isMergeMode, setIsMergeMode] = useState(false);
  const [selectedForMerge, setSelectedForMerge] = useState<Set<string>>(new Set());
  const [isMergeDialogOpen, setIsMergeDialogOpen] = useState(false);
  const [isLocationPickerOpen, setIsLocationPickerOpen] = useState(false);
  const [pendingLocation, setPendingLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [settingUpGroup, setSettingUpGroup] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const toggleMergeSelection = (customerId: string) => {
    setSelectedForMerge(prev => {
      const next = new Set(prev);
      if (next.has(customerId)) {
        next.delete(customerId);
      } else if (next.size < 2) {
        next.add(customerId);
      }
      return next;
    });
  };

  const exitMergeMode = () => {
    setIsMergeMode(false);
    setSelectedForMerge(new Set());
  };

  const normalizePhone = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return '';

    // Keep leading + if present, otherwise strip non-digits and prepend Curaçao code
    if (trimmed.startsWith('+')) {
      return `+${trimmed.slice(1).replace(/[^\d]/g, '')}`;
    }

    const digits = trimmed.replace(/[^\d]/g, '');
    return digits ? `+5999${digits}` : '';
  };

  const chunk = <T,>(arr: T[], size: number) => {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  };

  const parseCsvFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n');
      const headers = lines[0].split(',').map((h) => h.trim());

      const parsed: CsvCustomer[] = [];
      const timestamp = Date.now();
      const seenPhones = new Set<string>();
      let noPhoneIndex = 0;

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) continue;

        // Handle CSV with quoted fields containing commas
        const values: string[] = [];
        let current = '';
        let inQuotes = false;
        for (const char of line) {
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            values.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        values.push(current.trim());

        const row: Record<string, string> = {};
        headers.forEach((h, idx) => {
          row[h] = values[idx] || '';
        });

        const name = row['Name']?.trim();
        if (!name) continue;

        // Build address from components
        const addressParts = [row['Street Address'], row['City'], row['Country'], row['Zip']].filter(Boolean);
        const address = addressParts.join(', ');

        // Build notes from company and email
        const notesParts: string[] = [];
        if (row['Company name']) notesParts.push(`Company: ${row['Company name']}`);
        if (row['Email']) notesParts.push(`Email: ${row['Email']}`);
        const notes = notesParts.join(' | ');

        let phone = normalizePhone(row['Phone'] || '');

        // Unique placeholder for empty phones (so they don't violate the unique constraint)
        if (!phone) {
          phone = `NO_PHONE_${timestamp}_${noPhoneIndex++}`;
        }

        // If the CSV itself contains duplicates, keep the first and skip the rest
        if (seenPhones.has(phone)) {
          continue;
        }
        seenPhones.add(phone);

        parsed.push({
          name,
          whatsapp_phone: phone,
          address,
          notes,
        });
      }

      setCsvData(parsed);
      setIsImportDialogOpen(true);
    };
    reader.readAsText(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      parseCsvFile(file);
    }
    // Reset input so same file can be selected again
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleImport = async () => {
    setIsImporting(true);
    try {
      const existingPhones = new Set((customers || []).map((c) => c.whatsapp_phone));

      // Normalize phones again defensively (in case csvData was set from older parse logic)
      const prepared = csvData.map((c) => {
        const normalized = c.whatsapp_phone.startsWith('NO_PHONE_') ? c.whatsapp_phone : normalizePhone(c.whatsapp_phone);
        return { ...c, whatsapp_phone: normalized || c.whatsapp_phone };
      });

      const csvUniqueByPhone = new Map<string, CsvCustomer>();
      for (const c of prepared) {
        if (!csvUniqueByPhone.has(c.whatsapp_phone)) csvUniqueByPhone.set(c.whatsapp_phone, c);
      }

      const uniqueCsv = Array.from(csvUniqueByPhone.values());
      const candidates = uniqueCsv.map((c) => ({
        name: c.name,
        whatsapp_phone: c.whatsapp_phone,
        address: c.address || null,
        notes: c.notes || null,
        preferred_language: 'pap',
        customer_type: 'regular' as CustomerType,
      }));

      if (candidates.length === 0) {
        toast.info('No customers found to import');
        setIsImportDialogOpen(false);
        return;
      }

      // Upsert with ignoreDuplicates so the import NEVER fails because a phone already exists
      const chunks = chunk(candidates, 200);
      for (const batch of chunks) {
        const { error } = await supabase
          .from('distribution_customers')
          .upsert(batch, { onConflict: 'whatsapp_phone', ignoreDuplicates: true });
        if (error) throw error;
      }

      const skippedExisting = uniqueCsv.filter((c) => existingPhones.has(c.whatsapp_phone)).length;
      toast.success(
        `Import complete: processed ${uniqueCsv.length} customers${skippedExisting ? `, skipped ${skippedExisting} existing phone duplicates` : ''}`
      );
      queryClient.invalidateQueries({ queryKey: ['fnb-customers'] });
      setIsImportDialogOpen(false);
      setCsvData([]);
    } catch (error: any) {
      toast.error(error.message || 'Failed to import customers');
    } finally {
      setIsImporting(false);
    }
  };

  const { data: customers, isLoading } = useQuery({
    queryKey: ['fnb-customers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('distribution_customers')
        .select('*')
        .order('name');
      if (error) throw error;
      return data as unknown as FnbCustomer[];
    },
  });

  const selectedCustomersForMerge = customers?.filter(c => selectedForMerge.has(c.id)) || [];

  // Fetch Major Zones
  const { data: majorZones } = useQuery({
    queryKey: ['fnb-major-zones'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('distribution_delivery_zones')
        .select('id, name')
        .eq('zone_type', 'major')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return (data || []) as unknown as MajorZone[];
    },
  });

  // Fetch Sub-zones (all active sub-zones)
  const { data: subZones } = useQuery({
    queryKey: ['fnb-sub-zones'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('distribution_delivery_zones')
        .select('id, name, parent_zone_id')
        .eq('zone_type', 'sub')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return (data || []) as unknown as SubZone[];
    },
  });

  // Filter sub-zones based on selected major zone
  // Falls back to all sub-zones if none are linked to the selected major zone
  const filteredSubZones = useMemo(() => {
    if (!formData.major_zone_id) return subZones;
    const linkedZones = subZones?.filter(sz => sz.parent_zone_id === formData.major_zone_id);
    return linkedZones && linkedZones.length > 0 ? linkedZones : subZones;
  }, [formData.major_zone_id, subZones]);

  // Check if sub-zones are unlinked (for warning display)
  const subZonesUnlinked = useMemo(() => {
    if (!formData.major_zone_id || !subZones) return false;
    const linkedZones = subZones.filter(sz => sz.parent_zone_id === formData.major_zone_id);
    return linkedZones.length === 0;
  }, [formData.major_zone_id, subZones]);

  // Fetch pricing tiers
  const { data: pricingTiers } = useQuery({
    queryKey: ['fnb-pricing-tiers-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('distribution_pricing_tiers')
        .select('id, name, is_default')
        .eq('is_active', true)
        .order('sort_order');
      if (error) throw error;
      return (data || []) as { id: string; name: string; is_default: boolean }[];
    },
  });

  // Fetch Telegram group stats
  const { data: telegramGroups } = useQuery({
    queryKey: ['customer-telegram-groups'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customer_telegram_groups')
        .select('customer_id, status, group_chat_id, group_name, activated_at')
        .eq('status', 'activated');
      if (error) throw error;
      return (data || []) as { customer_id: string; status: string; group_chat_id: string; group_name: string; activated_at: string }[];
    },
  });

  const telegramGroupMap = new Map(telegramGroups?.map(g => [g.customer_id, g]) || []);
  const customersWithTelegram = customers?.filter(c => c.telegram_chat_id) || [];
  const customersWithoutTelegram = customers?.filter(c => !c.telegram_chat_id) || [];

  // Create zone name lookup for display
  const majorZoneMap = new Map(majorZones?.map(z => [z.id, z.name]) || []);
  const subZoneNames = subZones?.map(z => z.name) || [];

  const createMutation = useMutation({
    mutationFn: async (customer: Omit<FnbCustomer, 'id'>) => {
      const { error } = await supabase.from('distribution_customers').insert(customer as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fnb-customers'] });
      toast.success('Customer created');
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create customer');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...customer }: FnbCustomer) => {
      const { error } = await supabase.from('distribution_customers').update(customer as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fnb-customers'] });
      toast.success('Customer updated');
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update customer');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('distribution_customers').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fnb-customers'] });
      toast.success('Customer deleted');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete customer');
    },
  });

  const handleSetupTelegramGroup = async (customer: FnbCustomer) => {
    try {
      setSettingUpGroup(customer.id);
      const { data, error } = await supabase.functions.invoke('setup-telegram-group', {
        body: { customer_id: customer.id },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(`📱 Instructions sent! Code: ${data.activation_code}`);
    } catch (e: any) {
      toast.error(e.message || 'Failed to setup Telegram group');
    } finally {
      setSettingUpGroup(null);
    }
  };

  const handleDeactivateGroup = async (customerId: string) => {
    if (!confirm('Deactivate this Telegram group? The customer will no longer receive orders via this group.')) return;
    try {
      await supabase.from('distribution_customers').update({ telegram_chat_id: null } as any).eq('id', customerId);
      await supabase.from('customer_telegram_groups').update({ status: 'deactivated' } as any)
        .eq('customer_id', customerId)
        .eq('status', 'activated');
      queryClient.invalidateQueries({ queryKey: ['fnb-customers'] });
      queryClient.invalidateQueries({ queryKey: ['customer-telegram-groups'] });
      toast.success('Telegram group deactivated');
    } catch (e: any) {
      toast.error(e.message || 'Failed to deactivate');
    }
  };

    setFormData(emptyCustomer);
    setEditingCustomer(null);
    setDetectedZoneInfo(null);
  };

  const handleEdit = (customer: FnbCustomer) => {
    setEditingCustomer(customer);
    // Clear pending location before setting form data to avoid stale data
    setPendingLocation(null);
    setFormData({
      name: customer.name,
      whatsapp_phone: customer.whatsapp_phone,
      preferred_language: customer.preferred_language,
      address: customer.address || '',
      delivery_zone: customer.delivery_zone || '',
      major_zone_id: customer.major_zone_id || null,
      customer_type: customer.customer_type || 'regular',
      notes: customer.notes || '',
      pricing_tier_id: customer.pricing_tier_id || null,
      latitude: customer.latitude || null,
      longitude: customer.longitude || null,
    });
    setDetectedZoneInfo(null);
    setIsLocationPickerOpen(false);
    setIsDialogOpen(true);
  };

  const handleDuplicateCustomer = (customer: FnbCustomer) => {
    setEditingCustomer(null); // Create mode, not edit
    setPendingLocation(null);
    setFormData({
      name: `${customer.name} (Copy)`,
      whatsapp_phone: '', // Must be unique - user needs to enter new
      preferred_language: customer.preferred_language,
      address: customer.address || '',
      delivery_zone: customer.delivery_zone || '',
      major_zone_id: customer.major_zone_id || null,
      customer_type: customer.customer_type || 'regular',
      notes: customer.notes || '',
      pricing_tier_id: customer.pricing_tier_id || null,
      latitude: null, // Clear - new location likely different
      longitude: null,
    });
    setDetectedZoneInfo(null);
    setIsLocationPickerOpen(false);
    setIsDialogOpen(true);
    toast.success('Customer duplicated - enter new phone number and save');
  };

  const handleLocationSelect = (location: {
    latitude: number;
    longitude: number;
    detectedZone?: string;
    detectedMajorZoneId?: string;
    detectedMajorZoneName?: string;
  }) => {
    setFormData(prev => ({
      ...prev,
      latitude: location.latitude,
      longitude: location.longitude,
      ...(location.detectedZone && { delivery_zone: location.detectedZone }),
      ...(location.detectedMajorZoneId && { major_zone_id: location.detectedMajorZoneId }),
    }));
    setPendingLocation(null);
    setIsLocationPickerOpen(false);
    toast.success('Location set successfully');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingCustomer) {
      updateMutation.mutate({ id: editingCustomer.id, ...formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  // Auto-detect zone from address using geocoding
  const handleAutoDetectZone = async () => {
    if (!formData.address) {
      toast.error('Please enter an address first');
      return;
    }

    setIsDetectingZone(true);
    setDetectedZoneInfo(null);

    try {
      const { data, error } = await supabase.functions.invoke('geocode-address', {
        body: { 
          address: formData.address,
          // Don't save to customer yet - let user confirm on map first
        }
      });

      if (error) throw error;

      const result = data as GeocodeResult;
      
      if (result.latitude && result.longitude) {
        // Set pending location FIRST (before async state updates)
        setPendingLocation({ lat: result.latitude, lng: result.longitude });
        
        // Update form with geocoded coordinates and zone
        setFormData(prev => ({ 
          ...prev, 
          latitude: result.latitude,
          longitude: result.longitude,
          delivery_zone: result.matchedZone || prev.delivery_zone,
          major_zone_id: result.matchedMajorZoneId || prev.major_zone_id
        }));
        
        setDetectedZoneInfo(result);
        
        // Show success message and open map for verification
        const zoneInfo = result.matchedZone 
          ? `Zone: ${result.matchedZone}` 
          : 'No zone matched';
        toast.success(`Address located. ${zoneInfo}. Verify on map.`);
        
        // Open the map picker so user can verify/adjust the location
        setIsLocationPickerOpen(true);
      } else {
        toast.error('Could not locate address');
      }
    } catch (error: any) {
      console.error('Geocoding error:', error);
      toast.error(error.message || 'Failed to detect zone');
    } finally {
      setIsDetectingZone(false);
    }
  };

  // Bulk auto-assign zones for all customers with addresses but no zone
  const handleBulkAutoAssign = async () => {
    const eligibleCustomers = customers?.filter(c => c.address && !c.delivery_zone) || [];
    
    if (eligibleCustomers.length === 0) {
      toast.info('No customers with addresses need zone assignment');
      return;
    }

    setIsBulkAssigning(true);
    setBulkProgress({ current: 0, total: eligibleCustomers.length, matched: 0, failed: 0 });

    let matched = 0;
    let failed = 0;

    for (let i = 0; i < eligibleCustomers.length; i++) {
      const customer = eligibleCustomers[i];
      
      try {
        const { data, error } = await supabase.functions.invoke('geocode-address', {
          body: { 
            address: customer.address,
            customerId: customer.id
          }
        });

        if (error) throw error;

        const result = data as GeocodeResult;
        if (result.matchedZone) {
          matched++;
        } else {
          failed++;
        }
      } catch (error) {
        console.error(`Failed to geocode customer ${customer.name}:`, error);
        failed++;
      }

      setBulkProgress({ 
        current: i + 1, 
        total: eligibleCustomers.length, 
        matched, 
        failed 
      });

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    setIsBulkAssigning(false);
    queryClient.invalidateQueries({ queryKey: ['fnb-customers'] });
    
    toast.success(`Bulk assignment complete: ${matched} matched, ${failed} could not be matched`);
  };

  const filteredCustomers = customers?.filter((c) => {
    const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.whatsapp_phone.includes(searchTerm);
    // Support filtering by major zone id or sub-zone name
    const matchesZone = zoneFilter === 'all' || 
      (zoneFilter === 'unassigned' ? (!c.delivery_zone && !c.major_zone_id) : 
        (c.delivery_zone === zoneFilter || c.major_zone_id === zoneFilter));
    return matchesSearch && matchesZone;
  });

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-background">
      <div className="px-4 md:container py-6 w-full max-w-full overflow-x-hidden">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/distribution">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold tracking-tight">Distribution Customers</h1>
            <p className="text-muted-foreground">
              Manage customers and delivery zones
            </p>
          </div>
          <input
            type="file"
            ref={fileInputRef}
            accept=".csv"
            onChange={handleFileSelect}
            className="hidden"
          />
          <ExportButton
            data={(filteredCustomers || []).map(c => ({
              name: c.name,
              phone: c.whatsapp_phone,
              address: c.address || '',
              zone: c.delivery_zone || '',
              type: customerTypeLabels[c.customer_type],
              language: languageLabels[c.preferred_language] || c.preferred_language,
              notes: c.notes || '',
            }))}
            filename="fnb-customers"
            columns={['name', 'phone', 'address', 'zone', 'type', 'language', 'notes']}
          />
          <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
            <Upload className="mr-2 h-4 w-4" />
            Import CSV
          </Button>
          <Button 
            variant="outline" 
            onClick={handleBulkAutoAssign}
            disabled={isBulkAssigning}
          >
            {isBulkAssigning ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Wand2 className="mr-2 h-4 w-4" />
            )}
            {isBulkAssigning ? `${bulkProgress.current}/${bulkProgress.total}` : 'Auto-Assign Zones'}
          </Button>
          {isMergeMode ? (
            <>
              <Button variant="outline" onClick={exitMergeMode}>
                <X className="mr-2 h-4 w-4" />
                Cancel
              </Button>
              <Button
                onClick={() => setIsMergeDialogOpen(true)}
                disabled={selectedForMerge.size !== 2}
              >
                <GitMerge className="mr-2 h-4 w-4" />
                Merge Selected ({selectedForMerge.size}/2)
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => setIsMergeMode(true)}>
              <GitMerge className="mr-2 h-4 w-4" />
              Merge Customers
            </Button>
          )}
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="mr-2 h-4 w-4" />
                Add Customer
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
              <DialogHeader className="flex-shrink-0">
                <DialogTitle>
                  {editingCustomer ? 'Edit Customer' : 'Add New Customer'}
                </DialogTitle>
              </DialogHeader>
              <ScrollArea className="flex-1 min-h-0 pr-4">
                <form onSubmit={handleSubmit} className="space-y-4 pb-2" id="customer-form">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Restaurant Name"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="whatsapp_phone">WhatsApp Phone</Label>
                    <Input
                      id="whatsapp_phone"
                      value={formData.whatsapp_phone}
                      onChange={(e) =>
                        setFormData({ ...formData, whatsapp_phone: e.target.value })
                      }
                      placeholder="+5999XXXXXXX"
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      Include country code (e.g., +5999 for Curaçao)
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="preferred_language">Preferred Language</Label>
                      <Select
                        value={formData.preferred_language}
                        onValueChange={(value) =>
                          setFormData({ ...formData, preferred_language: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pap">Papiamento</SelectItem>
                          <SelectItem value="en">English</SelectItem>
                          <SelectItem value="nl">Dutch</SelectItem>
                          <SelectItem value="es">Spanish</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="major_zone">Major Zone</Label>
                      <Select
                        value={formData.major_zone_id || ''}
                        onValueChange={(value) =>
                          setFormData({ 
                            ...formData, 
                            major_zone_id: value || null,
                            // Clear sub-zone if major zone changes
                            delivery_zone: '' 
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select major zone" />
                        </SelectTrigger>
                        <SelectContent>
                          {majorZones?.map((zone) => (
                            <SelectItem key={zone.id} value={zone.id}>
                              {zone.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">Primary delivery region</p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="delivery_zone">Sub-Zone</Label>
                      <div className="flex gap-2">
                        <Select
                          value={formData.delivery_zone || ''}
                          onValueChange={(value) => {
                            // Find the sub-zone to get its parent
                            const selectedSubZone = subZones?.find(sz => sz.name === value);
                            setFormData(prev => ({ 
                              ...prev, 
                              delivery_zone: value || null,
                              // Auto-fill major zone if sub-zone has a parent and major zone is not set
                              major_zone_id: selectedSubZone?.parent_zone_id || prev.major_zone_id
                            }));
                          }}
                        >
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Select sub-zone" />
                          </SelectTrigger>
                          <SelectContent>
                            {filteredSubZones?.map((zone) => (
                              <SelectItem key={zone.id} value={zone.name}>
                                {zone.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={handleAutoDetectZone}
                          disabled={isDetectingZone || !formData.address}
                          title="Auto-detect zone from address"
                        >
                          {isDetectingZone ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <MapPin className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => {
                            // Use existing coordinates if available, otherwise null
                            if (formData.latitude && formData.longitude) {
                              setPendingLocation({ lat: formData.latitude, lng: formData.longitude });
                            } else {
                              setPendingLocation(null);
                            }
                            setIsLocationPickerOpen(true);
                          }}
                          title="Pick location on map"
                        >
                          <MapIcon className="h-4 w-4" />
                        </Button>
                      </div>
                      {/* Show saved coordinates if available */}
                      {formData.latitude && formData.longitude && (
                        <div className="flex items-center gap-2 text-xs text-green-600 mt-1">
                          <MapPin className="h-3 w-3" />
                          <span>Saved: {formData.latitude.toFixed(5)}, {formData.longitude.toFixed(5)}</span>
                        </div>
                      )}
                      {subZonesUnlinked && (
                        <p className="text-xs text-amber-600">
                          ⚠ Sub-zones not linked to this major zone. Showing all sub-zones.
                        </p>
                      )}
                      {detectedZoneInfo && (
                        <div className="text-xs mt-1">
                          {detectedZoneInfo.matchedZone ? (
                            <span className="text-green-600">
                              ✓ Detected: {detectedZoneInfo.matchedZone}
                              {detectedZoneInfo.matchedMajorZoneName && ` (${detectedZoneInfo.matchedMajorZoneName})`}
                              {` - ${detectedZoneInfo.distance}m from center`}
                            </span>
                          ) : detectedZoneInfo.allZoneDistances?.length > 0 ? (
                            <span className="text-amber-600">
                              ⚠ Outside zones. Closest: {detectedZoneInfo.allZoneDistances[0].name} ({detectedZoneInfo.allZoneDistances[0].distance}m)
                            </span>
                          ) : (
                            <span className="text-muted-foreground">Could not determine zone</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="customer_type">Customer Type</Label>
                      <Select
                        value={formData.customer_type}
                        onValueChange={(value) =>
                          setFormData({ ...formData, customer_type: value as CustomerType })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="regular">Regular</SelectItem>
                          <SelectItem value="supermarket">Supermarket (Receipt Required)</SelectItem>
                          <SelectItem value="cod">COD (Cash on Delivery)</SelectItem>
                          <SelectItem value="credit">Credit Account</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="pricing_tier_id">Pricing Tier</Label>
                      <Select
                        value={formData.pricing_tier_id || ''}
                        onValueChange={(value) =>
                          setFormData({ ...formData, pricing_tier_id: value || null })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select pricing tier" />
                        </SelectTrigger>
                        <SelectContent>
                          {pricingTiers?.map((tier) => (
                            <SelectItem key={tier.id} value={tier.id}>
                              {tier.name} {tier.is_default && '(Default)'}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Determines product pricing for this customer
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="address">Address</Label>
                    <Textarea
                      id="address"
                      value={formData.address || ''}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      placeholder="Delivery address..."
                      rows={2}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                      id="notes"
                      value={formData.notes || ''}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Special instructions, preferences..."
                      rows={2}
                    />
                  </div>
                </form>
              </ScrollArea>
              <div className="flex justify-end gap-2 pt-4 border-t flex-shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" form="customer-form">
                  {editingCustomer ? 'Update' : 'Create'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* CSV Import Dialog */}
          <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
            <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5" />
                  Import Customers from CSV
                </DialogTitle>
              </DialogHeader>
              <div className="flex-1 overflow-auto">
                <p className="text-sm text-muted-foreground mb-4">
                  Found {csvData.length} customers to import. Preview (first 10):
                </p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Address</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {csvData.slice(0, 10).map((customer, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{customer.name}</TableCell>
                        <TableCell>{customer.whatsapp_phone}</TableCell>
                        <TableCell className="max-w-xs truncate">{customer.address || '-'}</TableCell>
                        <TableCell className="max-w-xs truncate">{customer.notes || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {csvData.length > 10 && (
                  <p className="text-sm text-muted-foreground mt-2">
                    ...and {csvData.length - 10} more
                  </p>
                )}
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={() => setIsImportDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleImport} disabled={isImporting}>
                  {isImporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Import {csvData.length} Customers
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Bulk Assignment Progress */}
        {isBulkAssigning && (
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Processing customers...</span>
                  <span>{bulkProgress.current} / {bulkProgress.total}</span>
                </div>
                <Progress value={(bulkProgress.current / bulkProgress.total) * 100} />
                <div className="flex gap-4 text-sm text-muted-foreground">
                  <span className="text-green-600">✓ Matched: {bulkProgress.matched}</span>
                  <span className="text-amber-600">✗ Failed: {bulkProgress.failed}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search customers..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={zoneFilter} onValueChange={setZoneFilter}>
                <SelectTrigger className="w-56">
                  <SelectValue placeholder="Filter by zone" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Zones</SelectItem>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {majorZones?.map((zone) => (
                    <SelectItem key={zone.id} value={zone.id}>
                      📍 {zone.name} (Major)
                    </SelectItem>
                  ))}
                  {subZoneNames.map((zone) => (
                    <SelectItem key={zone} value={zone}>
                      └ {zone}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-center py-8 text-muted-foreground">Loading customers...</p>
            ) : filteredCustomers && filteredCustomers.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    {isMergeMode && <TableHead className="w-10"></TableHead>}
                    <TableHead>Name</TableHead>
                    <TableHead>WhatsApp</TableHead>
                    <TableHead>Zone</TableHead>
                    <TableHead>Language</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead className="w-24">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCustomers.map((customer) => (
                    <TableRow 
                      key={customer.id}
                      className={selectedForMerge.has(customer.id) ? 'bg-primary/5' : ''}
                    >
                      {isMergeMode && (
                        <TableCell>
                          <Checkbox
                            checked={selectedForMerge.has(customer.id)}
                            onCheckedChange={() => toggleMergeSelection(customer.id)}
                            disabled={!selectedForMerge.has(customer.id) && selectedForMerge.size >= 2}
                          />
                        </TableCell>
                      )}
                      <TableCell className="font-medium">{customer.name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <MessageSquare className="h-4 w-4 text-green-600" />
                          {customer.whatsapp_phone}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          {customer.major_zone_id && majorZoneMap.get(customer.major_zone_id) && (
                            <Badge variant="outline" className="text-xs w-fit">
                              📍 {majorZoneMap.get(customer.major_zone_id)}
                            </Badge>
                          )}
                          {customer.delivery_zone ? (
                            <Badge variant="secondary" className="text-xs w-fit">
                              <Route className="h-3 w-3 mr-1" />
                              {customer.delivery_zone}
                            </Badge>
                          ) : !customer.major_zone_id ? (
                            <span className="text-muted-foreground text-xs">-</span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>{languageLabels[customer.preferred_language]}</TableCell>
                      <TableCell className="max-w-xs truncate">
                        {customer.address || '-'}
                      </TableCell>
                      <TableCell>
                        <TooltipProvider>
                          <div className="flex items-center gap-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleEdit(customer)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Edit customer</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDuplicateCustomer(customer)}
                                >
                                  <Copy className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Duplicate this customer</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    if (confirm('Delete this customer?')) {
                                      deleteMutation.mutate(customer.id);
                                    }
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Delete customer</TooltipContent>
                            </Tooltip>
                          </div>
                        </TooltipProvider>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-center py-8 text-muted-foreground">
                No customers found. Customers will be auto-created when they message via
                WhatsApp, or you can add them manually.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Merge Dialog */}
        <CustomerMergeDialog
          open={isMergeDialogOpen}
          onOpenChange={setIsMergeDialogOpen}
          customers={selectedCustomersForMerge}
          onMergeComplete={exitMergeMode}
        />

        {/* Location Picker Dialog */}
        <CustomerLocationPicker
          open={isLocationPickerOpen}
          onOpenChange={(open) => {
            setIsLocationPickerOpen(open);
            if (!open) setPendingLocation(null);
          }}
          initialLocation={
            pendingLocation || (formData.latitude && formData.longitude
              ? { lat: formData.latitude, lng: formData.longitude }
              : null)
          }
          customerName={formData.name || 'New Customer'}
          onLocationSelect={handleLocationSelect}
        />
      </div>
    </div>
  );
}
