import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  MessageSquare, 
  Sparkles, 
  Check, 
  AlertTriangle, 
  Zap, 
  X,
  ChevronLeft,
  Loader2,
  Calendar,
  User,
  Globe
} from 'lucide-react';
import { useConversationImport, MatchedConversationItem } from '@/hooks/useConversationImport';
import { format } from 'date-fns';

interface Product {
  id: string;
  code: string;
  name: string;
  name_pap?: string | null;
  name_nl?: string | null;
  name_es?: string | null;
  price_xcg: number;
  unit: string;
}

interface QuickPasteOrderProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: Product[];
  customerId?: string;
  onConfirm: (items: MatchedConversationItem[], deliveryDate?: string, notes?: string) => void;
}

const LANGUAGE_FLAGS: Record<string, string> = {
  pap: '🇨🇼',
  en: '🇺🇸',
  nl: '🇳🇱',
  es: '🇪🇸',
  mixed: '🌐'
};

const LANGUAGE_NAMES: Record<string, string> = {
  pap: 'Papiamento',
  en: 'English',
  nl: 'Dutch',
  es: 'Spanish',
  mixed: 'Mixed'
};

export function QuickPasteOrder({ 
  open, 
  onOpenChange, 
  products, 
  customerId,
  onConfirm 
}: QuickPasteOrderProps) {
  const [conversationText, setConversationText] = useState('');
  const [step, setStep] = useState<'paste' | 'review'>('paste');
  const [deliveryDate, setDeliveryDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const {
    isParsing,
    parsedData,
    matchedItems,
    parseConversation,
    updateMatchedItem,
    removeMatchedItem,
    saveMappings,
    reset
  } = useConversationImport();

  // Reset when dialog closes
  useEffect(() => {
    if (!open) {
      setConversationText('');
      setStep('paste');
      reset();
    }
  }, [open, reset]);

  // Update delivery date from parsed data
  useEffect(() => {
    if (parsedData?.delivery_date) {
      setDeliveryDate(parsedData.delivery_date);
    }
  }, [parsedData?.delivery_date]);

  const handleParse = async () => {
    const result = await parseConversation(conversationText, products, customerId);
    if (result && result.items.length > 0) {
      setStep('review');
    }
  };

  const handleConfirm = async () => {
    // Save learned mappings
    if (customerId) {
      await saveMappings(customerId);
    }
    
    // Call parent callback with matched items
    onConfirm(
      matchedItems.filter(item => item.matched_product_id),
      deliveryDate,
      parsedData?.special_instructions
    );
    onOpenChange(false);
  };

  const handleBack = () => {
    setStep('paste');
  };

  const getConfidenceBadge = (item: MatchedConversationItem) => {
    if (item.was_manually_changed) {
      return (
        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
          <Check className="h-3 w-3 mr-1" />
          Manual
        </Badge>
      );
    }

    switch (item.match_source) {
      case 'verified':
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            <Check className="h-3 w-3 mr-1" />
            Verified
          </Badge>
        );
      case 'customer_mapping':
        return (
          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
            <Sparkles className="h-3 w-3 mr-1" />
            Learned
          </Badge>
        );
      case 'ai_match':
      case 'product_name':
        return (
          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
            <Zap className="h-3 w-3 mr-1" />
            AI Match
          </Badge>
        );
      case 'unmatched':
      default:
        return (
          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Needs Review
          </Badge>
        );
    }
  };

  const validItemsCount = matchedItems.filter(item => item.matched_product_id).length;
  const needsReviewCount = matchedItems.filter(item => !item.matched_product_id).length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[90vh] sm:h-[85vh] p-0 flex flex-col">
        <SheetHeader className="px-4 py-3 border-b shrink-0">
          <div className="flex items-center gap-3">
            {step === 'review' && (
              <Button variant="ghost" size="icon" onClick={handleBack} className="shrink-0">
                <ChevronLeft className="h-5 w-5" />
              </Button>
            )}
            <div className="flex items-center gap-2 flex-1">
              <MessageSquare className="h-5 w-5 text-primary" />
              <SheetTitle className="text-lg">
                {step === 'paste' ? 'Paste WhatsApp Order' : 'Review Order Items'}
              </SheetTitle>
            </div>
          </div>
        </SheetHeader>

        {step === 'paste' ? (
          <div className="flex-1 flex flex-col p-4 gap-4 overflow-hidden">
            <div className="flex-1 flex flex-col gap-2 min-h-0">
              <Label className="text-sm font-medium">Paste conversation here</Label>
              <Textarea
                value={conversationText}
                onChange={(e) => setConversationText(e.target.value)}
                placeholder={`Paste the WhatsApp conversation here...

Example:
"Bon dia! Mi ta mester:
- 5 kg tomato
- 2 tros banana
- 3 siboyo grandi
Pa mañan por fabor"

Supports: Papiamento, English, Dutch, Spanish`}
                className="flex-1 min-h-[200px] text-base resize-none"
                autoFocus
              />
            </div>

            <Button 
              onClick={handleParse}
              disabled={!conversationText.trim() || isParsing}
              size="lg"
              className="w-full h-14 text-lg gap-2"
            >
              {isParsing ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Parsing...
                </>
              ) : (
                <>
                  <Sparkles className="h-5 w-5" />
                  Parse Order
                </>
              )}
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              AI-powered parsing • Supports 4 languages • Self-learning
            </p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Order Summary Header */}
            {parsedData && (
              <div className="px-4 py-3 bg-muted/50 border-b shrink-0">
                <div className="flex flex-wrap gap-4 text-sm">
                  {parsedData.customer_name && (
                    <div className="flex items-center gap-1.5">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span>{parsedData.customer_name}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {LANGUAGE_FLAGS[parsedData.detected_language]} {LANGUAGE_NAMES[parsedData.detected_language]}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <Input
                      type="date"
                      value={deliveryDate}
                      onChange={(e) => setDeliveryDate(e.target.value)}
                      className="h-7 w-auto text-sm"
                    />
                  </div>
                </div>
                {parsedData.special_instructions && (
                  <p className="text-xs text-muted-foreground mt-2 italic">
                    "{parsedData.special_instructions}"
                  </p>
                )}
              </div>
            )}

            {/* Items Review - Mobile optimized vertical layout */}
            <ScrollArea className="flex-1">
              <div className="p-4 space-y-4">
                {matchedItems.map((item, index) => (
                  <Card key={index} className={`relative ${!item.matched_product_id ? 'border-amber-300 bg-amber-50/50 dark:bg-amber-950/20' : ''}`}>
                    <CardContent className="p-4 space-y-4">
                      {/* Header: Raw text + Remove */}
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm text-muted-foreground italic flex-1 min-w-0">
                          "{item.raw_text}"
                        </p>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="shrink-0 h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => removeMatchedItem(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      
                      {/* Quantity - Full width with larger controls */}
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          Quantity
                        </label>
                        <div className="flex items-center gap-3">
                          <Input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => updateMatchedItem(index, { quantity: Number(e.target.value) })}
                            className="flex-1 h-12 text-center text-lg"
                            min={0.1}
                            step={0.1}
                          />
                          <span className="text-sm font-medium text-muted-foreground min-w-[40px]">
                            {item.unit}
                          </span>
                        </div>
                      </div>

                      {/* Product selector - Full width */}
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          Product
                        </label>
                        <SearchableSelect
                          options={products.map(p => ({
                            value: p.id,
                            label: `${p.name} (${p.code})`,
                            searchTerms: `${p.name} ${p.code} ${p.name_pap || ''} ${p.name_nl || ''} ${p.name_es || ''}`
                          }))}
                          value={item.matched_product_id || ''}
                          onValueChange={(value) => {
                            const product = products.find(p => p.id === value);
                            updateMatchedItem(index, {
                              matched_product_id: value,
                              matched_product_name: product?.name || null,
                              suggested_price: product?.price_xcg || null
                            });
                          }}
                          placeholder="Select product..."
                          emptyMessage="No products found"
                          className="w-full"
                        />
                      </div>

                      {/* Footer: Badge + Price */}
                      <div className="flex items-center justify-between pt-2 border-t">
                        {getConfidenceBadge(item)}
                        {item.suggested_price !== null && (
                          <span className="text-sm font-medium">
                            ƒ{(item.quantity * item.suggested_price).toFixed(2)}
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>

            <Separator />

            {/* Footer */}
            <div className="p-4 space-y-3 shrink-0">
              {needsReviewCount > 0 && (
                <div className="flex items-center gap-2 text-sm text-amber-600">
                  <AlertTriangle className="h-4 w-4" />
                  <span>{needsReviewCount} item{needsReviewCount !== 1 ? 's' : ''} need product selection</span>
                </div>
              )}

              <Button 
                onClick={handleConfirm}
                disabled={validItemsCount === 0}
                size="lg"
                className="w-full h-14 text-lg gap-2"
              >
                <Check className="h-5 w-5" />
                Create Order ({validItemsCount} item{validItemsCount !== 1 ? 's' : ''})
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
