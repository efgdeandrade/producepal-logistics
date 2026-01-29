-- Create market news cache table for storing and caching news intelligence
CREATE TABLE public.market_news_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  headline TEXT NOT NULL,
  summary TEXT,
  source_url TEXT,
  source_name TEXT,
  country_code TEXT, -- 'COL', 'USA', 'NLD', 'CHL', 'PER', 'BRA', 'VEN'
  impact_level TEXT CHECK (impact_level IN ('high', 'medium', 'low')),
  impact_type TEXT CHECK (impact_type IN ('opportunity', 'risk', 'neutral')),
  affected_products TEXT[], -- ['Avocado Hass', 'Lime']
  affected_suppliers UUID[],
  financial_impact_estimate DECIMAL,
  financial_impact_direction TEXT CHECK (financial_impact_direction IN ('gain', 'loss', 'neutral')),
  ai_recommendation TEXT,
  ai_action_items JSONB DEFAULT '[]'::jsonb, -- [{action: "Contact supplier", priority: "immediate"}]
  published_at TIMESTAMPTZ,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '6 hours',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient queries
CREATE INDEX idx_market_news_expires ON public.market_news_cache(expires_at);
CREATE INDEX idx_market_news_impact ON public.market_news_cache(impact_level, impact_type);
CREATE INDEX idx_market_news_country ON public.market_news_cache(country_code);

-- Enable RLS
ALTER TABLE public.market_news_cache ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read news
CREATE POLICY "Authenticated users can read market news"
ON public.market_news_cache FOR SELECT
TO authenticated
USING (true);

-- Service role and authenticated users can insert (edge function uses service role)
CREATE POLICY "Service can manage market news"
ON public.market_news_cache FOR ALL
USING (true);