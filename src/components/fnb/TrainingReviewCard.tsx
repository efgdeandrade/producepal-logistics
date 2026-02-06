import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, SkipForward, Edit2, Ban } from "lucide-react";
import { MatchLog } from "@/hooks/useAITraining";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface TrainingReviewCardProps {
  log: MatchLog;
  onConfirm: (params: { logId: string; addAsAlias: boolean; language: string }) => void;
  onCorrect: (params: { logId: string; correctProductId: string; addAsAlias: boolean; language: string }) => void;
  onSkip: (logId: string) => void;
  onIgnore: (logId: string) => void;
  isLoading?: boolean;
}

export function TrainingReviewCard({ log, onConfirm, onCorrect, onSkip, onIgnore, isLoading }: TrainingReviewCardProps) {
  const [addAsAlias, setAddAsAlias] = useState(true);
  const [language, setLanguage] = useState(log.detected_language || 'pap');
  const [isEditing, setIsEditing] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string>('');

  const { data: products } = useQuery({
    queryKey: ['distribution-products-for-training'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('distribution_products')
        .select('id, name, code')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
    enabled: isEditing,
  });

  const confidenceColors = {
    high: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    low: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  };

  const handleConfirm = () => {
    onConfirm({ logId: log.id, addAsAlias, language });
  };

  const handleCorrect = () => {
    if (selectedProductId) {
      onCorrect({ logId: log.id, correctProductId: selectedProductId, addAsAlias, language });
      setIsEditing(false);
    }
  };

  return (
    <Card className="border-l-4 border-l-primary">
      <CardContent className="p-4 space-y-3">
        {/* Original text */}
        <div>
          <p className="text-lg font-medium">"{log.raw_text}"</p>
          {log.customer && (
            <p className="text-sm text-muted-foreground">
              Customer: {log.customer.name}
            </p>
          )}
          {log.order && (
            <p className="text-xs text-muted-foreground">
              From order {log.order.order_number}
            </p>
          )}
        </div>

        {/* What AI matched */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground">AI Matched:</span>
          {log.matched_product ? (
            <Badge variant="outline" className="font-mono">
              {log.matched_product.name}
            </Badge>
          ) : (
            <Badge variant="destructive">Unmatched</Badge>
          )}
          {log.confidence && (
            <Badge className={confidenceColors[log.confidence]}>
              {log.confidence}
            </Badge>
          )}
        </div>

        {/* Quantity/Unit */}
        {(log.detected_quantity || log.detected_unit) && (
          <p className="text-sm">
            Qty: {log.detected_quantity || '?'} {log.detected_unit || ''}
          </p>
        )}

        {/* Edit mode */}
        {isEditing && (
          <div className="space-y-2 p-3 bg-muted rounded-lg">
            <p className="text-sm font-medium">Select correct product:</p>
            <SearchableSelect
              options={products?.map(p => ({ value: p.id, label: `${p.code} - ${p.name}` })) || []}
              value={selectedProductId}
              onValueChange={setSelectedProductId}
              placeholder="Search products..."
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleCorrect} disabled={!selectedProductId || isLoading}>
                <Check className="h-4 w-4 mr-1" /> Save Correction
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Alias checkbox and language */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Checkbox
              id={`alias-${log.id}`}
              checked={addAsAlias}
              onCheckedChange={(checked) => setAddAsAlias(checked as boolean)}
            />
            <label htmlFor={`alias-${log.id}`} className="text-sm">
              Add as global alias
            </label>
          </div>
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger className="w-32 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pap">Papiamento</SelectItem>
              <SelectItem value="es">Spanish</SelectItem>
              <SelectItem value="nl">Dutch</SelectItem>
              <SelectItem value="en">English</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Actions */}
        {!isEditing && (
          <div className="flex gap-2 pt-2">
            <Button 
              size="sm" 
              onClick={handleConfirm} 
              disabled={!log.matched_product || isLoading}
              className="flex-1"
            >
              <Check className="h-4 w-4 mr-1" /> Confirm
            </Button>
            <Button 
              size="sm" 
              variant="secondary" 
              onClick={() => setIsEditing(true)}
              className="flex-1"
            >
              <Edit2 className="h-4 w-4 mr-1" /> Change
            </Button>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => onIgnore(log.id)}
              disabled={isLoading}
              title="Mark as not a product (header, date, etc.)"
              className="text-muted-foreground hover:text-destructive"
            >
              <Ban className="h-4 w-4" />
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
