-- Create driver_wallets table to track running COD balance per driver
CREATE TABLE public.driver_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  current_balance NUMERIC NOT NULL DEFAULT 0,
  total_collected NUMERIC NOT NULL DEFAULT 0,
  total_deposited NUMERIC NOT NULL DEFAULT 0,
  last_collection_at TIMESTAMPTZ,
  last_deposit_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT driver_wallets_driver_id_unique UNIQUE (driver_id)
);

-- Create driver_wallet_transactions table for full audit trail
CREATE TABLE public.driver_wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES public.driver_wallets(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('collection', 'deposit', 'adjustment')),
  amount NUMERIC NOT NULL,
  balance_before NUMERIC NOT NULL,
  balance_after NUMERIC NOT NULL,
  order_id UUID REFERENCES public.fnb_orders(id) ON DELETE SET NULL,
  payment_method TEXT,
  deposit_reference TEXT,
  notes TEXT,
  processed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on both tables
ALTER TABLE public.driver_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_wallet_transactions ENABLE ROW LEVEL SECURITY;

-- RLS policies for driver_wallets
-- Drivers can view their own wallet
CREATE POLICY "Drivers can view own wallet"
ON public.driver_wallets
FOR SELECT
USING (auth.uid() = driver_id);

-- Management can view all wallets
CREATE POLICY "Management can view all wallets"
ON public.driver_wallets
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'management'::app_role));

-- Management can manage all wallets
CREATE POLICY "Management can manage wallets"
ON public.driver_wallets
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'management'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'management'::app_role));

-- Drivers can update their own wallet (for collections)
CREATE POLICY "Drivers can update own wallet"
ON public.driver_wallets
FOR UPDATE
USING (auth.uid() = driver_id)
WITH CHECK (auth.uid() = driver_id);

-- Drivers can insert their own wallet
CREATE POLICY "Drivers can create own wallet"
ON public.driver_wallets
FOR INSERT
WITH CHECK (auth.uid() = driver_id);

-- RLS policies for driver_wallet_transactions
-- Drivers can view their own transactions
CREATE POLICY "Drivers can view own transactions"
ON public.driver_wallet_transactions
FOR SELECT
USING (auth.uid() = driver_id);

-- Management can view all transactions
CREATE POLICY "Management can view all transactions"
ON public.driver_wallet_transactions
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'management'::app_role));

-- Management can insert transactions (for deposits/adjustments)
CREATE POLICY "Management can insert transactions"
ON public.driver_wallet_transactions
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'management'::app_role));

-- Drivers can insert their own collection transactions
CREATE POLICY "Drivers can insert own collection transactions"
ON public.driver_wallet_transactions
FOR INSERT
WITH CHECK (auth.uid() = driver_id AND transaction_type = 'collection');

-- Create indexes for performance
CREATE INDEX idx_driver_wallets_driver_id ON public.driver_wallets(driver_id);
CREATE INDEX idx_driver_wallet_transactions_wallet_id ON public.driver_wallet_transactions(wallet_id);
CREATE INDEX idx_driver_wallet_transactions_driver_id ON public.driver_wallet_transactions(driver_id);
CREATE INDEX idx_driver_wallet_transactions_created_at ON public.driver_wallet_transactions(created_at DESC);
CREATE INDEX idx_driver_wallet_transactions_order_id ON public.driver_wallet_transactions(order_id);

-- Add trigger to update updated_at on driver_wallets
CREATE TRIGGER update_driver_wallets_updated_at
  BEFORE UPDATE ON public.driver_wallets
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();