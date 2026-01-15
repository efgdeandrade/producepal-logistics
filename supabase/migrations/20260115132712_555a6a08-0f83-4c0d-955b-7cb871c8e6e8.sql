-- Enable realtime for distribution_order_items table (tracks picking progress)
ALTER PUBLICATION supabase_realtime ADD TABLE public.distribution_order_items;