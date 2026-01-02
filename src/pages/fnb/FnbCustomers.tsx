import { useState, useRef } from 'react';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Pencil, Trash2, ArrowLeft, Search, MessageSquare, Route, Upload, FileSpreadsheet, Loader2, MapPin, Wand2 } from 'lucide-react';
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
import { Progress } from '@/components/ui/progress';

type CustomerType = "regular" | "supermarket" | "cod" | "credit";

interface FnbCustomer {
  id: string;
  name: string;
  whatsapp_phone: string;
  preferred_language: string;
  address: string | null;
  delivery_zone: string | null;
  customer_type: CustomerType;
  notes: string | null;
  latitude?: number | null;
  longitude?: number | null;
  pricing_tier_id?: string | null;
}

const emptyCustomer: Omit<FnbCustomer, 'id'> = {
  name: '',
  whatsapp_phone: '',
  preferred_language: 'pap',
  address: '',
  delivery_zone: '',
  customer_type: 'regular',
  notes: '',
  pricing_tier_id: null,
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
  distance: number | null;
  allZoneDistances: { name: string; distance: number; withinRadius: boolean }[];
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

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
          .from('fnb_customers')
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
        .from('fnb_customers')
        .select('*')
        .order('name');
      if (error) throw error;
      return data as FnbCustomer[];
    },
  });

  // Fetch delivery zones from database
  const { data: deliveryZones } = useQuery({
    queryKey: ['fnb-delivery-zones-names'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fnb_delivery_zones')
        .select('name')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data?.map(z => z.name) || [];
    },
  });

  // Fetch pricing tiers
  const { data: pricingTiers } = useQuery({
    queryKey: ['fnb-pricing-tiers-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fnb_pricing_tiers')
        .select('id, name, is_default')
        .eq('is_active', true)
        .order('sort_order');
      if (error) throw error;
      return data || [];
    },
  });

  const allZones = deliveryZones || [];

  const createMutation = useMutation({
    mutationFn: async (customer: Omit<FnbCustomer, 'id'>) => {
      const { error } = await supabase.from('fnb_customers').insert(customer);
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
      const { error } = await supabase.from('fnb_customers').update(customer).eq('id', id);
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
      const { error } = await supabase.from('fnb_customers').delete().eq('id', id);
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

  const resetForm = () => {
    setFormData(emptyCustomer);
    setEditingCustomer(null);
    setDetectedZoneInfo(null);
  };

  const handleEdit = (customer: FnbCustomer) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name,
      whatsapp_phone: customer.whatsapp_phone,
      preferred_language: customer.preferred_language,
      address: customer.address || '',
      delivery_zone: customer.delivery_zone || '',
      customer_type: customer.customer_type || 'regular',
      notes: customer.notes || '',
      pricing_tier_id: customer.pricing_tier_id || null,
    });
    setDetectedZoneInfo(null);
    setIsDialogOpen(true);
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
          customerId: editingCustomer?.id // Will save coordinates if editing
        }
      });

      if (error) throw error;

      const result = data as GeocodeResult;
      setDetectedZoneInfo(result);

      if (result.matchedZone) {
        setFormData(prev => ({ ...prev, delivery_zone: result.matchedZone! }));
        toast.success(`Zone detected: ${result.matchedZone} (${result.distance}m from center)`);
      } else if (result.allZoneDistances?.length > 0) {
        const closest = result.allZoneDistances[0];
        toast.warning(`Address outside all zones. Closest: ${closest.name} (${closest.distance}m away)`);
      } else {
        toast.error('Could not determine zone');
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
    const matchesZone = zoneFilter === 'all' || 
      (zoneFilter === 'unassigned' ? !c.delivery_zone : c.delivery_zone === zoneFilter);
    return matchesSearch && matchesZone;
  });

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/fnb">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold tracking-tight">F&B Customers</h1>
            <p className="text-muted-foreground">
              Manage F&B customers and delivery zones
            </p>
          </div>
          <input
            type="file"
            ref={fileInputRef}
            accept=".csv"
            onChange={handleFileSelect}
            className="hidden"
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
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="mr-2 h-4 w-4" />
                Add Customer
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingCustomer ? 'Edit Customer' : 'Add New Customer'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
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

                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="delivery_zone">Delivery Zone</Label>
                    <div className="flex gap-2">
                      <Select
                        value={formData.delivery_zone || ''}
                        onValueChange={(value) =>
                          setFormData({ ...formData, delivery_zone: value || null })
                        }
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Select zone" />
                        </SelectTrigger>
                        <SelectContent>
                          {allZones.map((zone) => (
                            <SelectItem key={zone} value={zone}>
                              {zone}
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
                    </div>
                    {detectedZoneInfo && (
                      <div className="text-xs mt-1">
                        {detectedZoneInfo.matchedZone ? (
                          <span className="text-green-600">
                            ✓ Detected: {detectedZoneInfo.matchedZone} ({detectedZoneInfo.distance}m from center)
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

                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit">
                    {editingCustomer ? 'Update' : 'Create'}
                  </Button>
                </div>
              </form>
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
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filter by zone" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Zones</SelectItem>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {allZones.map((zone) => (
                    <SelectItem key={zone} value={zone}>
                      {zone}
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
                    <TableRow key={customer.id}>
                      <TableCell className="font-medium">{customer.name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <MessageSquare className="h-4 w-4 text-green-600" />
                          {customer.whatsapp_phone}
                        </div>
                      </TableCell>
                      <TableCell>
                        {customer.delivery_zone ? (
                          <Badge variant="secondary" className="text-xs">
                            <Route className="h-3 w-3 mr-1" />
                            {customer.delivery_zone}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">-</span>
                        )}
                      </TableCell>
                      <TableCell>{languageLabels[customer.preferred_language]}</TableCell>
                      <TableCell className="max-w-xs truncate">
                        {customer.address || '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(customer)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
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
                        </div>
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
      </main>
    </div>
  );
}
