import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { format, addDays, getDay } from 'date-fns';

export interface ExtractedItem {
  sku: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number | null;
}

export interface ExtractedPOData {
  customer_name: string;
  customer_code: string;
  po_number: string;
  delivery_date: string | null;
  delivery_date_raw: string | null;
  detected_delivery_weekday?: string | null;
  delivery_station: string | null;
  currency: string;
  items: ExtractedItem[];
}

export interface MatchedItem extends ExtractedItem {
  matched_product_id: string | null;
  matched_product_name: string | null;
  confidence: 'high' | 'medium' | 'low' | 'none';
  save_mapping: boolean;
  was_manually_changed: boolean;
  original_matched_product_id: string | null;
}

export interface POImportState {
  isUploading: boolean;
  isParsing: boolean;
  extractedData: ExtractedPOData | null;
  matchedItems: MatchedItem[];
  selectedCustomerId: string;
  selectedDeliveryDate: string;
  selectedDeliveryStation: string;
  error: string | null;
  isWeeklyFormat: boolean;
}

// Osteria Rosso / Fuik customer ID for auto-matching
const OSTERIA_ROSSO_CUSTOMER_ID = '438683c8-6ee2-4b05-884b-e1f689cb7922';

// Detect weekly order template format (Fuik/Osteria Rosso style)
const detectWeeklyFormat = (rows: (string | number | null)[][]): boolean => {
  if (!rows.length) return false;
  const headerRow = rows[0] || [];
  const headers = headerRow.map(h => String(h || '').toLowerCase().trim());
  
  // Check for weekday columns
  const weekdays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
  const hasWeekdays = weekdays.some(day => 
    headers.some(h => h.includes(day))
  );
  
  // Check for typical Fuik columns
  const hasUnit = headers.some(h => h === 'unit' || h.includes('unit'));
  const hasStatus = headers.some(h => h === 'status' || h.includes('status'));
  
  return hasWeekdays && (hasUnit || hasStatus);
};

// Calculate the next occurrence of a weekday from today
const getNextWeekdayDate = (targetDay: string): string => {
  const dayMap: Record<string, number> = {
    'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3,
    'thursday': 4, 'friday': 5, 'saturday': 6
  };
  
  const today = new Date();
  const todayDay = getDay(today);
  const targetDayNum = dayMap[targetDay.toLowerCase()];
  
  if (targetDayNum === undefined) return format(addDays(today, 1), 'yyyy-MM-dd');
  
  let daysUntil = targetDayNum - todayDay;
  if (daysUntil <= 0) {
    daysUntil += 7; // Next week
  }
  
  return format(addDays(today, daysUntil), 'yyyy-MM-dd');
};

export function usePOImport() {
  const [state, setState] = useState<POImportState>({
    isUploading: false,
    isParsing: false,
    extractedData: null,
    matchedItems: [],
    selectedCustomerId: '',
    selectedDeliveryDate: '',
    selectedDeliveryStation: '',
    error: null,
    isWeeklyFormat: false,
  });

  const parseFile = async (file: File) => {
    setState(prev => ({ ...prev, isUploading: true, error: null, isWeeklyFormat: false }));

    try {
      const buffer = await file.arrayBuffer();
      let base64: string;
      let fileType: string;
      let isWeekly = false;

      // Check if it's a spreadsheet file
      const isSpreadsheet = /\.(csv|xlsx|xls)$/i.test(file.name);

      if (isSpreadsheet) {
        // Parse spreadsheet locally and convert to text
        const workbook = XLSX.read(buffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, { 
          header: 1, 
          defval: '' 
        });

        // Detect if this is a weekly format (Fuik/Osteria Rosso style)
        isWeekly = detectWeeklyFormat(rows);
        
        // Convert to pipe-delimited text for AI parsing
        let textContent = rows
          .map(row => (Array.isArray(row) ? row.join(' | ') : ''))
          .join('\n');

        // If weekly format detected, prepend metadata for AI
        if (isWeekly) {
          const today = new Date();
          const weekdayName = format(today, 'EEEE');
          const dateStr = format(today, 'yyyy-MM-dd');
          textContent = `FORMAT: WEEKLY_ORDER_TEMPLATE\nTODAY: ${weekdayName}, ${dateStr}\nFILENAME: ${file.name}\n\n${textContent}`;
          console.log('Detected weekly order template format (Fuik/Osteria style)');
        }

        // Encode as base64 (handle unicode)
        base64 = btoa(unescape(encodeURIComponent(textContent)));
        fileType = 'spreadsheet';
      } else {
        // Original handling for PDF/HTML
        base64 = btoa(
          new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
        );
        fileType = file.name.endsWith('.html') || file.name.endsWith('.htm') ? 'html' : 'pdf';
      }

      setState(prev => ({ ...prev, isUploading: false, isParsing: true, isWeeklyFormat: isWeekly }));

      // Call edge function
      const { data, error } = await supabase.functions.invoke('parse-purchase-order', {
        body: {
          file_base64: base64,
          file_type: fileType,
          file_name: file.name,
        },
      });

      if (error) {
        throw new Error(error.message || 'Failed to parse file');
      }

      if (!data?.success || !data?.data) {
        throw new Error(data?.error || 'Failed to extract data from file');
      }

      const extractedData = data.data as ExtractedPOData;
      
      // For weekly format with detected weekday, calculate actual delivery date if not already set
      let deliveryDate = extractedData.delivery_date || '';
      if (isWeekly && extractedData.detected_delivery_weekday && !deliveryDate) {
        deliveryDate = getNextWeekdayDate(extractedData.detected_delivery_weekday);
        console.log(`Calculated delivery date for ${extractedData.detected_delivery_weekday}: ${deliveryDate}`);
      }
      
      // Auto-detect customer for Fuik/Osteria files
      let autoCustomerId = '';
      const customerName = extractedData.customer_name?.toLowerCase() || '';
      const fileName = file.name.toLowerCase();
      if (customerName.includes('fuik') || customerName.includes('osteria') || 
          fileName.includes('fuik') || fileName.includes('osteria')) {
        autoCustomerId = OSTERIA_ROSSO_CUSTOMER_ID;
        console.log('Auto-matched customer: Osteria Rosso');
      }
      
      setState(prev => ({
        ...prev,
        isParsing: false,
        extractedData,
        selectedDeliveryDate: deliveryDate,
        selectedDeliveryStation: extractedData.delivery_station || '',
        selectedCustomerId: autoCustomerId || prev.selectedCustomerId,
      }));

      return extractedData;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to parse file';
      setState(prev => ({
        ...prev,
        isUploading: false,
        isParsing: false,
        error: message,
      }));
      toast.error(message);
      return null;
    }
  };

  const matchProducts = async (
    extractedItems: ExtractedItem[],
    customerId: string,
    products: any[]
  ): Promise<MatchedItem[]> => {
    // Fetch existing mappings for this customer
    const { data: mappings } = await supabase
      .from('fnb_customer_product_mappings')
      .select('*')
      .eq('customer_id', customerId);

    const matchedItems: MatchedItem[] = [];

    for (const item of extractedItems) {
      // Try to find mapping by SKU
      const mapping = mappings?.find(m => 
        m.customer_sku.toLowerCase() === item.sku.toLowerCase()
      );

      if (mapping) {
        const product = products.find(p => p.id === mapping.product_id);
        matchedItems.push({
          ...item,
          matched_product_id: mapping.product_id,
          matched_product_name: product?.name || null,
          confidence: mapping.is_verified ? 'high' : 'medium',
          save_mapping: false,
          was_manually_changed: false,
          original_matched_product_id: mapping.product_id,
        });
        continue;
      }

      // Try fuzzy match by name
      const normalizedDesc = item.description.toLowerCase().replace(/[^a-z0-9]/g, '');
      let bestMatch: { product: any; score: number } | null = null;

      for (const product of products) {
        const normalizedName = product.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        const normalizedCode = product.code.toLowerCase().replace(/[^a-z0-9]/g, '');

        // Exact match
        if (normalizedName === normalizedDesc || normalizedCode === item.sku.toLowerCase()) {
          bestMatch = { product, score: 1 };
          break;
        }

        // Partial match
        if (normalizedDesc.includes(normalizedName) || normalizedName.includes(normalizedDesc)) {
          const score = Math.min(normalizedName.length, normalizedDesc.length) / 
                       Math.max(normalizedName.length, normalizedDesc.length);
          if (!bestMatch || score > bestMatch.score) {
            bestMatch = { product, score };
          }
        }
      }

      if (bestMatch && bestMatch.score > 0.5) {
        matchedItems.push({
          ...item,
          matched_product_id: bestMatch.product.id,
          matched_product_name: bestMatch.product.name,
          confidence: bestMatch.score > 0.8 ? 'medium' : 'low',
          save_mapping: false,
          was_manually_changed: false,
          original_matched_product_id: bestMatch.product.id,
        });
      } else {
        matchedItems.push({
          ...item,
          matched_product_id: null,
          matched_product_name: null,
          confidence: 'none',
          save_mapping: false,
          was_manually_changed: false,
          original_matched_product_id: null,
        });
      }
    }

    setState(prev => ({ ...prev, matchedItems }));
    return matchedItems;
  };

  const updateMatchedItem = (index: number, updates: Partial<MatchedItem>) => {
    setState(prev => ({
      ...prev,
      matchedItems: prev.matchedItems.map((item, i) => {
        if (i !== index) return item;
        
        const newItem = { ...item, ...updates };
        
        // Auto-set save_mapping when user manually changes the product
        if (updates.matched_product_id !== undefined && updates.matched_product_id !== item.original_matched_product_id) {
          newItem.was_manually_changed = true;
          newItem.save_mapping = updates.matched_product_id !== null && item.confidence !== 'high';
        }
        
        return newItem;
      }),
    }));
  };

  const removeMatchedItem = (index: number) => {
    setState(prev => ({
      ...prev,
      matchedItems: prev.matchedItems.filter((_, i) => i !== index),
    }));
  };

  const setSelectedCustomerId = (customerId: string) => {
    setState(prev => ({ ...prev, selectedCustomerId: customerId }));
  };

  const setSelectedDeliveryDate = (date: string) => {
    setState(prev => ({ ...prev, selectedDeliveryDate: date }));
  };

  const setSelectedDeliveryStation = (station: string) => {
    setState(prev => ({ ...prev, selectedDeliveryStation: station }));
  };

  const saveMappings = async (customerId: string, items: MatchedItem[]) => {
    // Save all items that were manually changed by user OR explicitly marked for saving
    const mappingsToSave = items.filter(
      item => (item.save_mapping || item.was_manually_changed) && item.matched_product_id && item.sku
    );

    if (mappingsToSave.length === 0) return;

    // For each mapping, check if it already exists and update confidence
    for (const item of mappingsToSave) {
      const { data: existing } = await supabase
        .from('fnb_customer_product_mappings')
        .select('confidence_score')
        .eq('customer_id', customerId)
        .eq('customer_sku', item.sku)
        .single();
      
      const newConfidence = existing 
        ? Math.min((existing.confidence_score || 1.0) + 0.5, 5.0) // Increase confidence on re-verification, max 5
        : 1.0;

      const { error } = await supabase
        .from('fnb_customer_product_mappings')
        .upsert({
          customer_id: customerId,
          customer_sku: item.sku,
          customer_product_name: item.description,
          product_id: item.matched_product_id!,
          confidence_score: newConfidence,
          is_verified: true,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'customer_id,customer_sku' });

      if (error) {
        console.error('Error saving mapping:', error);
      }
    }
  };

  const reset = () => {
    setState({
      isUploading: false,
      isParsing: false,
      extractedData: null,
      matchedItems: [],
      selectedCustomerId: '',
      selectedDeliveryDate: '',
      selectedDeliveryStation: '',
      error: null,
      isWeeklyFormat: false,
    });
  };

  return {
    ...state,
    parseFile,
    matchProducts,
    updateMatchedItem,
    removeMatchedItem,
    setSelectedCustomerId,
    setSelectedDeliveryDate,
    setSelectedDeliveryStation,
    saveMappings,
    reset,
    OSTERIA_ROSSO_CUSTOMER_ID,
  };
}
