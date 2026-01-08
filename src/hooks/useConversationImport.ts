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
  context_words?: Array<{
    word: string;
    word_type: string;
    meaning: string;
    example?: string;
  }>;
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

interface CustomerPattern {
  product_id: string;
  product_name: string;
  order_count: number;
  avg_quantity: number;
}

export function useConversationImport() {
  const [isParsing, setIsParsing] = useState(false);
  const [parseStage, setParseStage] = useState<string>('');
  const [parsedData, setParsedData] = useState<ParsedConversation | null>(null);
  const [matchedItems, setMatchedItems] = useState<MatchedConversationItem[]>([]);
  const [originalText, setOriginalText] = useState('');
  const [learnedCount, setLearnedCount] = useState(0);
  const [discoveredWordsCount, setDiscoveredWordsCount] = useState(0);
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
    globalAliases: { alias: string; product_id: string }[],
    customerPatterns?: CustomerPattern[]
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

    // 5. Check multi-language product names (boost score for frequently ordered products)
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
          let score = fuzzyMatch(term, name);
          
          // Boost score if this product is in customer's frequent orders
          if (customerPatterns) {
            const pattern = customerPatterns.find(p => p.product_id === product.id);
            if (pattern) {
              // Small boost based on how often they order this product
              score += Math.min(0.1, pattern.order_count * 0.01);
            }
          }
          
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

  // Number words in Papiamentu/Spanish/Dutch for local parsing
  const numberWords: Record<string, number> = {
    'un': 1, 'uno': 1, 'een': 1, 'one': 1,
    'dos': 2, 'twee': 2, 'two': 2,
    'tres': 3, 'drie': 3, 'three': 3,
    'kuater': 4, 'cuatro': 4, 'vier': 4, 'four': 4,
    'sinku': 5, 'cinco': 5, 'vijf': 5, 'five': 5,
    'seis': 6, 'zes': 6, 'six': 6,
    'siete': 7, 'zeven': 7, 'seven': 7,
    'ocho': 8, 'acht': 8, 'eight': 8,
    'nuebe': 9, 'nueve': 9, 'negen': 9, 'nine': 9,
    'dies': 10, 'diez': 10, 'tien': 10, 'ten': 10,
    'meimei': 0.5, 'half': 0.5, 'mei': 0.5
  };

  // Extended unit vocabulary (Papiamentu, Dutch, Spanish, English)
  const unitPattern = 'kg|kilo|kilos?|lb|lbs?|pound|pon|gram|gr|g|tros|bunch|bunches|case|cases|kashi|kaha|kahas?|boxes?|stuk|stuks?|pcs|pieces?|pc|dozen?|dòs|saku|bag|bags?|paki?|pack|packs?|extracto?|botella?|bòter|fles|bottle|bottles?|liter?|liters?|l|tin|tins?|blek|can|cans?|krat|crate|crates?|bak|bakje|tray|trays?|set|sets?|bos|paar|pair|pairs?|rol|roll|rolls?';

  // Local pre-parsing to extract items without AI
  const localPreParse = useCallback((text: string): ParsedItem[] => {
    const items: ParsedItem[] = [];
    const lines = text.split('\n').filter(l => l.trim());
    
    // Common patterns with number words support
    const patterns = [
      // Pattern 1: "2 paki mint", "3 kg orange" - number + unit + product
      new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*(${unitPattern})\\s+(.+)`, 'i'),
      // Pattern 1b: "dos kaha orange" - word number + unit + product
      new RegExp(`(${Object.keys(numberWords).join('|')})\\s+(${unitPattern})\\s+(.+)`, 'i'),
      // Pattern 2: "tomaat - 5 kg" - product + separator + number + unit
      new RegExp(`(.+?)\\s*[-:]\\s*(\\d+(?:[.,]\\d+)?)\\s*(${unitPattern})?`, 'i'),
      // Pattern 3: "5 x tomaat" - number x product
      /(\d+(?:[.,]\d+)?)\s*[x×]\s*(.+)/i,
      // Pattern 3b: "dos x tomaat" - word number x product
      new RegExp(`(${Object.keys(numberWords).join('|')})\\s*[x×]\\s*(.+)`, 'i'),
      // Pattern 4: "2 mint", "1 lamunchi" - simple number + product (no unit)
      /^(\d+(?:[.,]\d+)?)\s+([a-zA-ZÀ-ÿ][\w\sÀ-ÿ-]+)$/i,
      // Pattern 4b: "un mint", "dos lamunchi" - word number + product
      new RegExp(`^(${Object.keys(numberWords).join('|')})\\s+([a-zA-ZÀ-ÿ][\\w\\sÀ-ÿ-]+)$`, 'i'),
    ];
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.length < 3) continue;
      
      // Skip greeting/non-order lines
      if (/^(bon dia|bon tardi|bon nochi|hallo|hello|hi|danki|thanks|gracias|dank|ayo|te mira)/i.test(trimmed)) continue;
      if (/^(mi por|kan ik|can i|puedo|kiko ta|kon ta bai)/i.test(trimmed)) continue;
      
      let matched = false;
      for (const pattern of patterns) {
        const match = trimmed.match(pattern);
        if (match) {
          // Parse quantity - either number or word
          let qty: number;
          const qtyStr = match[1].toLowerCase();
          if (numberWords[qtyStr] !== undefined) {
            qty = numberWords[qtyStr];
          } else {
            qty = parseFloat(match[1].replace(',', '.'));
          }
          
          if (!isNaN(qty) && qty > 0) {
            // Determine product and unit from matched groups
            const possibleUnit = match[2]?.toLowerCase();
            const isUnit = new RegExp(`^(${unitPattern})$`, 'i').test(possibleUnit);
            
            const product = isUnit 
              ? (match[3]?.trim() || trimmed)
              : (match[2]?.trim() || trimmed);
            
            items.push({
              raw_text: trimmed,
              interpreted_product: product,
              quantity: qty,
              unit: isUnit ? possibleUnit : 'pcs',
              confidence: 'medium'
            });
            matched = true;
            break;
          }
        }
      }
      
      // If no pattern matched but line has a number, try simple extraction
      if (!matched && /\d/.test(trimmed)) {
        const simpleMatch = trimmed.match(/(\d+(?:[.,]\d+)?)\s*(.+)/);
        if (simpleMatch) {
          const qty = parseFloat(simpleMatch[1].replace(',', '.'));
          if (!isNaN(qty) && qty > 0 && simpleMatch[2].length > 1) {
            items.push({
              raw_text: trimmed,
              interpreted_product: simpleMatch[2].trim(),
              quantity: qty,
              unit: 'pcs',
              confidence: 'low'
            });
          }
        }
      }
    }
    
    return items;
  }, []);

  // Try to match items locally before calling AI
  const tryLocalMatch = useCallback((
    items: ParsedItem[],
    products: Product[],
    customerMappings: CustomerMapping[],
    globalAliases: { alias: string; product_id: string }[],
    customerPatterns?: CustomerPattern[]
  ): { matched: MatchedConversationItem[]; unmatched: ParsedItem[] } => {
    const matched: MatchedConversationItem[] = [];
    const unmatched: ParsedItem[] = [];
    
    for (const item of items) {
      const result = matchItem(item, products, customerMappings, globalAliases, customerPatterns);
      if (result.matched_product_id && result.match_source !== 'unmatched') {
        matched.push(result);
      } else {
        unmatched.push(item);
      }
    }
    
    return { matched, unmatched };
  }, [matchItem]);

  // Helper to wrap promise with timeout
  const withTimeout = <T>(promise: Promise<T>, ms: number, errorMessage: string): Promise<T> => {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => 
        setTimeout(() => reject(new Error(errorMessage)), ms)
      )
    ]);
  };

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
    setParseStage('Loading known mappings...');
    setDiscoveredWordsCount(0);

    try {
      // Fetch customer mappings, global aliases, and customer patterns in PARALLEL
      const [mappingsResult, aliasesResult, patternsResult] = await Promise.all([
        customerId 
          ? supabase
              .from('fnb_customer_product_mappings')
              .select('customer_sku, customer_product_name, product_id, confidence_score, is_verified')
              .eq('customer_id', customerId)
              .order('confidence_score', { ascending: false })
          : Promise.resolve({ data: [] }),
        supabase
          .from('fnb_product_aliases')
          .select('alias, product_id'),
        customerId
          ? supabase
              .from('fnb_customer_patterns')
              .select('product_id, order_count, avg_quantity, fnb_products(name)')
              .eq('customer_id', customerId)
              .order('order_count', { ascending: false })
              .limit(20)
          : Promise.resolve({ data: [] })
      ]);
      
      const customerMappings: CustomerMapping[] = mappingsResult.data || [];
      const globalAliases = aliasesResult.data || [];
      
      // Transform patterns to include product name
      const customerPatterns: CustomerPattern[] = (patternsResult.data || []).map((p: any) => ({
        product_id: p.product_id,
        product_name: p.fnb_products?.name || '',
        order_count: p.order_count || 0,
        avg_quantity: p.avg_quantity || 0
      }));

      // Try local pre-parsing first
      setParseStage('Quick matching...');
      const localItems = localPreParse(text);
      
      let parsed: ParsedConversation;
      let allMatched: MatchedConversationItem[] = [];
      
      // Count potential order lines (lines with numbers that could be orders)
      const potentialOrderLines = text.split('\n')
        .filter(l => l.trim())
        .filter(l => /\d/.test(l))
        .filter(l => !/^\d{1,2}jan|feb|mar|apr|mei|jun|jul|aug|sep|okt|nov|dec/i.test(l.trim())) // Exclude dates
        .filter(l => !/^(bon|hallo|hello|hi|danki|thanks|gracias)/i.test(l.trim())) // Exclude greetings
        .length;

      if (localItems.length > 0) {
        // Try to match locally first
        const { matched: localMatched, unmatched } = tryLocalMatch(
          localItems, products, customerMappings, globalAliases, customerPatterns
        );
        
        // Only skip AI if local parser found ALL potential order items
        if (unmatched.length === 0 && localMatched.length > 0 && localItems.length >= potentialOrderLines) {
          // All items matched locally - no AI needed!
          parsed = {
            detected_language: 'mixed',
            items: localItems
          };
          allMatched = localMatched;
          setParseStage('');
        } else {
          // Some items need AI help
          setParseStage(`AI parsing ${unmatched.length} items...`);
          
          // Check if this is a simple order (few unmatched items)
          const isSimple = unmatched.length <= 3;
          
          // Only send top 40 products to AI for speed
          const topProducts = products.slice(0, 40);
          
          try {
            // Wrap with 12 second client-side timeout - fail fast
            const { data, error } = await withTimeout(
              supabase.functions.invoke('parse-whatsapp-order', {
                body: {
                  conversationText: text,
                  customerId: customerId,
                  isSimpleOrder: isSimple,
                  products: topProducts.map(p => ({
                    code: p.code,
                    name: p.name,
                    name_pap: p.name_pap
                  })),
                  customerMappings: customerMappings.slice(0, 20).map(m => ({
                    customer_product_name: m.customer_product_name,
                    product_name: products.find(p => p.id === m.product_id)?.name || ''
                  })),
                  customerPatterns: customerPatterns.slice(0, 10).map(p => ({
                    product_name: p.product_name,
                    avg_quantity: p.avg_quantity
                  }))
                }
              }),
              12000,
              'AI parsing timed out'
            );

            // Handle timeout or error - fall back to local matches + manual entry
            if (error || data?.timedOut || data?.error) {
              console.warn('AI unavailable:', error?.message || data?.error);
              
              if (localMatched.length > 0) {
                toast.info('AI slow - using quick matches. Adjust items if needed.', { duration: 3000 });
                parsed = {
                  detected_language: 'mixed',
                  items: localItems
                };
                // Include local matches plus unmatched items for manual entry
                allMatched = [
                  ...localMatched,
                  ...unmatched.map(item => ({
                    ...item,
                    matched_product_id: null,
                    matched_product_name: null,
                    suggested_price: null,
                    was_manually_changed: false,
                    match_source: 'unmatched' as const,
                    confidence: 'low' as const
                  }))
                ];
              } else {
                // No local matches - show local parsed items for manual matching
                toast.info('AI unavailable - please match items manually.', { duration: 4000 });
                parsed = {
                  detected_language: 'mixed',
                  items: localItems.length > 0 ? localItems : [{ 
                    raw_text: text, 
                    interpreted_product: 'Manual entry needed',
                    quantity: 1, 
                    unit: 'pcs', 
                    confidence: 'low' as const 
                  }]
                };
                allMatched = parsed.items.map(item => ({
                  ...item,
                  matched_product_id: null,
                  matched_product_name: null,
                  suggested_price: null,
                  was_manually_changed: false,
                  match_source: 'unmatched' as const,
                  confidence: 'low' as const
                }));
              }
            } else {
              parsed = data as ParsedConversation;
              
              // Track discovered context words
              if (parsed.context_words?.length) {
                setDiscoveredWordsCount(parsed.context_words.length);
              }
              
              // Match AI-parsed items
              setParseStage('Matching products...');
              for (const item of parsed.items) {
                allMatched.push(matchItem(item, products, customerMappings, globalAliases, customerPatterns));
              }
            }
          } catch (aiError) {
            // Catch any unexpected errors - fallback to local/manual
            console.warn('AI parsing error:', aiError);
            toast.info('AI unavailable - adjust items manually.', { duration: 3000 });
            parsed = {
              detected_language: 'mixed',
              items: localItems
            };
            allMatched = localItems.map(item => ({
              ...item,
              matched_product_id: null,
              matched_product_name: null,
              suggested_price: null,
              was_manually_changed: false,
              match_source: 'unmatched' as const,
              confidence: 'low' as const
            }));
          }
        }
      } else {
        // No local items parsed, use AI for everything
        setParseStage('AI parsing order...');
        
        // Count line complexity to choose model
        const lineCount = text.split('\n').filter(l => l.trim() && /\d/.test(l)).length;
        const isSimple = lineCount <= 3;
        
        // Only send top 40 products to AI for speed
        const topProducts = products.slice(0, 40);
        
        try {
          // Wrap with 30 second client-side timeout
          const { data, error } = await withTimeout(
            supabase.functions.invoke('parse-whatsapp-order', {
              body: {
                conversationText: text,
                customerId: customerId,
                isSimpleOrder: isSimple,
                products: topProducts.map(p => ({
                  code: p.code,
                  name: p.name,
                  name_pap: p.name_pap
                })),
                customerMappings: customerMappings.slice(0, 20).map(m => ({
                  customer_product_name: m.customer_product_name,
                  product_name: products.find(p => p.id === m.product_id)?.name || ''
                })),
                customerPatterns: customerPatterns.slice(0, 10).map(p => ({
                  product_name: p.product_name,
                  avg_quantity: p.avg_quantity
                }))
              }
            }),
            12000,
            'AI parsing timed out'
          );

          // Handle timeout or error - fall back to manual entry
          if (error || data?.timedOut || data?.error) {
            console.warn('AI unavailable:', error?.message || data?.error);
            toast.info('AI unavailable - please enter items manually.', { duration: 4000 });
            parsed = {
              detected_language: 'mixed',
              items: [{ 
                raw_text: text, 
                interpreted_product: 'Enter items manually',
                quantity: 1, 
                unit: 'pcs', 
                confidence: 'low' as const 
              }]
            };
            allMatched = parsed.items.map(item => ({
              ...item,
              matched_product_id: null,
              matched_product_name: null,
              suggested_price: null,
              was_manually_changed: false,
              match_source: 'unmatched' as const,
              confidence: 'low' as const
            }));
          } else {
            parsed = data as ParsedConversation;
            
            // Track discovered context words
            if (parsed.context_words?.length) {
              setDiscoveredWordsCount(parsed.context_words.length);
            }
            
            setParseStage('Matching products...');
            for (const item of parsed.items) {
              allMatched.push(matchItem(item, products, customerMappings, globalAliases, customerPatterns));
            }
          }
        } catch (aiError) {
          // For complete AI failure, show manual entry UI
          console.warn('AI parsing error:', aiError);
          toast.info('AI unavailable - please enter items manually.', { duration: 4000 });
          parsed = {
            detected_language: 'mixed',
            items: [{ 
              raw_text: text, 
              interpreted_product: 'Enter items manually',
              quantity: 1, 
              unit: 'pcs', 
              confidence: 'low' as const 
            }]
          };
          allMatched = parsed.items.map(item => ({
            ...item,
            matched_product_id: null,
            matched_product_name: null,
            suggested_price: null,
            was_manually_changed: false,
            match_source: 'unmatched' as const,
            confidence: 'low' as const
          }));
        }
      }

      setParsedData(parsed);

      // Batch insert AI logs (instead of one-by-one)
      if (allMatched.length > 0 && customerId) {
        setParseStage('Logging...');
        const logEntries = allMatched.map(item => ({
          raw_text: item.raw_text,
          interpreted_text: item.interpreted_product,
          customer_id: customerId,
          matched_product_id: item.matched_product_id,
          match_source: item.match_source,
          confidence: item.confidence,
          detected_language: parsed.detected_language,
          detected_quantity: item.quantity,
          detected_unit: item.unit,
          needs_review: item.confidence === 'low' || item.match_source === 'unmatched',
        }));
        
        try {
          const { data: logData } = await supabase
            .from('fnb_ai_match_logs')
            .insert(logEntries)
            .select('id');
          
          if (logData) {
            logData.forEach((log, i) => {
              if (allMatched[i]) allMatched[i].log_id = log.id;
            });
            logIdsRef.current = logData.map(l => l.id);
          }
        } catch (e) {
          console.error('Failed to batch log AI matches:', e);
        }
      }
      
      setMatchedItems(allMatched);
      setParseStage('');

      // Count how many were learned matches
      const learned = allMatched.filter(m => 
        m.match_source === 'verified' || m.match_source === 'customer_mapping'
      ).length;
      setLearnedCount(learned);

      return parsed;
    } catch (error) {
      console.error('Error parsing conversation:', error);
      const errorMsg = error instanceof Error ? error.message : 'Failed to parse conversation';
      if (!errorMsg.includes('timed out')) {
        toast.error(errorMsg);
      }
      return null;
    } finally {
      setIsParsing(false);
      setParseStage('');
    }
  }, [matchItem, localPreParse, tryLocalMatch]);

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
    setDiscoveredWordsCount(0);
    logIdsRef.current = [];
  }, []);

  return {
    isParsing,
    parseStage,
    parsedData,
    matchedItems,
    originalText,
    learnedCount,
    discoveredWordsCount,
    parseConversation,
    updateMatchedItem,
    removeMatchedItem,
    saveMappings,
    reset
  };
}
