import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { MessageSquare, Send, ChevronDown, ChevronUp, Mic, Image as ImageIcon, User, RefreshCw } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

type Conversation = any;
type Message = any;

const FILTER_TABS = ['All', 'Dre Active', 'Human in Control', 'Escalated', 'Proactive'];
const filterMap: Record<string, string | null> = {
  'All': null,
  'Dre Active': 'dre_active',
  'Human in Control': 'human_in_control',
  'Escalated': 'escalated',
  'Proactive': null,
};

export default function IntakeConversations() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [filter, setFilter] = useState('All');
  const [loading, setLoading] = useState(true);
  const [msgLoading, setMsgLoading] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [lateOrders, setLateOrders] = useState<any[]>([]);
  const [lateExpanded, setLateExpanded] = useState(true);
  const [customers, setCustomers] = useState<any[]>([]);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [linkCustomerId, setLinkCustomerId] = useState('');
  const [newCustomerOpen, setNewCustomerOpen] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', customer_type: 'retail' as string, zone: '', payment_terms: 'cod', preferred_language: 'pap', delivery_address: '', phone: '', email: '', telegram_chat_id: '' });
  const [linkedOrder, setLinkedOrder] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const selected = conversations.find((c) => c.id === selectedId);

  // Fetch conversations
  const fetchConversations = async () => {
    let query = supabase.from('dre_conversations').select('*, distribution_customers(name)').order('updated_at', { ascending: false });
    
    if (filter === 'Proactive') {
      query = query.eq('is_proactive_outreach', true);
    } else if (filterMap[filter]) {
      query = query.eq('control_status', filterMap[filter]);
    }

    const { data } = await query;
    setConversations(data || []);
    setLoading(false);
  };

  // Fetch late orders
  const fetchLateOrders = async () => {
    const { data } = await supabase
      .from('distribution_orders')
      .select('*, distribution_customers:customer_id(name)')
      .eq('is_late_order', true)
      .eq('late_order_manager_decision', 'pending')
      .order('created_at', { ascending: false });
    setLateOrders(data || []);
  };

  // Fetch customers for linking
  const fetchCustomers = async () => {
    const { data } = await supabase.from('distribution_customers').select('id, name').order('name');
    setCustomers(data || []);
  };

  // Fetch team members for tagging
  const fetchTeamMembers = async () => {
    const { data } = await supabase.from('profiles').select('id, full_name, email');
    setTeamMembers(data || []);
  };

  useEffect(() => {
    fetchConversations();
    fetchLateOrders();
    fetchCustomers();
    fetchTeamMembers();

    const channel = supabase
      .channel('intake-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'dre_conversations' },
        async () => {
          fetchConversations();
          // Refresh linked order if conversation updated
          if (selectedId) {
            const updatedConv = conversations.find(c => c.id === selectedId);
            if (updatedConv?.order_id) {
              const { data: order } = await supabase
                .from('distribution_orders')
                .select('*, distribution_order_items(product_name_raw, quantity, order_unit)')
                .eq('id', updatedConv.order_id)
                .single();
              setLinkedOrder(order);
            }
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'dre_messages' },
        (payload: any) => {
          if (selectedId && payload.new.conversation_id === selectedId) {
            fetchMessages(selectedId);
          }
          fetchConversations();
        }
      )
      .subscribe((status) => {
        console.log('Realtime status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [filter, selectedId]);

  // Fetch messages for selected conversation
  const fetchMessages = async (convId: string) => {
    setMsgLoading(true);
    const { data } = await supabase
      .from('dre_messages')
      .select('*')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true });
    setMessages(data || []);
    setMsgLoading(false);
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  const selectConversation = async (id: string) => {
    setSelectedId(id);
    fetchMessages(id);
    // Fetch linked order if exists
    const conv = conversations.find(c => c.id === id);
    if (conv?.order_id) {
      const { data: order } = await supabase
        .from('distribution_orders')
        .select('*, distribution_order_items(product_name_raw, quantity, order_unit)')
        .eq('id', conv.order_id)
        .single();
      setLinkedOrder(order);
    } else {
      setLinkedOrder(null);
    }
  };

  // Control actions
  const takeOver = async () => {
    if (!selected) return;
    await supabase.from('dre_conversations').update({
      control_status: 'human_in_control',
      assigned_agent_id: user?.id,
    }).eq('id', selected.id);
    toast({ title: 'You are now in control' });
    fetchConversations();
  };

  const handBack = async () => {
    if (!selected) return;
    await supabase.from('dre_conversations').update({
      control_status: 'dre_active',
      assigned_agent_id: null,
    }).eq('id', selected.id);
    toast({ title: 'Handed back to Dre' });
    fetchConversations();
  };

  const assignToMe = async () => {
    if (!selected) return;
    await supabase.from('dre_conversations').update({
      control_status: 'human_in_control',
      assigned_agent_id: user?.id,
    }).eq('id', selected.id);
    toast({ title: 'Assigned to you' });
    fetchConversations();
  };

  const tagTeamMember = async (memberId: string) => {
    if (!selected) return;
    const member = teamMembers.find((m) => m.id === memberId);
    await supabase.from('dre_conversations').update({ assigned_agent_id: memberId }).eq('id', selected.id);
    await supabase.from('dre_messages').insert({
      conversation_id: selected.id,
      role: 'agent',
      content: `Tagged ${member?.full_name || 'team member'} to this conversation.`,
      media_type: 'text',
    });
    toast({ title: `Tagged ${member?.full_name}` });
    fetchConversations();
    fetchMessages(selected.id);
  };

  // Send reply via edge function
  const sendReply = async () => {
    if (!replyText.trim() || !selected || !user) return;
    try {
      const { data, error } = await supabase.functions.invoke('send-agent-reply', {
        body: { conversation_id: selected.id, message_text: replyText.trim(), agent_id: user.id },
      });
      if (error) throw error;
      setReplyText('');
      fetchMessages(selected.id);
    } catch (e: any) {
      toast({ title: 'Error sending reply', description: e.message, variant: 'destructive' });
    }
  };

  // Link customer
  const handleLinkCustomer = async (customerId: string) => {
    if (!selected) return;
    await supabase.from('dre_conversations').update({ customer_id: customerId }).eq('id', selected.id);
    // Issue 2: Write telegram_chat_id to distribution_customers so future messages are recognised
    if (selected.external_chat_id) {
      await supabase
        .from('distribution_customers')
        .update({ telegram_chat_id: selected.external_chat_id })
        .eq('id', customerId);
      await supabase.from('pending_customers').update({
        status: 'linked',
        linked_customer_id: customerId,
      }).eq('telegram_chat_id', selected.external_chat_id);
    }
    toast({ title: 'Customer linked' });
    fetchConversations();
  };

  // Create new customer
  const handleCreateCustomer = async () => {
    if (!newCustomer.name.trim()) return;
    const { data, error } = await supabase.from('distribution_customers').insert({
      name: newCustomer.name,
      customer_type: newCustomer.customer_type as any,
      zone: newCustomer.zone || null,
      payment_terms: newCustomer.payment_terms,
      preferred_language: newCustomer.preferred_language,
      address: newCustomer.delivery_address || null,
      whatsapp_phone: newCustomer.phone || '',
      telegram_chat_id: newCustomer.telegram_chat_id || null,
    }).select().single();

    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    if (data && selected) {
      await supabase.from('dre_conversations').update({ customer_id: data.id }).eq('id', selected.id);
      if (selected.external_chat_id) {
        // Issue 2: Write telegram_chat_id to the new customer record
        await supabase
          .from('distribution_customers')
          .update({ telegram_chat_id: selected.external_chat_id })
          .eq('id', data.id);
        await supabase.from('pending_customers').update({
          status: 'linked',
          linked_customer_id: data.id,
        }).eq('telegram_chat_id', selected.external_chat_id);
      }
    }
    setNewCustomerOpen(false);
    setNewCustomer({ name: '', customer_type: 'retail', zone: '', payment_terms: 'cod', preferred_language: 'pap', delivery_address: '', phone: '', email: '', telegram_chat_id: '' });
    toast({ title: 'Customer created and linked' });
    fetchConversations();
    fetchCustomers();
  };

  // Late order actions
  const handleLateOrderDecision = async (orderId: string, decision: 'approved' | 'declined') => {
    const updates: any = {
      late_order_manager_decision: decision,
      late_order_decided_by: user?.id,
      late_order_decided_at: new Date().toISOString(),
    };
    if (decision === 'approved') {
      updates.status = 'confirmed';
    } else {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      updates.delivery_date = tomorrow.toISOString().split('T')[0];
    }
    await supabase.from('distribution_orders').update(updates).eq('id', orderId);
    toast({ title: decision === 'approved' ? 'Approved same-day' : 'Moved to next-day' });
    fetchLateOrders();
  };

  // Status badge helpers
  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      dre_active: 'bg-[hsl(120,47%,93%)] text-[hsl(145,63%,26%)]',
      human_in_control: 'bg-[hsl(33,100%,94%)] text-[hsl(16,100%,45%)]',
      escalated: 'bg-[hsl(0,86%,94%)] text-[hsl(0,70%,47%)]',
    };
    const labels: Record<string, string> = {
      dre_active: 'Dre Active',
      human_in_control: 'Human in Control',
      escalated: 'Escalated',
    };
    return <Badge className={`text-[10px] ${map[status] || ''}`}>{labels[status] || status}</Badge>;
  };

  const channelBadge = (ch: string) => {
    if (ch === 'telegram') return <Badge className="bg-intake-info text-white text-[10px]">Telegram</Badge>;
    return <Badge className="bg-intake-brand text-white text-[10px]">WhatsApp</Badge>;
  };

  const langBadge = (lang: string | null) => {
    if (!lang) return null;
    return <Badge variant="outline" className="text-[10px] uppercase">{lang}</Badge>;
  };

  return (
    <div className="flex h-full">
      {/* LEFT PANEL */}
      <div className="w-[340px] flex-shrink-0 border-r border-border flex flex-col bg-intake-surface">
        {/* Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-lg text-intake-text">Conversations</h2>
            <Badge variant="secondary">{conversations.length}</Badge>
          </div>
          {/* Filter tabs */}
          <div className="flex gap-1 overflow-x-auto pb-1">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                  filter === tab
                    ? 'bg-intake-brand text-white'
                    : 'bg-muted text-intake-text-muted hover:bg-intake-brand-light'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Conversation list */}
        <ScrollArea className="flex-1">
          {loading ? (
            <div className="p-3 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
            </div>
          ) : conversations.length === 0 ? (
            <div className="p-6 text-center">
              <MessageSquare className="h-8 w-8 text-intake-text-muted mx-auto mb-2" />
              <p className="text-sm text-intake-text-muted">No conversations found</p>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => selectConversation(conv.id)}
                  className={`w-full text-left p-3 rounded-md transition-colors ${
                    selectedId === conv.id ? 'bg-intake-brand-light border border-intake-brand' : 'hover:bg-muted'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-intake-text truncate">
                      {conv.distribution_customers?.name || 'Unlinked contact'}
                    </span>
                    <span className="text-[10px] text-intake-text-muted">
                      {conv.updated_at ? formatDistanceToNow(new Date(conv.updated_at), { addSuffix: true }) : ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 flex-wrap mb-1">
                    {conv.channel && channelBadge(conv.channel)}
                    {conv.control_status && statusBadge(conv.control_status)}
                    {langBadge(conv.language_detected)}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Late Orders Section */}
          <div className="border-t border-border">
            <button
              onClick={() => setLateExpanded(!lateExpanded)}
              className="w-full flex items-center justify-between p-3 hover:bg-muted transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-intake-text">Late Orders</span>
                {lateOrders.length > 0 && (
                  <Badge variant="destructive" className="text-[10px]">{lateOrders.length}</Badge>
                )}
              </div>
              {lateExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {lateExpanded && (
              <div className="p-2 space-y-2">
                {lateOrders.length === 0 ? (
                  <p className="text-xs text-intake-text-muted text-center py-2">No late orders pending</p>
                ) : (
                  lateOrders.map((order) => (
                    <div key={order.id} className="border rounded-md p-2.5 space-y-2">
                      <p className="text-sm font-medium text-intake-text">
                        {(order.distribution_customers as any)?.name || 'Unknown'}
                      </p>
                      <p className="text-xs text-intake-text-muted">
                        {formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}
                      </p>
                      <div className="flex gap-1.5">
                        <Button size="sm" className="h-7 text-xs bg-intake-brand hover:bg-intake-accent text-white"
                          onClick={() => handleLateOrderDecision(order.id, 'approved')}>
                          Approve same-day
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs"
                          onClick={() => handleLateOrderDecision(order.id, 'declined')}>
                          Next-day delivery
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* RIGHT PANEL */}
      <div className="flex-1 flex flex-col bg-intake-bg">
        {!selected ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageSquare className="h-12 w-12 text-intake-text-muted mx-auto mb-3" />
              <p className="text-sm text-intake-text-muted">Select a conversation to view messages</p>
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="p-4 border-b border-border bg-intake-surface">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-intake-text">
                  {selected.distribution_customers?.name || 'Unlinked contact'}
                </h3>
                {selected.channel && channelBadge(selected.channel)}
                {selected.control_status && statusBadge(selected.control_status)}
                {langBadge(selected.language_detected)}
                {selected.is_proactive_outreach && (
                  <Badge className="bg-[hsl(33,100%,94%)] text-[hsl(16,100%,45%)] text-[10px]">Proactive Outreach</Badge>
                )}
              </div>

              {/* Unlinked contact banner */}
              {!selected.customer_id && (
                <div className="mt-3 p-3 rounded-md bg-[hsl(33,100%,94%)] border border-intake-warning">
                  <p className="text-xs text-intake-warning font-medium mb-2">
                    Unlinked contact — link to a customer record to enable order creation.
                  </p>
                  <div className="flex items-center gap-2">
                    <Select value={linkCustomerId} onValueChange={(v) => { setLinkCustomerId(v); handleLinkCustomer(v); }}>
                      <SelectTrigger className="h-8 text-xs flex-1">
                        <SelectValue placeholder="Search customer..." />
                      </SelectTrigger>
                      <SelectContent>
                        {customers.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setNewCustomerOpen(true)}>
                      Create New
                    </Button>
                  </div>
                </div>
              )}

              {/* Control bar */}
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                {selected.control_status === 'dre_active' && (
                  <Button size="sm" className="h-7 text-xs bg-intake-warning hover:bg-intake-warning/80 text-white" onClick={takeOver}>
                    Take Over
                  </Button>
                )}
                {selected.control_status === 'human_in_control' && (
                  <>
                    <Button size="sm" className="h-7 text-xs bg-intake-brand hover:bg-intake-accent text-white" onClick={handBack}>
                      Hand Back to Dre
                    </Button>
                    <span className="text-xs text-intake-text-muted">
                      {selected.assigned_agent_id === user?.id ? 'You are in control' : 'Agent in control'}
                    </span>
                  </>
                )}
                {selected.control_status === 'escalated' && (
                  <>
                    <Badge className="bg-intake-danger text-white text-xs">Escalated</Badge>
                    <Button size="sm" className="h-7 text-xs bg-intake-info text-white" onClick={assignToMe}>
                      Assign to Me
                    </Button>
                  </>
                )}
                <Select onValueChange={tagTeamMember}>
                  <SelectTrigger className="h-7 text-xs w-[160px]">
                    <SelectValue placeholder="Tag Team Member" />
                  </SelectTrigger>
                  <SelectContent>
                    {teamMembers.filter((m) => m.id !== user?.id).map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.full_name || m.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              {msgLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-3/4" />)}
                </div>
              ) : messages.length === 0 ? (
                <p className="text-sm text-intake-text-muted text-center py-8">No messages yet</p>
              ) : (
                <div className="space-y-3">
                  {messages.map((msg) => {
                    const isCustomer = msg.role === 'customer';
                    const isDre = msg.role === 'dre';
                    const isAgent = msg.role === 'agent';

                    return (
                      <div key={msg.id} className={`flex ${isCustomer ? 'justify-start' : 'justify-end'}`}>
                        <div className={`max-w-[70%] ${isAgent ? 'space-y-1' : ''}`}>
                          {isAgent && (
                            <p className="text-[10px] text-intake-text-muted text-right">Agent</p>
                          )}
                          <div
                            className={`px-3 py-2 text-sm ${
                              isCustomer
                                ? 'bg-[#F1F0F0] text-intake-text rounded-xl rounded-bl-none'
                                : isDre
                                ? 'bg-intake-brand text-white rounded-xl rounded-br-none'
                                : 'bg-intake-warning text-white rounded-xl rounded-br-none'
                            }`}
                          >
                            {msg.media_type === 'voice' && (
                              <div className="flex items-center gap-1.5 mb-1">
                                <Mic className="h-3.5 w-3.5" />
                                <span className="text-xs opacity-80">Voice note</span>
                              </div>
                            )}
                            {msg.media_type === 'image' && (
                              <div className="mb-1">
                                <ImageIcon className="h-8 w-8 opacity-60" />
                              </div>
                            )}
                            <p className="whitespace-pre-wrap">{msg.content}</p>
                          </div>
                          <p className="text-[10px] text-intake-text-muted mt-0.5 px-1">
                            {msg.created_at ? formatDistanceToNow(new Date(msg.created_at), { addSuffix: true }) : ''}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}

              {/* Linked order card */}
              {linkedOrder && (
                <div className="mt-4 p-3 border rounded-md bg-intake-surface space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-intake-text">
                      📦 Order #{linkedOrder.order_number}
                    </p>
                    <Badge variant="outline" className="text-[10px]">{linkedOrder.status}</Badge>
                  </div>
                  <div className="space-y-0.5">
                    {(linkedOrder.distribution_order_items || []).map((item: any, i: number) => (
                      <p key={i} className="text-xs text-intake-text-muted">
                        • {item.product_name_raw} — {item.quantity} {item.order_unit || ''}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </ScrollArea>

            {/* Reply box */}
            {selected.control_status === 'human_in_control' && selected.assigned_agent_id === user?.id && (
              <div className="p-3 border-t border-border bg-intake-surface">
                <div className="flex gap-2">
                  <Input
                    placeholder="Type a reply..."
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply(); } }}
                    className="flex-1"
                  />
                  <Button size="sm" className="bg-intake-brand hover:bg-intake-accent text-white" onClick={sendReply} disabled={!replyText.trim()}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* New Customer Sheet */}
      <Sheet open={newCustomerOpen} onOpenChange={setNewCustomerOpen}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Create New Customer</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label>Name *</Label>
              <Input value={newCustomer.name} onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })} />
            </div>
            <div>
              <Label>Customer Type</Label>
              <Select value={newCustomer.customer_type} onValueChange={(v) => setNewCustomer({ ...newCustomer, customer_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="retail">Retail</SelectItem>
                  <SelectItem value="wholesale">Wholesale</SelectItem>
                  <SelectItem value="supermarket">Supermarket</SelectItem>
                  <SelectItem value="restaurant">Restaurant</SelectItem>
                  <SelectItem value="hotel">Hotel</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Preferred Language</Label>
              <Select value={newCustomer.preferred_language} onValueChange={(v) => setNewCustomer({ ...newCustomer, preferred_language: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pap">Papiamentu</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="nl">Dutch</SelectItem>
                  <SelectItem value="es">Spanish</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={newCustomer.phone} onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })} />
            </div>
            <div>
              <Label>Delivery Address</Label>
              <Input value={newCustomer.delivery_address} onChange={(e) => setNewCustomer({ ...newCustomer, delivery_address: e.target.value })} />
            </div>
            <div>
              <Label>Zone</Label>
              <Input value={newCustomer.zone} onChange={(e) => setNewCustomer({ ...newCustomer, zone: e.target.value })} />
            </div>
            <div>
              <Label>Email</Label>
              <Input value={newCustomer.email} onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })} />
            </div>
            <div>
              <Label>Telegram Chat ID</Label>
              <Input value={newCustomer.telegram_chat_id} onChange={(e) => setNewCustomer({ ...newCustomer, telegram_chat_id: e.target.value })} />
            </div>
            <Button className="w-full bg-intake-brand hover:bg-intake-accent text-white" onClick={handleCreateCustomer} disabled={!newCustomer.name.trim()}>
              Create Customer
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
