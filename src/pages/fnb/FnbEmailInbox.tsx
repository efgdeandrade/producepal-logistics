import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Mail,
  Search,
  RefreshCw,
  ChevronRight,
  Paperclip,
  User,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  ArrowLeft,
  Bell,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { EmailDetailDialog } from '@/components/fnb/EmailDetailDialog';
import { EmailBulkActions } from '@/components/fnb/EmailBulkActions';
import { useEmailInboxRealtime } from '@/hooks/useEmailInboxRealtime';

type EmailStatus = 'new' | 'processing' | 'pending_review' | 'confirmed' | 'declined' | 'error';

interface EmailInboxItem {
  id: string;
  message_id: string;
  thread_id: string | null;
  from_email: string;
  from_name: string | null;
  to_email: string | null;
  subject: string;
  body_text: string | null;
  body_html: string | null;
  received_at: string;
  status: EmailStatus;
  matched_customer_id: string | null;
  linked_order_id: string | null;
  extracted_data: any;
  extraction_confidence: number | null;
  error_message: string | null;
  confirmed_at: string | null;
  declined_at: string | null;
  confirmation_email_sent: boolean | null;
  created_at: string;
  matched_customer?: {
    id: string;
    name: string;
  } | null;
  linked_order?: {
    id: string;
    order_number: string;
  } | null;
}

const statusConfig: Record<EmailStatus, { label: string; color: string; icon: any }> = {
  new: { label: 'New', color: 'bg-blue-500', icon: Mail },
  processing: { label: 'Processing', color: 'bg-yellow-500', icon: Loader2 },
  pending_review: { label: 'Review', color: 'bg-orange-500', icon: AlertCircle },
  confirmed: { label: 'Confirmed', color: 'bg-green-500', icon: CheckCircle },
  declined: { label: 'Declined', color: 'bg-gray-500', icon: XCircle },
  error: { label: 'Error', color: 'bg-red-500', icon: AlertCircle },
};

export default function FnbEmailInbox() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedEmail, setSelectedEmail] = useState<EmailInboxItem | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const queryClient = useQueryClient();

  // Use realtime hook
  useEmailInboxRealtime({
    onNewEmail: (newEmail) => {
      // Show toast for new emails
      toast.info(`New email from ${newEmail.from_name || newEmail.from_email}`, {
        description: newEmail.subject,
        icon: <Bell className="h-4 w-4" />,
      });
      // Refetch emails
      queryClient.invalidateQueries({ queryKey: ['email-inbox'] });
      queryClient.invalidateQueries({ queryKey: ['email-inbox-counts'] });
    },
  });

  const { data: emails = [], isLoading, refetch } = useQuery({
    queryKey: ['email-inbox', statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('email_inbox')
        .select(`
          *,
          matched_customer:distribution_customers(id, name),
          linked_order:distribution_orders!email_inbox_linked_order_id_fkey(id, order_number)
        `)
        .order('received_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as EmailInboxItem[];
    },
  });

  const { data: statusCounts } = useQuery({
    queryKey: ['email-inbox-counts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_inbox')
        .select('status');
      
      if (error) throw error;
      
      const counts: Record<string, number> = { all: data.length };
      data.forEach((item: any) => {
        counts[item.status] = (counts[item.status] || 0) + 1;
      });
      return counts;
    },
  });

  const filteredEmails = emails.filter(email => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      email.from_email.toLowerCase().includes(searchLower) ||
      (email.from_name?.toLowerCase() || '').includes(searchLower) ||
      email.subject.toLowerCase().includes(searchLower) ||
      (email.body_text?.toLowerCase() || '').includes(searchLower)
    );
  });

  const handleEmailClick = (email: EmailInboxItem) => {
    setSelectedEmail(email);
  };

  const handleDialogClose = () => {
    setSelectedEmail(null);
    queryClient.invalidateQueries({ queryKey: ['email-inbox'] });
    queryClient.invalidateQueries({ queryKey: ['email-inbox-counts'] });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(filteredEmails.map(e => e.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds(prev => [...prev, id]);
    } else {
      setSelectedIds(prev => prev.filter(i => i !== id));
    }
  };

  const handleBulkActionComplete = () => {
    setSelectedIds([]);
    queryClient.invalidateQueries({ queryKey: ['email-inbox'] });
    queryClient.invalidateQueries({ queryKey: ['email-inbox-counts'] });
  };

  const handleRefresh = () => {
    refetch();
    queryClient.invalidateQueries({ queryKey: ['email-inbox-counts'] });
  };

  return (
    <div className="container mx-auto py-6 space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/distribution">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              Email Inbox
            </h1>
            <p className="text-muted-foreground">Incoming order emails from customers</p>
          </div>
        </div>
        <Button onClick={handleRefresh} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search emails..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        
        {selectedIds.length > 0 && (
          <EmailBulkActions
            selectedCount={selectedIds.length}
            totalCount={filteredEmails.length}
            onSelectAll={() => setSelectedIds(filteredEmails.map(e => e.id))}
            onDeselectAll={() => setSelectedIds([])}
            onMarkDeclined={async () => {
              await supabase
                .from('email_inbox')
                .update({ status: 'declined', declined_at: new Date().toISOString() })
                .in('id', selectedIds);
              handleBulkActionComplete();
              toast.success(`${selectedIds.length} emails marked as declined`);
            }}
            onReprocess={async () => {
              for (const id of selectedIds) {
                await supabase.functions.invoke('process-email-order', { body: { emailId: id } });
              }
              handleBulkActionComplete();
              toast.success(`${selectedIds.length} emails queued for reprocessing`);
            }}
            onDelete={async () => {
              await supabase.from('email_inbox').delete().in('id', selectedIds);
              handleBulkActionComplete();
              toast.success(`${selectedIds.length} emails deleted`);
            }}
          />
        )}
      </div>

      <Tabs value={statusFilter} onValueChange={setStatusFilter}>
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="all" className="gap-2">
            All
            {statusCounts?.all && (
              <Badge variant="secondary" className="ml-1">{statusCounts.all}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="new" className="gap-2">
            New
            {statusCounts?.new && (
              <Badge variant="secondary" className="ml-1 bg-blue-100 text-blue-700">{statusCounts.new}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="processing">Processing</TabsTrigger>
          <TabsTrigger value="pending_review" className="gap-2">
            Review
            {statusCounts?.pending_review && (
              <Badge variant="secondary" className="ml-1 bg-orange-100 text-orange-700">{statusCounts.pending_review}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="confirmed">Confirmed</TabsTrigger>
          <TabsTrigger value="declined">Declined</TabsTrigger>
          <TabsTrigger value="error">Errors</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredEmails.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Mail className="h-12 w-12 mb-4 opacity-50" />
              <p>No emails found</p>
            </div>
          ) : (
            <div className="divide-y">
              {/* Select All Header */}
              <div className="flex items-center gap-4 p-3 bg-muted/30 border-b">
                <Checkbox
                  checked={selectedIds.length === filteredEmails.length && filteredEmails.length > 0}
                  onCheckedChange={handleSelectAll}
                />
                <span className="text-sm text-muted-foreground">
                  {selectedIds.length > 0 
                    ? `${selectedIds.length} selected`
                    : 'Select all'
                  }
                </span>
              </div>
              
              {filteredEmails.map((email) => {
                const StatusIcon = statusConfig[email.status]?.icon || Mail;
                const isSelected = selectedIds.includes(email.id);
                return (
                  <div
                    key={email.id}
                    className={cn(
                      "flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors",
                      email.status === 'new' && "bg-blue-50/50 dark:bg-blue-950/20",
                      isSelected && "bg-primary/5"
                    )}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={(checked) => handleSelectOne(email.id, checked as boolean)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    
                    <div 
                      className="flex-1 flex items-center gap-4 cursor-pointer"
                      onClick={() => handleEmailClick(email)}
                    >
                      <div className={cn(
                        "w-2 h-2 rounded-full flex-shrink-0",
                        statusConfig[email.status]?.color || "bg-gray-500"
                      )} />
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium truncate">
                            {email.from_name || email.from_email}
                          </span>
                          {email.matched_customer && (
                            <Badge variant="outline" className="flex-shrink-0">
                              <User className="h-3 w-3 mr-1" />
                              {email.matched_customer.name}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm font-medium truncate">{email.subject}</p>
                        <p className="text-sm text-muted-foreground truncate">
                          {email.body_text?.slice(0, 100)}...
                        </p>
                      </div>

                      <div className="flex flex-col items-end gap-2 flex-shrink-0">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {format(parseISO(email.received_at), 'MMM d, h:mm a')}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant="secondary"
                            className={cn(
                              "text-xs",
                              email.status === 'pending_review' && "bg-orange-100 text-orange-700",
                              email.status === 'confirmed' && "bg-green-100 text-green-700",
                              email.status === 'error' && "bg-red-100 text-red-700"
                            )}
                          >
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {statusConfig[email.status]?.label || email.status}
                          </Badge>
                          {email.linked_order && (
                            <Badge variant="outline" className="text-xs">
                              {email.linked_order.order_number}
                            </Badge>
                          )}
                        </div>
                      </div>

                      <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedEmail && (
        <EmailDetailDialog
          email={selectedEmail}
          open={!!selectedEmail}
          onClose={handleDialogClose}
        />
      )}
    </div>
  );
}
