import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useState } from 'react';
import { Trash2, RefreshCw, XCircle, CheckSquare, Square } from 'lucide-react';

interface EmailBulkActionsProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onMarkDeclined: () => Promise<void>;
  onReprocess: () => Promise<void>;
  onDelete: () => Promise<void>;
}

export function EmailBulkActions({
  selectedCount,
  totalCount,
  onSelectAll,
  onDeselectAll,
  onMarkDeclined,
  onReprocess,
  onDelete,
}: EmailBulkActionsProps) {
  const [confirmAction, setConfirmAction] = useState<'decline' | 'delete' | null>(null);
  const [processing, setProcessing] = useState(false);

  const handleConfirm = async () => {
    setProcessing(true);
    try {
      if (confirmAction === 'decline') {
        await onMarkDeclined();
      } else if (confirmAction === 'delete') {
        await onDelete();
      }
    } finally {
      setProcessing(false);
      setConfirmAction(null);
    }
  };

  const handleReprocess = async () => {
    setProcessing(true);
    try {
      await onReprocess();
    } finally {
      setProcessing(false);
    }
  };

  if (selectedCount === 0) {
    return null;
  }

  const allSelected = selectedCount === totalCount;

  return (
    <>
      <div className="flex items-center gap-2 p-3 bg-primary/10 rounded-lg">
        <Button
          variant="ghost"
          size="sm"
          onClick={allSelected ? onDeselectAll : onSelectAll}
          className="gap-2"
        >
          {allSelected ? (
            <>
              <Square className="h-4 w-4" />
              Deselect All
            </>
          ) : (
            <>
              <CheckSquare className="h-4 w-4" />
              Select All ({totalCount})
            </>
          )}
        </Button>

        <span className="text-sm text-muted-foreground mx-2">
          {selectedCount} selected
        </span>

        <div className="flex-1" />

        <Button
          variant="outline"
          size="sm"
          onClick={handleReprocess}
          disabled={processing}
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${processing ? 'animate-spin' : ''}`} />
          Reprocess
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setConfirmAction('decline')}
          disabled={processing}
          className="gap-2"
        >
          <XCircle className="h-4 w-4" />
          Mark Declined
        </Button>

        <Button
          variant="destructive"
          size="sm"
          onClick={() => setConfirmAction('delete')}
          disabled={processing}
          className="gap-2"
        >
          <Trash2 className="h-4 w-4" />
          Delete
        </Button>
      </div>

      <AlertDialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction === 'delete' ? 'Delete Emails' : 'Mark as Declined'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction === 'delete'
                ? `Are you sure you want to delete ${selectedCount} email(s)? This action cannot be undone.`
                : `Mark ${selectedCount} email(s) as declined? They will no longer be processed for orders.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={processing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              disabled={processing}
              className={confirmAction === 'delete' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
            >
              {processing ? 'Processing...' : 'Confirm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
