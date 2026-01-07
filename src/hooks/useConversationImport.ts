import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ParsedItem {
  raw_text: string;
  interpreted_product: string;
  matched_product_code?: string | null;
  quantity: number;
  unit: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface ParsedConversation {
  customer_name?: string;
  customer_phone?: string;
  detected_language: 'pap' | 'en' | 'nl' | 'es' | 'mixed';
  delivery_date?: string;
  special_instructions?: string;
  items: ParsedItem[];
}

export interface MatchedConversationItem extends ParsedItem {
  matched_product_id: string | null;
  matched_product_name: string | null;
  suggested_price: number | null;
  was_manually_changed: boolean;
  match_source: 'verified' | 'customer_mapping' | 'product_name' | 'ai_match' | 'unmatched';
  log_id?: string; // Track the AI log entry for this item
}

interface Product {
  id: string;
  code: string;
  name: string;
  name_pap?: string | null;
  name_nl?: string | null;
  name_es?: string | null;
  price_xcg: number;
  unit: string;
}

interface CustomerMapping {
  customer_sku: string;
  customer_product_name: string;
  product_id: string;
  confidence_score: number;
  is_verified: boolean;
}

export function useConversationImport() {
  const [isParsing, setIsParsing] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedConversation | null>(null);
  const [matchedItems, setMatchedItems] = useState<MatchedConversationItem[]>([]);
  const [originalText, setOriginalText] = useState('');
  const [learnedCount, setLearnedCount] = useState(0);
  const logIdsRef = useRef<string[]>([]);

  // Fuzzy match helper
  const fuzzyMatch = (str1: string, str2: string): number => {
    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();
    
    if (s1 === s2) return 1;
    if (s1.includes(s2) || s2.includes(s1)) return 0.8;
    
    // Simple Levenshtein-based similarity
    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;
    
    if (longer.length === 0) return 1;
    
    const editDistance = levenshtein(shorter, longer);
    return (longer.length - editDistance) / longer.length;
  };

  const levenshtein = (a: string, b: string): number => {
    const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));
    for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= b.length; j++) matrix[j][0] = j;
    for (let j = 1; j <= b.length; j++) {
      for (let i = 1; i <= a.length; i++) {
        const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator
        );
      }
    }
    return matrix[b.length][a.length];
  };

  // Match a single item to products using priority-based matching
  const matchItem = useCallback((
    item: ParsedItem,
    products: Product[],
    customerMappings: CustomerMapping[],
    globalAliases: { alias: string; product_id: string }[]
  ): MatchedConversationItem => {
    const searchTerms = [
      item.interpreted_product.toLowerCase(),
      item.raw_text.toLowerCase(),
      item.matched_product_code?.toLowerCase()
    ].filter(Boolean) as string[];

    // 1. Check verified customer mappings (highest priority)
    for (const mapping of customerMappings.filter(m => m.is_verified)) {
      for (const term of searchTerms) {
        if (fuzzyMatch(term, mapping.customer_product_name) > 0.8 ||
            fuzzyMatch(term, mapping.customer_sku) > 0.8) {
          const product = products.find(p => p.id === mapping.product_id);
          if (product) {
            return {
              ...item,
              matched_product_id: product.id,
              matched_product_name: product.name,
              suggested_price: product.price_xcg,
              was_manually_changed: false,
              match_source: 'verified',
              confidence: 'high'
            };
          }
        }
      }
    }

    // 2. Check customer-specific mappings
    for (const mapping of customerMappings.filter(m => !m.is_verified)) {
      for (const term of searchTerms) {
        if (fuzzyMatch(term, mapping.customer_product_name) > 0.7) {
          const product = products.find(p => p.id === mapping.product_id);
          if (product) {
            return {
              ...item,
              matched_product_id: product.id,
              matched_product_name: product.name,
              suggested_price: product.price_xcg,
              was_manually_changed: false,
              match_source: 'customer_mapping',
              confidence: 'medium'
            };
          }
        }
      }
    }

    // 3. Check global aliases
    for (const alias of globalAliases) {
      for (const term of searchTerms) {
        if (fuzzyMatch(term, alias.alias) > 0.8) {
          const product = products.find(p => p.id === alias.product_id);
          if (product) {
            return {
              ...item,
              matched_product_id: product.id,
              matched_product_name: product.name,
              suggested_price: product.price_xcg,
              was_manually_changed: false,
              match_source: 'product_name',
              confidence: 'medium'
            };
          }
        }
      }
    }

    // 4. Check product code match from AI
    if (item.matched_product_code) {
      const product = products.find(p => 
        p.code.toLowerCase() === item.matched_product_code!.toLowerCase()
      );
      if (product) {
        return {
          ...item,
          matched_product_id: product.id,
          matched_product_name: product.name,
          suggested_price: product.price_xcg,
          was_manually_changed: false,
          match_source: 'ai_match',
          confidence: item.confidence
        };
      }
    }

    // 5. Check multi-language product names
    let bestMatch: { product: Product; score: number } | null = null;
    for (const product of products) {
      const namesToCheck = [
        product.name,
        product.name_pap,
        product.name_nl,
        product.name_es,
        product.code
      ].filter(Boolean) as string[];

      for (const name of namesToCheck) {
        for (const term of searchTerms) {
          const score = fuzzyMatch(term, name);
          if (score > 0.6 && (!bestMatch || score > bestMatch.score)) {
            bestMatch = { product, score };
          }
        }
      }
    }

    if (bestMatch && bestMatch.score > 0.6) {
      return {
        ...item,
        matched_product_id: bestMatch.product.id,
        matched_product_name: bestMatch.product.name,
        suggested_price: bestMatch.product.price_xcg,
        was_manually_changed: false,
        match_source: 'product_name',
        confidence: bestMatch.score > 0.8 ? 'medium' : 'low'
      };
    }

    // No match found
    return {
      ...item,
      matched_product_id: null,
      matched_product_name: null,
      suggested_price: null,
      was_manually_changed: false,
      match_source: 'unmatched',
      confidence: 'low'
    };
  }, []);

  // Parse conversation text
  const parseConversation = useCallback(async (
    text: string,
    products: Product[],
    customerId?: string
  ): Promise<ParsedConversation | null> => {
    if (!text.trim()) {
      toast.error('Please paste a conversation');
      return null;
    }

    setIsParsing(true);
    setOriginalText(text);

    try {
      // Fetch customer mappings if customer is known
      let customerMappings: CustomerMapping[] = [];
      if (customerId) {
        const { data: mappings } = await supabase
          .from('fnb_customer_product_mappings')
          .select('customer_sku, customer_product_name, product_id, confidence_score, is_verified')
          .eq('customer_id', customerId)
          .order('confidence_score', { ascending: false });
        customerMappings = mappings || [];
      }

      // Fetch global aliases
      const { data: aliases } = await supabase
        .from('fnb_product_aliases')
        .select('alias, product_id');
      const globalAliases = aliases || [];

      // Call AI to parse the conversation
      const { data, error } = await supabase.functions.invoke('parse-whatsapp-order', {
        body: {
          conversationText: text,
          products: products.map(p => ({
            code: p.code,
            name: p.name,
            name_pap: p.name_pap,
            name_nl: p.name_nl,
            name_es: p.name_es
          })),
          customerMappings: customerMappings.map(m => ({
            customer_product_name: m.customer_product_name,
            product_name: products.find(p => p.id === m.product_id)?.name || ''
          }))
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const parsed = data as ParsedConversation;
      setParsedData(parsed);

      // Match all items and log to AI training database
      const matched: MatchedConversationItem[] = [];
      const newLogIds: string[] = [];
      
      for (const item of parsed.items) {
        const matchedItem = matchItem(item, products, customerMappings, globalAliases);
        
        // Log this match to AI training database
        try {
          const { data: logEntry, error: logError } = await supabase
            .from('fnb_ai_match_logs')
            .insert({
              raw_text: item.raw_text,
              interpreted_text: item.interpreted_product,
              customer_id: customerId,
              matched_product_id: matchedItem.matched_product_id,
              match_source: matchedItem.match_source,
              confidence: matchedItem.confidence,
              detected_language: parsed.detected_language,
              detected_quantity: item.quantity,
              detected_unit: item.unit,
              needs_review: matchedItem.confidence === 'low' || matchedItem.match_source === 'unmatched',
            })
            .select('id')
            .single();
          
          if (!logError && logEntry) {
            matchedItem.log_id = logEntry.id;
            newLogIds.push(logEntry.id);
          }
        } catch (e) {
          console.error('Failed to log AI match:', e);
        }
        
        matched.push(matchedItem);
      }
      
      logIdsRef.current = newLogIds;
      setMatchedItems(matched);

      // Count how many were learned matches (verified or customer_mapping)
      const learned = matched.filter(m => 
        m.match_source === 'verified' || m.match_source === 'customer_mapping'
      ).length;
      setLearnedCount(learned);

      return parsed;
    } catch (error) {
      console.error('Error parsing conversation:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to parse conversation');
      return null;
    } finally {
      setIsParsing(false);
    }
  }, [matchItem]);

  // Update a matched item (when user corrects a match)
  const updateMatchedItem = useCallback((index: number, updates: Partial<MatchedConversationItem>) => {
    setMatchedItems(prev => prev.map((item, i) => {
      if (i !== index) return item;
      
      // Mark as manually changed if product was changed
      const wasProductChanged = updates.matched_product_id && updates.matched_product_id !== item.matched_product_id;
      
      return { 
        ...item, 
        ...updates, 
        was_manually_changed: wasProductChanged || item.was_manually_changed 
      };
    }));
  }, []);

  // Remove a matched item
  const removeMatchedItem = useCallback((index: number) => {
    setMatchedItems(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Save learned mappings from user corrections and update AI logs
  const saveMappings = useCallback(async (customerId: string, orderId?: string) => {
    const correctedItems = matchedItems.filter(item => item.was_manually_changed && item.matched_product_id);
    
    // Update AI logs with corrections and order ID
    for (const item of matchedItems) {
      if (!item.log_id) continue;
      
      try {
        const updateData: Record<string, unknown> = {};
        
        // Link to order if provided
        if (orderId) {
          updateData.order_id = orderId;
        }
        
        // If item was corrected, update the log
        if (item.was_manually_changed && item.matched_product_id) {
          updateData.was_corrected = true;
          updateData.corrected_product_id = item.matched_product_id;
          updateData.needs_review = false; // User already corrected it
        }
        
        if (Object.keys(updateData).length > 0) {
          await supabase
            .from('fnb_ai_match_logs')
            .update(updateData)
            .eq('id', item.log_id);
        }
      } catch (e) {
        console.error('Failed to update AI log:', e);
      }
    }

    // Save customer-specific mappings for corrections
    const newMappings = correctedItems.map(item => ({
      customer_id: customerId,
      customer_sku: item.raw_text.toLowerCase().slice(0, 100),
      customer_product_name: item.interpreted_product.slice(0, 100),
      product_id: item.matched_product_id!,
      confidence_score: 1,
      is_verified: false
    }));

    if (newMappings.length === 0) return correctedItems.length;

    try {
      for (const mapping of newMappings) {
        const { error } = await supabase
          .from('fnb_customer_product_mappings')
          .upsert(mapping, {
            onConflict: 'customer_id,customer_sku',
            ignoreDuplicates: false
          });
        
        if (error) {
          console.error('Error saving mapping:', error);
        }
      }

      console.log(`Saved ${newMappings.length} product mappings for learning`);
    } catch (error) {
      console.error('Error saving mappings:', error);
    }
    
    return correctedItems.length;
  }, [matchedItems]);

  // Reset state
  const reset = useCallback(() => {
    setParsedData(null);
    setMatchedItems([]);
    setOriginalText('');
    setIsParsing(false);
    setLearnedCount(0);
    logIdsRef.current = [];
  }, []);

  return {
    isParsing,
    parsedData,
    matchedItems,
    originalText,
    learnedCount,
    parseConversation,
    updateMatchedItem,
    removeMatchedItem,
    saveMappings,
    reset
  };
}
