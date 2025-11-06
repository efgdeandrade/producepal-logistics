-- Create market_price_snapshots table for tracking market price intelligence
CREATE TABLE public.market_price_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_code TEXT NOT NULL,
  product_name TEXT,
  market_avg NUMERIC,
  market_low NUMERIC,
  market_high NUMERIC,
  source TEXT,
  snapshot_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.market_price_snapshots ENABLE ROW LEVEL SECURITY;

-- Create policies for market_price_snapshots
CREATE POLICY "Users can view market price snapshots"
ON public.market_price_snapshots
FOR SELECT
USING (true);

CREATE POLICY "Users can insert market price snapshots"
ON public.market_price_snapshots
FOR INSERT
WITH CHECK (true);

-- Create index for faster lookups
CREATE INDEX idx_market_price_snapshots_product_code ON public.market_price_snapshots(product_code);
CREATE INDEX idx_market_price_snapshots_date ON public.market_price_snapshots(snapshot_date DESC);