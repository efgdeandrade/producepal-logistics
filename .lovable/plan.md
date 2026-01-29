
# Market News Intelligence Widget

## Overview

A real-time news intelligence widget that monitors global produce markets, tracks price fluctuations, supply disruptions, and opportunities across your key supply chain countries. The widget uses AI to analyze news impact on your specific product portfolio and provides actionable recommendations.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    MARKET NEWS INTELLIGENCE WIDGET                          │
├─────────────────────────────────────────────────────────────────────────────┤
│  DATA SOURCES                                                                │
│  • Perplexity Search API (real-time news with AI analysis)                  │
│  • Your product catalog (50+ fruits, vegetables, herbs)                      │
│  • Your supplier countries (Colombia, USA, Holland, etc.)                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  AI ANALYSIS LAYER                                                           │
│  • Lovable AI (Gemini) analyzes news against YOUR specific products          │
│  • Calculates financial impact (potential savings/losses)                    │
│  • Generates actionable recommendations                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│  OUTPUT                                                                      │
│  • 4 prioritized news items with impact scores                              │
│  • AI-generated action recommendations                                       │
│  • Direct links to original sources                                          │
│  • Financial opportunity/risk estimates                                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

## News Categories Tracked

| Category | Search Focus | Business Impact |
|----------|--------------|-----------------|
| **Price Movements** | Wholesale price changes, futures, market reports | Negotiate better deals, time purchases |
| **Supply Disruptions** | Weather events, strikes, export bans, logistics issues | Secure stock early, find alternatives |
| **Crop Conditions** | Harvest forecasts, disease outbreaks, quality issues | Adjust orders, plan substitutes |
| **Trade & Regulations** | Tariffs, phytosanitary rules, export restrictions | Avoid delays, plan compliance |
| **Opportunities** | Bumper harvests, new suppliers, price drops | Capitalize on favorable conditions |

## Countries Monitored

Your supply chain countries with specific focus:
- **Colombia** 🇨🇴 - Avocados, limes, mangoes, papayas, plantains
- **USA** 🇺🇸 - Citrus, grapes, lettuce varieties, berries
- **Holland** 🇳🇱 - Tomatoes, peppers, cucumbers, herbs
- **Chile** 🇨🇱 - Grapes, stone fruits, berries (off-season supply)
- **Peru** 🇵🇪 - Avocados, mangoes, citrus
- **Brazil** 🇧🇷 - Mangoes, papayas, citrus, melons
- **Venezuela** 🇻🇪 - Regional supply monitoring

## Widget Design

### Import Dashboard Version (Compact - 4 news items)
```
┌─────────────────────────────────────────────────────────────┐
│ 📰 Market Intelligence                    [🔄 Refresh]     │
│ Last updated: 2 minutes ago                                 │
├─────────────────────────────────────────────────────────────┤
│ 🔴 HIGH IMPACT                                              │
│ ┌─────────────────────────────────────────────────────────┐│
│ │ 🇨🇴 Colombia avocado prices surge 15% on reduced supply ││
│ │ Affects: Avocado Hass, your key product                  ││
│ │ 💰 Potential impact: +$0.35/kg on next order             ││
│ │                                                          ││
│ │ 🤖 AI Recommendation:                                    ││
│ │ "Contact NAU GROUP SAS now to lock current prices for   ││
│ │ 2-week supply. Consider increasing order by 20% before  ││
│ │ price adjustment hits."                                  ││
│ │                                              [Read More] ││
│ └─────────────────────────────────────────────────────────┘│
│                                                             │
│ 🟡 MEDIUM IMPACT                                            │
│ ┌─────────────────────────────────────────────────────────┐│
│ │ 🇳🇱 Dutch pepper harvest exceeds expectations           ││
│ │ Affects: Red, Orange, Green Paprika                      ││
│ │ 💰 Opportunity: Potential -8% on bulk orders             ││
│ │                                                          ││
│ │ 🤖 AI Recommendation:                                    ││
│ │ "Excellent time to negotiate with Melero Import for     ││
│ │ larger orders. Oversupply expected through Q1."         ││
│ └─────────────────────────────────────────────────────────┘│
│                                                             │
│ + 2 more stories...                          [View All →]  │
└─────────────────────────────────────────────────────────────┘
```

### Executive Dashboard Version (Summary Cards)
```
┌──────────────────────────────────────────────────────────────┐
│ 📰 Market News                                    [🔄]      │
├──────────────────────────────────────────────────────────────┤
│ ┌──────────────────┐  ┌──────────────────┐                   │
│ │ 🔴 1 Alert       │  │ 💚 2 Opps        │                   │
│ │ Supply Risk      │  │ Price Drops      │                   │
│ └──────────────────┘  └──────────────────┘                   │
│                                                              │
│ Top Story: Colombia avocado prices surge 15%                 │
│ 🤖 Lock prices now with NAU GROUP SAS                        │
│                                              [Details →]     │
└──────────────────────────────────────────────────────────────┘
```

## Technical Implementation

### 1. Perplexity Connector for Real-Time News

Connect Perplexity API for intelligent news search:

```typescript
// Search queries tailored to your business
const searchQueries = [
  "Colombia fresh fruit export prices wholesale market news",
  "Holland greenhouse vegetables tomatoes peppers export prices",
  "USA citrus grape wholesale market prices Caribbean",
  "South America avocado mango supply export news",
  "Fresh produce import logistics Caribbean freight shipping"
];
```

### 2. New Edge Function: `market-news-intelligence`

```typescript
// Core intelligence pipeline
1. Fetch latest news via Perplexity (5-10 articles per region)
2. Cross-reference against YOUR product catalog from database
3. Match news to YOUR specific suppliers
4. Calculate financial impact based on your order volumes
5. Generate AI recommendations using Lovable AI (Gemini)
6. Rank by business impact and return top 4
```

### 3. Database Table for Caching & History

```sql
CREATE TABLE market_news_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  headline TEXT NOT NULL,
  summary TEXT,
  source_url TEXT,
  country_code TEXT, -- 'COL', 'USA', 'NLD', etc.
  impact_level TEXT, -- 'high', 'medium', 'low'
  impact_type TEXT, -- 'opportunity', 'risk', 'neutral'
  affected_products TEXT[], -- ['Avocado Hass', 'Lime']
  affected_suppliers UUID[],
  financial_impact_estimate DECIMAL,
  ai_recommendation TEXT,
  ai_action_items JSONB, -- [{action: "Contact supplier", priority: 1}]
  published_at TIMESTAMPTZ,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '6 hours'
);
```

### 4. News Refresh Strategy

| Trigger | Frequency | Reason |
|---------|-----------|--------|
| Scheduled | Every 4 hours | Regular market monitoring |
| Manual | On demand | User refresh button |
| Smart | When dashboard opens | Fresh data on load |
| Alert | Immediate | High-impact news detection |

### 5. AI Analysis Prompt (Gemini)

```
You are a produce import business analyst for FUIK in Curaçao.

Analyze this news article and determine:
1. Which of our products are affected (from catalog)
2. Which suppliers are impacted
3. Is this an OPPORTUNITY (buy more, negotiate) or RISK (supply shortage, price increase)?
4. Estimated financial impact on our business
5. Specific action recommendation with timeline

Our product focus: Fruits, vegetables, herbs (avocados, citrus, peppers, leafy greens, tropical fruits)
Our suppliers: Colombia (NAU GROUP, HORTIFRESCO), Holland (Melero Import), USA sources
Weekly order volume: ~5 pallets, $15,000-20,000 USD
```

## Files to Create/Modify

### New Files:
1. `src/components/import/MarketNewsWidget.tsx` - Main widget component
2. `src/components/executive/MarketNewsSummary.tsx` - Executive dashboard compact version
3. `src/hooks/useMarketNews.ts` - Data fetching hook with caching
4. `supabase/functions/market-news-intelligence/index.ts` - Backend intelligence engine

### Modified Files:
1. `src/pages/ImportDashboard.tsx` - Add widget to dashboard
2. `src/pages/ExecutiveDashboard.tsx` - Add summary widget
3. `supabase/config.toml` - Add new edge function

## News Item Data Structure

```typescript
interface MarketNewsItem {
  id: string;
  headline: string;
  summary: string;
  sourceUrl: string;
  sourceName: string;
  publishedAt: Date;
  
  // Impact analysis
  impactLevel: 'high' | 'medium' | 'low';
  impactType: 'opportunity' | 'risk' | 'neutral';
  
  // Your business relevance
  affectedProducts: Array<{
    name: string;
    code: string;
    matchConfidence: number;
  }>;
  affectedSuppliers: Array<{
    id: string;
    name: string;
  }>;
  affectedCountries: string[]; // ['COL', 'USA']
  
  // Financial estimation
  financialImpact: {
    direction: 'gain' | 'loss' | 'neutral';
    estimatedAmountUSD: number;
    confidence: 'high' | 'medium' | 'low';
    reasoning: string;
  };
  
  // AI recommendation
  recommendation: {
    summary: string;
    actions: Array<{
      action: string;
      priority: 'immediate' | 'this_week' | 'monitor';
      contact?: string; // Supplier name to contact
    }>;
    timeframe: string; // "Act within 48 hours"
  };
}
```

## Perplexity Connector Setup

The Perplexity connector will be connected to enable real-time news search:
- API provides grounded search with citations
- Returns current news articles with source URLs
- Supports filtering by date and domain

## Implementation Order

1. **Connect Perplexity** - Enable the connector for news search capability
2. **Database migration** - Create `market_news_cache` table
3. **Edge function** - Build `market-news-intelligence` with Perplexity + Lovable AI
4. **Hook** - Create `useMarketNews` for frontend data management
5. **Import widget** - Full 4-story widget with AI recommendations
6. **Executive widget** - Compact summary for executive dashboard
7. **Integration** - Add widgets to both dashboards

## Expected Outcomes

| Metric | Value |
|--------|-------|
| News freshness | Updated every 4 hours |
| Relevance | Filtered to YOUR products and suppliers |
| Actionability | Each story has specific recommendations |
| Financial visibility | Estimated impact in USD/XCG |
| Coverage | 7 key supply countries monitored |

## Cost Considerations

- **Perplexity API**: ~$0.005 per search, ~20 searches per refresh = ~$0.10/refresh
- **Lovable AI (Gemini)**: Included in your plan for analysis
- **Total estimated**: ~$0.50-1.00 per day for comprehensive monitoring
