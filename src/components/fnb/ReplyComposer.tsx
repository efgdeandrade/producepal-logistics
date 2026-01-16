import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ChevronDown, ChevronUp, Send, X, Quote } from 'lucide-react';

interface ReplyComposerProps {
  emailId: string;
  originalSubject: string;
  originalSender: string;
  originalBody: string;
  onReply: () => void;
  onCancel: () => void;
}

export function ReplyComposer({
  emailId,
  originalSubject,
  originalSender,
  originalBody,
  onReply,
  onCancel,
}: ReplyComposerProps) {
  const [to, setTo] = useState(originalSender);
  const [cc, setCc] = useState('');
  const [subject, setSubject] = useState(
    originalSubject.startsWith('Re:') ? originalSubject : `Re: ${originalSubject}`
  );
  const [body, setBody] = useState('');
  const [includeQuote, setIncludeQuote] = useState(true);
  const [showCc, setShowCc] = useState(false);
  const [sending, setSending] = useState(false);
  const { toast } = useToast();

  const formatQuote = (text: string): string => {
    return text
      .split('\n')
      .map(line => `> ${line}`)
      .join('\n');
  };

  const handleSend = async () => {
    if (!body.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a message',
        variant: 'destructive',
      });
      return;
    }

    setSending(true);
    try {
      const fullBody = includeQuote
        ? `${body}\n\n---\nOriginal message:\n${formatQuote(originalBody)}`
        : body;

      const { error } = await supabase.functions.invoke('send-gmail-reply', {
        body: {
          emailId,
          to,
          cc: cc || undefined,
          subject,
          body: fullBody,
        },
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Reply sent successfully',
      });
      onReply();
    } catch (error: any) {
      console.error('Error sending reply:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to send reply',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Send className="h-4 w-4" />
            Reply
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={onCancel}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="to">To</Label>
          <Input
            id="to"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="recipient@example.com"
          />
        </div>

        <Collapsible open={showCc} onOpenChange={setShowCc}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground">
              {showCc ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              CC
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="space-y-2 mt-2">
              <Label htmlFor="cc">CC</Label>
              <Input
                id="cc"
                value={cc}
                onChange={(e) => setCc(e.target.value)}
                placeholder="cc@example.com"
              />
            </div>
          </CollapsibleContent>
        </Collapsible>

        <div className="space-y-2">
          <Label htmlFor="subject">Subject</Label>
          <Input
            id="subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="body">Message</Label>
          <Textarea
            id="body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Type your reply..."
            className="min-h-[150px]"
          />
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIncludeQuote(!includeQuote)}
            className={includeQuote ? 'bg-muted' : ''}
          >
            <Quote className="h-4 w-4 mr-2" />
            {includeQuote ? 'Quote included' : 'Include quote'}
          </Button>
        </div>

        {includeQuote && (
          <div className="p-3 bg-muted rounded-md text-sm text-muted-foreground border-l-4 border-muted-foreground/30">
            <p className="font-medium mb-1">Original message:</p>
            <p className="whitespace-pre-wrap line-clamp-4">{originalBody.slice(0, 300)}...</p>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onCancel} disabled={sending}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={sending || !body.trim()}>
            <Send className="h-4 w-4 mr-2" />
            {sending ? 'Sending...' : 'Send Reply'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
