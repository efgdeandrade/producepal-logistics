import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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
  delivery_station: string | null;
  currency: string;
  items: ExtractedItem[];
}

export interface MatchedItem extends ExtractedItem {
  matched_product_id: string | null;
  matched_product_name: string | null;
  confidence: 'high' | 'medium' | 'low' | 'none';
  save_mapping: boolean;
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
}

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
  });

  const parseFile = async (file: File) => {
    setState(prev => ({ ...prev, isUploading: true, error: null }));

    try {
      // Convert file to base64
      const buffer = await file.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
      );

      const fileType = file.name.endsWith('.html') ? 'html' : 'pdf';

      setState(prev => ({ ...prev, isUploading: false, isParsing: true }));

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
      
      setState(prev => ({
        ...prev,
        isParsing: false,
        extractedData,
        selectedDeliveryDate: extractedData.delivery_date || '',
        selectedDeliveryStation: extractedData.delivery_station || '',
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
        });
      } else {
        matchedItems.push({
          ...item,
          matched_product_id: null,
          matched_product_name: null,
          confidence: 'none',
          save_mapping: false,
        });
      }
    }

    setState(prev => ({ ...prev, matchedItems }));
    return matchedItems;
  };

  const updateMatchedItem = (index: number, updates: Partial<MatchedItem>) => {
    setState(prev => ({
      ...prev,
      matchedItems: prev.matchedItems.map((item, i) =>
        i === index ? { ...item, ...updates } : item
      ),
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
    const mappingsToSave = items.filter(
      item => item.save_mapping && item.matched_product_id && item.sku
    );

    if (mappingsToSave.length === 0) return;

    const { error } = await supabase
      .from('fnb_customer_product_mappings')
      .upsert(
        mappingsToSave.map(item => ({
          customer_id: customerId,
          customer_sku: item.sku,
          customer_product_name: item.description,
          product_id: item.matched_product_id!,
          confidence_score: 1.0,
          is_verified: true,
        })),
        { onConflict: 'customer_id,customer_sku' }
      );

    if (error) {
      console.error('Error saving mappings:', error);
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
  };
}
