-- Enable realtime for time_entries only (fnb_orders already enabled)
ALTER PUBLICATION supabase_realtime ADD TABLE time_entries;