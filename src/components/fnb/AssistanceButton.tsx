import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { HelpCircle, Send } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AssistanceButtonProps {
  pickerQueueId: string;
  pickerName: string;
  orderNumber: string;
  disabled?: boolean;
}

const ASSISTANCE_REASONS = [
  { value: 'product_location', label: 'Can\'t find product' },
  { value: 'weight_discrepancy', label: 'Weight doesn\'t match' },
  { value: 'quality_check', label: 'Need quality check' },
  { value: 'customer_question', label: 'Customer special request' },
  { value: 'equipment_issue', label: 'Equipment problem' },
  { value: 'other', label: 'Other issue' },
];

export function AssistanceButton({ 
  pickerQueueId, 
  pickerName, 
  orderNumber,
  disabled = false 
}: AssistanceButtonProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('distribution_assistance_queue')
        .insert({
          picker_queue_id: pickerQueueId,
          picker_name: pickerName,
          reason: ASSISTANCE_REASONS.find(r => r.value === reason)?.label || reason,
          notes: notes || null,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fnb-assistance-requests'] });
      toast.success('Help request sent! Supervisor will be notified.');
      setOpen(false);
      setReason('');
      setNotes('');
    },
    onError: () => {
      toast.error('Failed to send request');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason) {
      toast.error('Please select a reason');
      return;
    }
    mutation.mutate();
  };

  return (
    <>
      <Button
        variant="outline"
        className="w-full h-12 text-orange-600 border-orange-400 hover:bg-orange-50 dark:text-orange-400 dark:hover:bg-orange-950"
        onClick={() => setOpen(true)}
        disabled={disabled}
      >
        <HelpCircle className="mr-2 h-5 w-5" />
        Need Assistance
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-orange-500" />
              Request Assistance
            </DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="p-3 bg-muted rounded-lg text-sm">
              <p><span className="font-medium">Picker:</span> {pickerName}</p>
              <p><span className="font-medium">Order:</span> {orderNumber}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">What do you need help with?</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a reason..." />
                </SelectTrigger>
                <SelectContent>
                  {ASSISTANCE_REASONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Additional details (optional)</Label>
              <Input
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Describe the issue..."
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!reason || mutation.isPending}
                className="bg-orange-500 hover:bg-orange-600"
              >
                <Send className="mr-2 h-4 w-4" />
                Send Request
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}