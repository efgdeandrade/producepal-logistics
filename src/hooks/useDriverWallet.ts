import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface DriverWallet {
  id: string;
  driver_id: string;
  current_balance: number;
  total_collected: number;
  total_deposited: number;
  last_collection_at: string | null;
  last_deposit_at: string | null;
  created_at: string;
  updated_at: string;
}

interface WalletTransaction {
  id: string;
  wallet_id: string;
  driver_id: string;
  transaction_type: "collection" | "deposit" | "adjustment";
  amount: number;
  balance_before: number;
  balance_after: number;
  order_id: string | null;
  payment_method: string | null;
  deposit_reference: string | null;
  notes: string | null;
  processed_by: string | null;
  created_at: string;
}

// Hook for driver to view their own wallet
export function useDriverWallet() {
  const { user } = useAuth();

  const { data: wallet, isLoading } = useQuery({
    queryKey: ["driver-wallet", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("driver_wallets")
        .select("*")
        .eq("driver_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data as DriverWallet | null;
    },
    enabled: !!user?.id,
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ["driver-wallet-transactions", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("driver_wallet_transactions")
        .select("*")
        .eq("driver_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data as WalletTransaction[];
    },
    enabled: !!user?.id,
  });

  return { wallet, transactions, isLoading };
}

// Hook for management to view all wallets
export function useAllDriverWallets() {
  const { data: wallets = [], isLoading, refetch } = useQuery({
    queryKey: ["all-driver-wallets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("driver_wallets")
        .select(`
          *,
          profiles:driver_id (full_name, email)
        `)
        .order("current_balance", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return { wallets, isLoading, refetch };
}

// Hook for recording COD collection (called when driver marks delivery complete)
export function useRecordCODCollection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      driverId,
      orderId,
      amount,
      paymentMethod,
    }: {
      driverId: string;
      orderId: string;
      amount: number;
      paymentMethod: string;
    }) => {
      // Get or create wallet
      let { data: wallet, error: walletError } = await supabase
        .from("driver_wallets")
        .select("*")
        .eq("driver_id", driverId)
        .maybeSingle();

      if (walletError) throw walletError;

      if (!wallet) {
        // Create wallet for driver
        const { data: newWallet, error: createError } = await supabase
          .from("driver_wallets")
          .insert({
            driver_id: driverId,
            current_balance: 0,
            total_collected: 0,
            total_deposited: 0,
          })
          .select()
          .single();
        if (createError) throw createError;
        wallet = newWallet;
      }

      const balanceBefore = wallet.current_balance || 0;
      const balanceAfter = balanceBefore + amount;

      // Update wallet balance
      const { error: updateError } = await supabase
        .from("driver_wallets")
        .update({
          current_balance: balanceAfter,
          total_collected: (wallet.total_collected || 0) + amount,
          last_collection_at: new Date().toISOString(),
        })
        .eq("id", wallet.id);

      if (updateError) throw updateError;

      // Record transaction
      const { error: txError } = await supabase
        .from("driver_wallet_transactions")
        .insert({
          wallet_id: wallet.id,
          driver_id: driverId,
          transaction_type: "collection",
          amount: amount,
          balance_before: balanceBefore,
          balance_after: balanceAfter,
          order_id: orderId,
          payment_method: paymentMethod,
        });

      if (txError) throw txError;

      return { balanceAfter };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["driver-wallet"] });
      queryClient.invalidateQueries({ queryKey: ["all-driver-wallets"] });
      queryClient.invalidateQueries({ queryKey: ["driver-wallet-transactions"] });
    },
  });
}

// Hook for management to record deposit
export function useRecordDeposit() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      driverId,
      walletId,
      amount,
      depositReference,
      notes,
    }: {
      driverId: string;
      walletId: string;
      amount: number;
      depositReference?: string;
      notes?: string;
    }) => {
      // Get current wallet balance
      const { data: wallet, error: walletError } = await supabase
        .from("driver_wallets")
        .select("*")
        .eq("id", walletId)
        .single();

      if (walletError) throw walletError;

      const balanceBefore = wallet.current_balance || 0;
      const balanceAfter = balanceBefore - amount;

      // Update wallet balance
      const { error: updateError } = await supabase
        .from("driver_wallets")
        .update({
          current_balance: balanceAfter,
          total_deposited: (wallet.total_deposited || 0) + amount,
          last_deposit_at: new Date().toISOString(),
        })
        .eq("id", walletId);

      if (updateError) throw updateError;

      // Record transaction
      const { error: txError } = await supabase
        .from("driver_wallet_transactions")
        .insert({
          wallet_id: walletId,
          driver_id: driverId,
          transaction_type: "deposit",
          amount: -amount, // Negative for deposit (reduces balance)
          balance_before: balanceBefore,
          balance_after: balanceAfter,
          deposit_reference: depositReference,
          notes: notes,
          processed_by: user?.id,
        });

      if (txError) throw txError;

      return { balanceAfter };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["driver-wallet"] });
      queryClient.invalidateQueries({ queryKey: ["all-driver-wallets"] });
      queryClient.invalidateQueries({ queryKey: ["driver-wallet-transactions"] });
    },
  });
}

// Hook for getting wallet transactions by driver
export function useWalletTransactions(driverId: string | null) {
  return useQuery({
    queryKey: ["wallet-transactions", driverId],
    queryFn: async () => {
      if (!driverId) return [];
      const { data, error } = await supabase
        .from("driver_wallet_transactions")
        .select(`
          *,
          fnb_orders:order_id (order_number, fnb_customers (name))
        `)
        .eq("driver_id", driverId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: !!driverId,
  });
}
