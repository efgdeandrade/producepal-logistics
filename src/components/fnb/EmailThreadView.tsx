import { useEmailThread } from '@/hooks/useEmailThread';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { ChevronDown, ChevronUp, Mail, Send } from 'lucide-react';
import { useState } from 'react';

interface EmailThreadViewProps {
  threadId: string | null;
  currentEmailId: string;
}

export function EmailThreadView({ threadId, currentEmailId }: EmailThreadViewProps) {
  const { emails, loading } = useEmailThread(threadId);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set([currentEmailId]));

  if (!threadId) {
    return null;
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (emails.length <= 1) {
    return null;
  }

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedIds);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedIds(newExpanded);
  };

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
    }
    return email.slice(0, 2).toUpperCase();
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Mail className="h-4 w-4" />
        <span>Thread ({emails.length} messages)</span>
      </div>

      <div className="space-y-2">
        {emails.map((email) => {
          const isExpanded = expandedIds.has(email.id);
          const isCurrent = email.id === currentEmailId;
          const isReply = email.is_reply;

          return (
            <Card
              key={email.id}
              className={`transition-all ${isCurrent ? 'ring-2 ring-primary' : ''} ${isReply ? 'border-l-4 border-l-blue-500' : ''}`}
            >
              <CardHeader
                className="p-3 cursor-pointer hover:bg-muted/50"
                onClick={() => toggleExpand(email.id)}
              >
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className={isReply ? 'bg-blue-500 text-white' : ''}>
                      {isReply ? <Send className="h-4 w-4" /> : getInitials(email.from_name, email.from_email)}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">
                        {isReply ? 'You' : (email.from_name || email.from_email)}
                      </span>
                      {isCurrent && (
                        <Badge variant="secondary" className="text-xs">Current</Badge>
                      )}
                      {isReply && (
                        <Badge className="text-xs bg-blue-500">Sent</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(email.received_at), 'MMM d, yyyy h:mm a')}
                    </p>
                  </div>

                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>

                {!isExpanded && (
                  <p className="text-sm text-muted-foreground truncate mt-1 ml-11">
                    {email.body_text?.slice(0, 100)}...
                  </p>
                )}
              </CardHeader>

              {isExpanded && (
                <CardContent className="px-3 pb-3 pt-0">
                  <div className="pl-11">
                    <p className="text-xs text-muted-foreground mb-2">
                      <strong>Subject:</strong> {email.subject}
                    </p>
                    {email.body_html ? (
                      <div
                        className="prose prose-sm max-w-none text-sm"
                        dangerouslySetInnerHTML={{ __html: email.body_html }}
                      />
                    ) : (
                      <p className="text-sm whitespace-pre-wrap">{email.body_text}</p>
                    )}
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
