import { formatDistanceToNow } from 'date-fns';
import { 
  AlertTriangle, UserCheck, CheckCircle, Clock, 
  Truck, Briefcase, DollarSign, MessageSquare
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Escalation } from '@/hooks/useDreEscalations';

interface DreEscalationQueueProps {
  escalations: Escalation[];
  onClaim: (id: string) => void;
  onResolve: (id: string) => void;
  onViewConversation?: (conversationId: string) => void;
}

const departmentIcons: Record<string, React.ReactNode> = {
  logistics: <Truck className="h-4 w-4" />,
  management: <Briefcase className="h-4 w-4" />,
  accounting: <DollarSign className="h-4 w-4" />,
};

const priorityStyles: Record<string, string> = {
  urgent: 'bg-destructive text-destructive-foreground',
  high: 'bg-primary text-primary-foreground',
  normal: 'bg-secondary text-secondary-foreground',
  low: 'bg-muted text-muted-foreground',
};

const typeLabels: Record<string, string> = {
  order_modification: 'Order Change',
  complaint: 'Complaint',
  pricing: 'Pricing Issue',
  delivery: 'Delivery Issue',
  human_request: 'Human Request',
  urgent: 'Urgent',
  other: 'Other',
};

export function DreEscalationQueue({
  escalations,
  onClaim,
  onResolve,
  onViewConversation,
}: DreEscalationQueueProps) {
  const pendingEscalations = escalations.filter(e => e.status === 'pending');
  const inProgressEscalations = escalations.filter(e => e.status === 'in_progress' || e.status === 'assigned');

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          Escalation Queue
          {pendingEscalations.length > 0 && (
            <Badge variant="destructive" className="ml-2">
              {pendingEscalations.length} pending
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0">
        <ScrollArea className="h-full px-4 pb-4">
          {/* Pending Escalations */}
          {pendingEscalations.length > 0 && (
            <div className="mb-4">
              <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">
                Needs Attention ({pendingEscalations.length})
              </h4>
              <div className="space-y-2">
                {pendingEscalations.map((escalation) => (
                  <EscalationCard
                    key={escalation.id}
                    escalation={escalation}
                    onClaim={onClaim}
                    onResolve={onResolve}
                    onViewConversation={onViewConversation}
                  />
                ))}
              </div>
            </div>
          )}

          {/* In Progress */}
          {inProgressEscalations.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">
                In Progress ({inProgressEscalations.length})
              </h4>
              <div className="space-y-2">
                {inProgressEscalations.map((escalation) => (
                  <EscalationCard
                    key={escalation.id}
                    escalation={escalation}
                    onClaim={onClaim}
                    onResolve={onResolve}
                    onViewConversation={onViewConversation}
                  />
                ))}
              </div>
            </div>
          )}

          {escalations.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <CheckCircle className="h-10 w-10 mb-2 opacity-50 text-primary" />
              <p className="text-sm font-medium">All clear!</p>
              <p className="text-xs">No pending escalations</p>
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

interface EscalationCardProps {
  escalation: Escalation;
  onClaim: (id: string) => void;
  onResolve: (id: string) => void;
  onViewConversation?: (conversationId: string) => void;
}

function EscalationCard({ escalation, onClaim, onResolve, onViewConversation }: EscalationCardProps) {
  const isPending = escalation.status === 'pending';

  return (
    <div
      className={cn(
        "p-3 rounded-lg border transition-all",
        isPending ? "bg-destructive/5 border-destructive/30" : "bg-muted/30"
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <Badge className={cn("text-[10px] h-5", priorityStyles[escalation.priority])}>
            {escalation.priority}
          </Badge>
          <Badge variant="outline" className="text-[10px] h-5">
            {typeLabels[escalation.escalation_type]}
          </Badge>
        </div>
        <div className="flex items-center gap-1 text-muted-foreground">
          {departmentIcons[escalation.assigned_department || 'management']}
          <span className="text-[10px] capitalize">{escalation.assigned_department}</span>
        </div>
      </div>

      {/* Customer Info */}
      {escalation.customer && (
        <div className="mb-2">
          <p className="font-medium text-sm">{escalation.customer.name}</p>
          <p className="text-xs text-muted-foreground">{escalation.customer.whatsapp_phone}</p>
        </div>
      )}

      {/* AI Summary */}
      {escalation.ai_summary && (
        <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
          {escalation.ai_summary}
        </p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-1 text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span className="text-[10px]">
            {formatDistanceToNow(new Date(escalation.created_at), { addSuffix: true })}
          </span>
        </div>
        
        <div className="flex items-center gap-1">
          {onViewConversation && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => onViewConversation(escalation.conversation_id)}
            >
              <MessageSquare className="h-3 w-3 mr-1" />
              View
            </Button>
          )}
          
          {isPending ? (
            <Button
              variant="default"
              size="sm"
              className="h-7 text-xs"
              onClick={() => onClaim(escalation.id)}
            >
              <UserCheck className="h-3 w-3 mr-1" />
              Claim
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => onResolve(escalation.id)}
            >
              <CheckCircle className="h-3 w-3 mr-1" />
              Resolve
            </Button>
          )}
        </div>
      </div>

      {/* Assignee */}
      {escalation.assignee && (
        <div className="mt-2 pt-2 border-t">
          <p className="text-[10px] text-muted-foreground">
            Assigned to: <span className="font-medium">{escalation.assignee.full_name}</span>
          </p>
        </div>
      )}
    </div>
  );
}
