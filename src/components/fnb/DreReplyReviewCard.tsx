import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ThumbsUp, Pencil, SkipForward } from "lucide-react";

interface DreReplyLog {
  id: string;
  raw_text: string;
  dre_reply: string | null;
  detected_language: string | null;
  created_at: string | null;
}

interface DreReplyReviewCardProps {
  log: DreReplyLog;
  onApprove: (logId: string) => void;
  onCorrect: (logId: string, correctedReply: string) => void;
  onSkip: (logId: string) => void;
  isLoading?: boolean;
}

const LANG_LABELS: Record<string, string> = {
  pap: 'Papiamentu',
  en: 'English',
  nl: 'Dutch',
  es: 'Spanish',
  papiamentu: 'Papiamentu',
  english: 'English',
  dutch: 'Dutch',
  spanish: 'Spanish',
};

const LANG_COLORS: Record<string, string> = {
  pap: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  papiamentu: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  en: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  english: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  nl: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  dutch: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  es: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  spanish: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
};

export function DreReplyReviewCard({ log, onApprove, onCorrect, onSkip, isLoading }: DreReplyReviewCardProps) {
  const [correctedText, setCorrectedText] = useState(log.dre_reply || '');
  const [isEditing, setIsEditing] = useState(false);

  const lang = log.detected_language || 'en';

  return (
    <Card className="border-l-4 border-l-green-500">
      <CardContent className="p-4 space-y-3">
        {/* Customer message */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium text-muted-foreground">Customer said:</span>
            <Badge className={LANG_COLORS[lang] || LANG_COLORS.en}>
              {LANG_LABELS[lang] || lang}
            </Badge>
          </div>
          <p className="text-base font-medium">"{log.raw_text}"</p>
        </div>

        {/* Dre's reply */}
        <div>
          <span className="text-xs font-medium text-muted-foreground">Dre replied:</span>
          <div className="mt-1 p-3 bg-muted rounded-lg text-sm">
            {log.dre_reply || <span className="italic text-muted-foreground">No reply recorded</span>}
          </div>
        </div>

        {/* Correction area */}
        {isEditing && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Correct Dre's reply:</label>
            <Textarea
              value={correctedText}
              onChange={(e) => setCorrectedText(e.target.value)}
              rows={3}
              className="text-sm"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => {
                  onCorrect(log.id, correctedText);
                  setIsEditing(false);
                }}
                disabled={!correctedText.trim() || isLoading}
              >
                <Pencil className="h-4 w-4 mr-1" /> Save correction
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Actions */}
        {!isEditing && (
          <div className="flex gap-2 pt-1">
            <Button
              size="sm"
              variant="outline"
              onClick={() => onApprove(log.id)}
              disabled={isLoading}
              className="flex-1"
            >
              <ThumbsUp className="h-4 w-4 mr-1" /> Reply is good
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setIsEditing(true)}
              className="flex-1"
            >
              <Pencil className="h-4 w-4 mr-1" /> Correct
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onSkip(log.id)}
              disabled={isLoading}
            >
              <SkipForward className="h-4 w-4" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
