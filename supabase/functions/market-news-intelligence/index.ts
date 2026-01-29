import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// News sources to scrape (HTML pages with news)
const NEWS_SOURCES = [
  { url: 'https://www.fruitnet.com/eurofruit', name: 'Fruitnet Eurofruit', region: 'global' },
  { url: 'https://www.fruitnet.com/asiafruit', name: 'Fruitnet Asiafruit', region: 'asia' },
  { url: 'https://www.fruitnet.com', name: 'Fruitnet Global', region: 'global' },
];

// Countries we monitor with their products
const COUNTRY_FOCUS = {
  COL: { name: 'Colombia', flag: '🇨🇴', products: ['avocado', 'lime', 'mango', 'papaya', 'plantain', 'passion fruit'] },
  USA: { name: 'United States', flag: '🇺🇸', products: ['citrus', 'grape', 'lettuce', 'berry', 'apple', 'orange'] },
  NLD: { name: 'Holland', flag: '🇳🇱', products: ['tomato', 'pepper', 'cucumber', 'herb', 'paprika'] },
  CHL: { name: 'Chile', flag: '🇨🇱', products: ['grape', 'cherry', 'plum', 'berry', 'kiwi'] },
  PER: { name: 'Peru', flag: '🇵🇪', products: ['avocado', 'mango', 'citrus', 'asparagus'] },
  BRA: { name: 'Brazil', flag: '🇧🇷', products: ['mango', 'papaya', 'citrus', 'melon', 'banana'] },
  VEN: { name: 'Venezuela', flag: '🇻🇪', products: ['produce', 'fruit', 'vegetable'] },
};

// Keywords that indicate market-moving news
const IMPACT_KEYWORDS = {
  high: ['surge', 'shortage', 'crisis', 'ban', 'strike', 'disaster', 'freeze', 'drought', 'flood', 'recall', 'halt', 'emergency'],
  medium: ['increase', 'decrease', 'rise', 'fall', 'harvest', 'season', 'export', 'import', 'price', 'demand', 'supply'],
  opportunity: ['surplus', 'bumper', 'record', 'excellent', 'opportunity', 'oversupply', 'discount', 'deal'],
  risk: ['shortage', 'disease', 'pest', 'weather', 'delay', 'tariff', 'restriction', 'inflation', 'cost'],
};

interface NewsItem {
  headline: string;
  summary: string;
  source_url: string;
  source_name: string;
  country_code: string | null;
  published_at: string | null;
}

interface AnalyzedNews {
  headline: string;
  summary: string;
  source_url: string;
  source_name: string;
  country_code: string | null;
  impact_level: 'high' | 'medium' | 'low';
  impact_type: 'opportunity' | 'risk' | 'neutral';
  affected_products: string[];
  financial_impact_estimate: number | null;
  financial_impact_direction: 'gain' | 'loss' | 'neutral';
  ai_recommendation: string;
  ai_action_items: Array<{ action: string; priority: string; contact?: string }>;
  published_at: string | null;
}

// Scrape news from HTML pages
async function scrapeNewsPage(pageUrl: string, sourceName: string): Promise<NewsItem[]> {
  try {
    console.log(`Scraping news from: ${pageUrl}`);
    const response = await fetch(pageUrl, {
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      }
    });
    
    if (!response.ok) {
      console.log(`Failed to fetch ${pageUrl}: ${response.status}`);
      return [];
    }
    
    const html = await response.text();
    const items: NewsItem[] = [];
    
    // Parse article links and titles from HTML
    // Look for common patterns: <h2><a href="...">Title</a></h2> or similar
    const articlePatterns = [
      // Pattern for Fruitnet: article links with headlines
      /<a[^>]+href=["']([^"']+\.article)["'][^>]*>([^<]+)<\/a>/gi,
      // Pattern for news headlines in h2/h3 tags
      /<h[23][^>]*>\s*<a[^>]+href=["']([^"']+)["'][^>]*>([^<]+)<\/a>\s*<\/h[23]>/gi,
    ];
    
    for (const pattern of articlePatterns) {
      let match;
      while ((match = pattern.exec(html)) !== null && items.length < 15) {
        const url = match[1];
        const title = match[2].replace(/&#\d+;/g, '').replace(/&amp;/g, '&').trim();
        
        // Skip navigation links, author links, and duplicates
        if (title.length > 15 && 
            !url.includes('.bio') && 
            !url.includes('subscribe') &&
            !items.some(i => i.headline === title)) {
          
          // Make URL absolute if relative
          const fullUrl = url.startsWith('http') ? url : `https://www.fruitnet.com${url}`;
          
          items.push({
            headline: title,
            summary: '', // Will be filled by AI
            source_url: fullUrl,
            source_name: sourceName,
            country_code: null,
            published_at: new Date().toISOString(),
          });
        }
      }
    }
    
    console.log(`Scraped ${items.length} articles from ${pageUrl}`);
    return items;
  } catch (error) {
    console.error(`Error scraping ${pageUrl}:`, error);
    return [];
  }
}

// Detect which country the news is about
function detectCountry(text: string): string | null {
  const lowerText = text.toLowerCase();
  
  const countryPatterns: Record<string, string[]> = {
    COL: ['colombia', 'colombian', 'bogota', 'medellin'],
    USA: ['united states', 'usa', 'u.s.', 'american', 'california', 'florida', 'texas'],
    NLD: ['netherlands', 'dutch', 'holland', 'amsterdam', 'rotterdam'],
    CHL: ['chile', 'chilean', 'santiago'],
    PER: ['peru', 'peruvian', 'lima'],
    BRA: ['brazil', 'brazilian', 'sao paulo'],
    VEN: ['venezuela', 'venezuelan', 'caracas'],
  };
  
  for (const [code, patterns] of Object.entries(countryPatterns)) {
    if (patterns.some(p => lowerText.includes(p))) {
      return code;
    }
  }
  
  return null;
}

// Detect impact level and type from text
function analyzeImpact(text: string): { level: 'high' | 'medium' | 'low'; type: 'opportunity' | 'risk' | 'neutral' } {
  const lowerText = text.toLowerCase();
  
  // Check for high impact keywords
  const hasHighImpact = IMPACT_KEYWORDS.high.some(k => lowerText.includes(k));
  const hasOpportunity = IMPACT_KEYWORDS.opportunity.some(k => lowerText.includes(k));
  const hasRisk = IMPACT_KEYWORDS.risk.some(k => lowerText.includes(k));
  const hasMediumImpact = IMPACT_KEYWORDS.medium.some(k => lowerText.includes(k));
  
  let level: 'high' | 'medium' | 'low' = 'low';
  let type: 'opportunity' | 'risk' | 'neutral' = 'neutral';
  
  if (hasHighImpact) level = 'high';
  else if (hasMediumImpact) level = 'medium';
  
  if (hasOpportunity && !hasRisk) type = 'opportunity';
  else if (hasRisk) type = 'risk';
  
  return { level, type };
}

// Match products mentioned in the news
function matchProducts(text: string, productCatalog: string[]): string[] {
  const lowerText = text.toLowerCase();
  const matched: string[] = [];
  
  // Also check country-specific products
  for (const country of Object.values(COUNTRY_FOCUS)) {
    for (const product of country.products) {
      if (lowerText.includes(product) && !matched.includes(product)) {
        matched.push(product);
      }
    }
  }
  
  // Check against actual product catalog
  for (const product of productCatalog) {
    const productLower = product.toLowerCase();
    const keywords = productLower.split(/[\s-]+/);
    if (keywords.some(k => k.length > 3 && lowerText.includes(k))) {
      if (!matched.includes(product)) {
        matched.push(product);
      }
    }
  }
  
  return matched.slice(0, 5); // Limit to 5 products
}

// Use Lovable AI to analyze news and generate recommendations
async function analyzeWithAI(
  newsItems: NewsItem[],
  productCatalog: string[],
  suppliers: Array<{ id: string; name: string; country: string }>,
  apiKey: string
): Promise<AnalyzedNews[]> {
  console.log(`Analyzing ${newsItems.length} news items with AI`);
  
  // Pre-filter relevant news
  const relevantNews = newsItems.filter(item => {
    const text = `${item.headline} ${item.summary}`.toLowerCase();
    const hasCountry = detectCountry(text) !== null;
    const hasProduct = Object.values(COUNTRY_FOCUS).some(c => 
      c.products.some(p => text.includes(p))
    );
    return hasCountry || hasProduct;
  });
  
  if (relevantNews.length === 0) {
    console.log('No relevant news found after filtering');
    return [];
  }
  
  const suppliersByCountry = suppliers.reduce((acc, s) => {
    if (!acc[s.country]) acc[s.country] = [];
    acc[s.country].push(s.name);
    return acc;
  }, {} as Record<string, string[]>);
  
  const systemPrompt = `You are a produce import business analyst for FUIK, a fresh produce importer in Curaçao.

Your task is to analyze market news and provide actionable intelligence for our business.

Our product focus: Fresh fruits, vegetables, herbs - especially avocados, citrus, peppers, leafy greens, tropical fruits.
Our supply countries: Colombia, USA, Holland (Netherlands), Chile, Peru, Brazil, Venezuela.
Our suppliers by country: ${JSON.stringify(suppliersByCountry)}
Weekly order volume: ~5 pallets, $15,000-20,000 USD

For each news item, provide:
1. Business relevance assessment (is this actionable for us?)
2. Financial impact estimate (potential $ gain or loss based on our volume)
3. Specific action recommendation with timeline
4. Priority level for action`;

  const newsForAnalysis = relevantNews.slice(0, 8).map((item, i) => ({
    id: i + 1,
    headline: item.headline,
    summary: item.summary,
    detected_country: detectCountry(`${item.headline} ${item.summary}`),
    detected_products: matchProducts(`${item.headline} ${item.summary}`, productCatalog),
  }));

  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { 
            role: 'user', 
            content: `Analyze these market news items and provide recommendations:\n\n${JSON.stringify(newsForAnalysis, null, 2)}`
          }
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'provide_news_analysis',
            description: 'Provide structured analysis for market news items',
            parameters: {
              type: 'object',
              properties: {
                analyzed_items: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      news_id: { type: 'number', description: 'ID of the news item being analyzed' },
                      is_relevant: { type: 'boolean', description: 'Is this news actionable for our business?' },
                      impact_level: { type: 'string', enum: ['high', 'medium', 'low'] },
                      impact_type: { type: 'string', enum: ['opportunity', 'risk', 'neutral'] },
                      affected_products: { type: 'array', items: { type: 'string' } },
                      financial_impact_usd: { type: 'number', description: 'Estimated $ impact on our business' },
                      financial_direction: { type: 'string', enum: ['gain', 'loss', 'neutral'] },
                      recommendation: { type: 'string', description: 'Specific action recommendation' },
                      actions: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            action: { type: 'string' },
                            priority: { type: 'string', enum: ['immediate', 'this_week', 'monitor'] },
                            contact: { type: 'string', description: 'Supplier name to contact if applicable' }
                          },
                          required: ['action', 'priority']
                        }
                      }
                    },
                    required: ['news_id', 'is_relevant', 'impact_level', 'impact_type', 'recommendation']
                  }
                }
              },
              required: ['analyzed_items']
            }
          }
        }],
        tool_choice: { type: 'function', function: { name: 'provide_news_analysis' } }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API error:', response.status, errorText);
      // Fall back to rule-based analysis
      return relevantNews.slice(0, 4).map(item => {
        const text = `${item.headline} ${item.summary}`;
        const impact = analyzeImpact(text);
        const countryCode = detectCountry(text);
        const products = matchProducts(text, productCatalog);
        
        return {
          ...item,
          country_code: countryCode,
          impact_level: impact.level,
          impact_type: impact.type,
          affected_products: products,
          financial_impact_estimate: null,
          financial_impact_direction: 'neutral' as const,
          ai_recommendation: 'Monitor this development and assess impact on upcoming orders.',
          ai_action_items: [{ action: 'Review and assess', priority: 'this_week' }],
        };
      });
    }

    const aiResponse = await response.json();
    console.log('AI analysis received');
    
    const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      console.log('No tool call in AI response');
      return [];
    }
    
    const analysis = JSON.parse(toolCall.function.arguments);
    const analyzedItems = analysis.analyzed_items || [];
    
    // Map AI analysis back to news items
    const results: AnalyzedNews[] = [];
    for (const analyzed of analyzedItems) {
      if (!analyzed.is_relevant) continue;
      
      const originalItem = relevantNews[analyzed.news_id - 1];
      if (!originalItem) continue;
      
      results.push({
        headline: originalItem.headline,
        summary: originalItem.summary,
        source_url: originalItem.source_url,
        source_name: originalItem.source_name,
        country_code: detectCountry(`${originalItem.headline} ${originalItem.summary}`),
        impact_level: analyzed.impact_level || 'medium',
        impact_type: analyzed.impact_type || 'neutral',
        affected_products: analyzed.affected_products || [],
        financial_impact_estimate: analyzed.financial_impact_usd || null,
        financial_impact_direction: analyzed.financial_direction || 'neutral',
        ai_recommendation: analyzed.recommendation || 'Monitor this development.',
        ai_action_items: analyzed.actions || [{ action: 'Review', priority: 'this_week' }],
        published_at: originalItem.published_at,
      });
    }
    
    // Sort by impact level (high first)
    results.sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 };
      return order[a.impact_level] - order[b.impact_level];
    });
    
    return results.slice(0, 4); // Return top 4
    
  } catch (error) {
    console.error('AI analysis error:', error);
    return [];
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }
    
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing Supabase configuration');
    }
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Check for cached news that hasn't expired
    const { data: cachedNews } = await supabase
      .from('market_news_cache')
      .select('*')
      .gt('expires_at', new Date().toISOString())
      .order('impact_level', { ascending: true })
      .order('created_at', { ascending: false })
      .limit(4);
    
    const body = await req.json().catch(() => ({}));
    const forceRefresh = body.forceRefresh === true;
    
    if (cachedNews && cachedNews.length > 0 && !forceRefresh) {
      console.log('Returning cached news');
      return new Response(JSON.stringify({
        success: true,
        news: cachedNews,
        source: 'cache',
        cached_at: cachedNews[0]?.fetched_at,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    console.log('Fetching fresh news...');
    
    // Fetch product catalog
    const { data: products } = await supabase
      .from('products')
      .select('name, code')
      .limit(100);
    
    const productCatalog = products?.map(p => p.name) || [];
    
    // Fetch suppliers
    const { data: suppliers } = await supabase
      .from('suppliers')
      .select('id, name, country')
      .limit(50);
    
    // Scrape news from web pages
    const allNews: NewsItem[] = [];
    for (const source of NEWS_SOURCES) {
      const items = await scrapeNewsPage(source.url, source.name);
      allNews.push(...items);
    }
    
    console.log(`Total news items fetched: ${allNews.length}`);
    
    if (allNews.length === 0) {
      // Return empty but successful response
      return new Response(JSON.stringify({
        success: true,
        news: [],
        source: 'fresh',
        message: 'No news available from feeds',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // Analyze with AI
    const analyzedNews = await analyzeWithAI(
      allNews,
      productCatalog,
      suppliers || [],
      LOVABLE_API_KEY
    );
    
    console.log(`Analyzed news items: ${analyzedNews.length}`);
    
    if (analyzedNews.length > 0) {
      // Clear old cache and insert new
      await supabase
        .from('market_news_cache')
        .delete()
        .lt('expires_at', new Date().toISOString());
      
      const newsToInsert = analyzedNews.map(news => ({
        headline: news.headline,
        summary: news.summary,
        source_url: news.source_url,
        source_name: news.source_name,
        country_code: news.country_code,
        impact_level: news.impact_level,
        impact_type: news.impact_type,
        affected_products: news.affected_products,
        financial_impact_estimate: news.financial_impact_estimate,
        financial_impact_direction: news.financial_impact_direction,
        ai_recommendation: news.ai_recommendation,
        ai_action_items: news.ai_action_items,
        published_at: news.published_at,
        fetched_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(), // 6 hours
      }));
      
      const { error: insertError } = await supabase
        .from('market_news_cache')
        .insert(newsToInsert);
      
      if (insertError) {
        console.error('Error caching news:', insertError);
      }
    }
    
    return new Response(JSON.stringify({
      success: true,
      news: analyzedNews,
      source: 'fresh',
      fetched_at: new Date().toISOString(),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (error) {
    console.error('Market news intelligence error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
