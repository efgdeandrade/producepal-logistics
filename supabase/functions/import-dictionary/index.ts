import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Map dictionary type codes to system word types
function mapWordType(dictType: string, word: string, meaning: string): string {
  const wordLower = word.toLowerCase();
  const meaningLower = meaning.toLowerCase();
  
  // Order-specific action verbs
  const actionVerbs = ['manda', 'mandá', 'traha', 'trahá', 'kumpra', 'kumprá', 'bende', 'bendé', 
    'paga', 'pagá', 'entrega', 'entregá', 'buska', 'buská', 'tuma', 'tumá', 'dal', 'duna', 
    'ordena', 'ordená', 'pidi', 'pidí', 'hasi', 'hasí', 'bai', 'bin', 'biní'];
  
  // Time reference words
  const timeWords = ['mañan', 'awe', 'ayera', 'djaweps', 'diabierna', 'djasabra', 'djadumingu',
    'djaluna', 'djamars', 'djarason', 'siman', 'luna', 'aña', 'ora', 'anochi', 'marduga',
    'merdia', 'atardi', 'mèrdia', 'mardugá', 'mardugada', 'djamañan', 'pronto', 'aworaki',
    'awor', 'despues', 'promé', 'prome'];
  
  // Unit words
  const unitPatterns = ['kaha', 'saku', 'saco', 'bòter', 'kilo', 'liter', 'dòshi', 'stuk', 'pia',
    'tros', 'manta', 'paki', 'bòmba', 'masta', 'bolo', 'bòlo', 'lata', 'kan', 'fles', 'krat'];
  
  // Check for special order-related types first
  if (actionVerbs.some(v => wordLower.startsWith(v))) return 'action';
  if (timeWords.some(t => wordLower === t || wordLower.startsWith(t))) return 'time_reference';
  if (unitPatterns.some(u => wordLower === u || wordLower.startsWith(u))) return 'unit';
  
  // Check meaning for quantity-related words
  if (meaningLower.includes('box') || meaningLower.includes('case') || meaningLower.includes('bag') ||
      meaningLower.includes('bottle') || meaningLower.includes('piece') || meaningLower.includes('bunch')) {
    return 'unit';
  }
  
  // General type mapping from dictionary codes
  const typeMap: Record<string, string> = {
    'ver': 'verb',
    'sus': 'noun',
    'ath': 'adjective',
    'prep': 'preposition',
    'atv': 'adverb',
    'inh': 'interjection',
    'konj': 'connector',
  };
  
  // Handle combined types like "ver/ath"
  const types = dictType.toLowerCase().split('/');
  for (const t of types) {
    const trimmed = t.trim();
    if (typeMap[trimmed]) {
      return typeMap[trimmed];
    }
  }
  
  return 'phrase';
}

// Parse examples from the dictionary entry
function parseExamples(usage: string, extra: string): string[] {
  const examples: string[] = [];
  
  // Extract Usage: and Example: patterns
  const usageMatch = usage?.match(/Usage:\s*(.+?)(?:;|$)/gi);
  const exampleMatch = usage?.match(/Example:\s*(.+?)(?:;|$)/gi);
  
  if (usageMatch) {
    usageMatch.forEach(m => {
      const text = m.replace(/Usage:\s*/i, '').trim();
      if (text) examples.push(text);
    });
  }
  
  if (exampleMatch) {
    exampleMatch.forEach(m => {
      const text = m.replace(/Example:\s*/i, '').trim();
      if (text) examples.push(text);
    });
  }
  
  // Add extra info if present
  if (extra && extra.trim() && !extra.includes('weta')) {
    examples.push(extra.trim());
  }
  
  return examples.slice(0, 5); // Limit to 5 examples
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { words, markAsVerified = false } = await req.json();
    
    if (!Array.isArray(words) || words.length === 0) {
      return new Response(JSON.stringify({ error: 'No words provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Processing ${words.length} dictionary entries...`);
    
    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;
    
    // Process in batches of 100
    const batchSize = 100;
    for (let i = 0; i < words.length; i += batchSize) {
      const batch = words.slice(i, i + batchSize);
      
      const entries = batch.map((entry: any) => {
        const word = (entry.word || '').toString().toLowerCase().trim();
        const dictType = (entry.type || '').toString().trim();
        const meaning = (entry.meaning || '').toString().trim();
        const usage = (entry.usage || '').toString().trim();
        const extra = (entry.extra || '').toString().trim();
        
        if (!word || !meaning) return null;
        
        return {
          word,
          word_type: mapWordType(dictType, word, meaning),
          meaning: meaning.length > 500 ? meaning.substring(0, 500) : meaning,
          language: 'pap',
          is_verified: markAsVerified,
          usage_count: 0,
          examples: parseExamples(usage, extra),
        };
      }).filter(Boolean);
      
      if (entries.length === 0) continue;
      
      // Upsert entries (update on conflict)
      const { data, error } = await supabase
        .from('distribution_context_words')
        .upsert(entries, {
          onConflict: 'word',
          ignoreDuplicates: false,
        })
        .select('id');
      
      if (error) {
        console.error(`Batch error:`, error);
        errors += entries.length;
      } else {
        inserted += data?.length || 0;
      }
      
      // Log progress every 1000 entries
      if ((i + batchSize) % 1000 === 0 || i + batchSize >= words.length) {
        console.log(`Progress: ${Math.min(i + batchSize, words.length)}/${words.length}`);
      }
    }

    console.log(`Import complete: ${inserted} inserted/updated, ${skipped} skipped, ${errors} errors`);
    
    return new Response(JSON.stringify({
      success: true,
      stats: {
        total: words.length,
        inserted,
        updated,
        skipped,
        errors,
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (error) {
    console.error('Import error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Import failed' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
