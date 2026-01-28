import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { 
  Hash, Users, MessageSquare, ChevronDown, ChevronRight, 
  Circle, Truck, Briefcase, DollarSign, Plus, Settings 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { TeamChannel, TeamPresence } from '@/hooks/useDreTeamChat';

interface DreTeamSidebarProps {
  channels: TeamChannel[];
  teamPresence: TeamPresence[];
  selectedChannelId: string | null;
  selectedDmUserId: string | null;
  onSelectChannel: (channelId: string) => void;
  onSelectDm: (userId: string) => void;
  currentUserId?: string;
}

const departmentIcons: Record<string, React.ReactNode> = {
  logistics: <Truck className="h-4 w-4" />,
  management: <Briefcase className="h-4 w-4" />,
  accounting: <DollarSign className="h-4 w-4" />,
  all: <Users className="h-4 w-4" />,
};

const statusColors: Record<string, string> = {
  online: 'bg-green-500',
  away: 'bg-yellow-500',
  busy: 'bg-red-500',
  offline: 'bg-muted-foreground/50',
};

export function DreTeamSidebar({
  channels,
  teamPresence,
  selectedChannelId,
  selectedDmUserId,
  onSelectChannel,
  onSelectDm,
  currentUserId,
}: DreTeamSidebarProps) {
  const [channelsOpen, setChannelsOpen] = useState(true);
  const [directMessagesOpen, setDirectMessagesOpen] = useState(true);

  const generalChannels = channels.filter(c => c.channel_type === 'general');
  const departmentChannels = channels.filter(c => c.channel_type === 'department');
  const onlineMembers = teamPresence.filter(p => p.status !== 'offline' && p.user_id !== currentUserId);
  const offlineMembers = teamPresence.filter(p => p.status === 'offline' && p.user_id !== currentUserId);

  return (
    <div className="w-64 border-r bg-muted/30 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <MessageSquare className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h2 className="font-semibold text-sm">Team Hub</h2>
              <p className="text-xs text-muted-foreground">
                {onlineMembers.length + 1} online
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2">
          {/* Channels Section */}
          <Collapsible open={channelsOpen} onOpenChange={setChannelsOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-start px-2 h-8">
                {channelsOpen ? (
                  <ChevronDown className="h-3 w-3 mr-1" />
                ) : (
                  <ChevronRight className="h-3 w-3 mr-1" />
                )}
                <span className="text-xs font-semibold uppercase text-muted-foreground">
                  Channels
                </span>
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-0.5 mt-1">
              {/* General Channels */}
              {generalChannels.map((channel) => (
                <Button
                  key={channel.id}
                  variant="ghost"
                  className={cn(
                    "w-full justify-start h-8 px-2",
                    selectedChannelId === channel.id && "bg-accent"
                  )}
                  onClick={() => onSelectChannel(channel.id)}
                >
                  <Hash className="h-4 w-4 mr-2 text-muted-foreground" />
                  <span className="truncate">{channel.name}</span>
                </Button>
              ))}

              {/* Department Channels */}
              {departmentChannels.map((channel) => (
                <TooltipProvider key={channel.id}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        className={cn(
                          "w-full justify-start h-8 px-2",
                          selectedChannelId === channel.id && "bg-accent"
                        )}
                        onClick={() => onSelectChannel(channel.id)}
                      >
                        <span className="mr-2 text-muted-foreground">
                          {departmentIcons[channel.department || 'all']}
                        </span>
                        <span className="truncate">{channel.name}</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p className="text-xs">{channel.description}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ))}
            </CollapsibleContent>
          </Collapsible>

          {/* Direct Messages Section */}
          <Collapsible open={directMessagesOpen} onOpenChange={setDirectMessagesOpen} className="mt-4">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-start px-2 h-8">
                {directMessagesOpen ? (
                  <ChevronDown className="h-3 w-3 mr-1" />
                ) : (
                  <ChevronRight className="h-3 w-3 mr-1" />
                )}
                <span className="text-xs font-semibold uppercase text-muted-foreground">
                  Direct Messages
                </span>
                <Badge variant="secondary" className="ml-auto text-[10px] h-5">
                  {onlineMembers.length}
                </Badge>
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-0.5 mt-1">
              {/* Online Members */}
              {onlineMembers.map((member) => (
                <Button
                  key={member.user_id}
                  variant="ghost"
                  className={cn(
                    "w-full justify-start h-9 px-2",
                    selectedDmUserId === member.user_id && "bg-accent"
                  )}
                  onClick={() => onSelectDm(member.user_id)}
                >
                  <div className="relative mr-2">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="text-[10px]">
                        {member.user?.full_name?.charAt(0) || member.user?.email?.charAt(0) || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <Circle 
                      className={cn(
                        "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 fill-current",
                        statusColors[member.status]
                      )} 
                    />
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <span className="text-sm truncate block">
                      {member.user?.full_name || member.user?.email?.split('@')[0]}
                    </span>
                    {member.current_view && (
                      <span className="text-[10px] text-muted-foreground truncate block">
                        {member.current_view === 'command_center' ? 'Command Center' : 
                         member.current_view.startsWith('conversation:') ? 'In conversation' : 
                         member.current_view}
                      </span>
                    )}
                  </div>
                  {member.active_conversations > 0 && (
                    <Badge variant="outline" className="text-[10px] h-5 ml-1">
                      {member.active_conversations}
                    </Badge>
                  )}
                </Button>
              ))}

              {/* Offline Members (collapsed) */}
              {offlineMembers.length > 0 && (
                <div className="pt-2">
                  <p className="text-[10px] uppercase text-muted-foreground px-2 mb-1">
                    Offline ({offlineMembers.length})
                  </p>
                  {offlineMembers.slice(0, 3).map((member) => (
                    <Button
                      key={member.user_id}
                      variant="ghost"
                      className={cn(
                        "w-full justify-start h-9 px-2 opacity-60",
                        selectedDmUserId === member.user_id && "bg-accent opacity-100"
                      )}
                      onClick={() => onSelectDm(member.user_id)}
                    >
                      <div className="relative mr-2">
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="text-[10px]">
                            {member.user?.full_name?.charAt(0) || member.user?.email?.charAt(0) || '?'}
                          </AvatarFallback>
                        </Avatar>
                        <Circle className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 fill-muted-foreground/50" />
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <span className="text-sm truncate block">
                          {member.user?.full_name || member.user?.email?.split('@')[0]}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {formatDistanceToNow(new Date(member.last_seen_at), { addSuffix: true })}
                        </span>
                      </div>
                    </Button>
                  ))}
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>
        </div>
      </ScrollArea>
    </div>
  );
}
