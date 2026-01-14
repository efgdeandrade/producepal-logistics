import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Upload, BookOpen, CheckCircle2, AlertCircle, Languages } from "lucide-react";

interface DictionaryWord {
  word: string;
  meaning: string;
  category?: string;
  word_type: string;
}

const WORD_TYPES = [
  { value: 'unit', label: 'Unit of Measurement', examples: 'kaha (box), tros (bunch), saku (bag)' },
  { value: 'quantity_phrase', label: 'Quantity/Number', examples: 'un (one), dos (two), mei (half)' },
  { value: 'product_modifier', label: 'Product Modifier', examples: 'grandi (big), fresku (fresh)' },
  { value: 'time_reference', label: 'Time Reference', examples: 'mañan (tomorrow), awe (today)' },
  { value: 'action', label: 'Action/Verb', examples: 'manda (send), traha (make)' },
  { value: 'connector', label: 'Connector', examples: 'ku (with), i (and), pa (for)' },
  { value: 'product_name', label: 'Product Name', examples: 'tomati (tomato), piña (pineapple)' },
  { value: 'greeting', label: 'Greeting/Phrase', examples: 'bon dia (good morning)' },
];

// Pre-curated essential Papiamentu words from the dictionary
const CURATED_WORDS: DictionaryWord[] = [
  // Units
  { word: 'kaha', meaning: 'box/case', word_type: 'unit' },
  { word: 'kashi', meaning: 'case/crate', word_type: 'unit' },
  { word: 'saku', meaning: 'bag/sack', word_type: 'unit' },
  { word: 'tros', meaning: 'bunch/cluster', word_type: 'unit' },
  { word: 'stuk', meaning: 'piece', word_type: 'unit' },
  { word: 'kilo', meaning: 'kilogram', word_type: 'unit' },
  { word: 'pon', meaning: 'pound', word_type: 'unit' },
  { word: 'gram', meaning: 'gram', word_type: 'unit' },
  { word: 'bòter', meaning: 'bottle', word_type: 'unit' },
  { word: 'krat', meaning: 'crate', word_type: 'unit' },
  { word: 'tin', meaning: 'can/tin', word_type: 'unit' },
  { word: 'blek', meaning: 'can', word_type: 'unit' },
  { word: 'paki', meaning: 'pack/package', word_type: 'unit' },
  { word: 'dòshi', meaning: 'dozen', word_type: 'unit' },
  { word: 'pale', meaning: 'pallet', word_type: 'unit' },
  
  // Numbers/Quantities
  { word: 'un', meaning: 'one', word_type: 'quantity_phrase' },
  { word: 'uno', meaning: 'one', word_type: 'quantity_phrase' },
  { word: 'dos', meaning: 'two', word_type: 'quantity_phrase' },
  { word: 'tres', meaning: 'three', word_type: 'quantity_phrase' },
  { word: 'kuater', meaning: 'four', word_type: 'quantity_phrase' },
  { word: 'kwater', meaning: 'four', word_type: 'quantity_phrase' },
  { word: 'sinku', meaning: 'five', word_type: 'quantity_phrase' },
  { word: 'seis', meaning: 'six', word_type: 'quantity_phrase' },
  { word: 'siete', meaning: 'seven', word_type: 'quantity_phrase' },
  { word: 'ocho', meaning: 'eight', word_type: 'quantity_phrase' },
  { word: 'nuebe', meaning: 'nine', word_type: 'quantity_phrase' },
  { word: 'dies', meaning: 'ten', word_type: 'quantity_phrase' },
  { word: 'binti', meaning: 'twenty', word_type: 'quantity_phrase' },
  { word: 'mei', meaning: 'half', word_type: 'quantity_phrase' },
  { word: 'poko', meaning: 'a little/few', word_type: 'quantity_phrase' },
  { word: 'hopi', meaning: 'many/much/a lot', word_type: 'quantity_phrase' },
  { word: 'mas', meaning: 'more', word_type: 'quantity_phrase' },
  { word: 'ménos', meaning: 'less', word_type: 'quantity_phrase' },
  { word: 'tantu', meaning: 'so much', word_type: 'quantity_phrase' },
  { word: 'mashá', meaning: 'very/a lot', word_type: 'quantity_phrase' },
  
  // Time References
  { word: 'awe', meaning: 'today', word_type: 'time_reference' },
  { word: 'mañan', meaning: 'tomorrow', word_type: 'time_reference' },
  { word: 'pasado mañan', meaning: 'day after tomorrow', word_type: 'time_reference' },
  { word: 'ajér', meaning: 'yesterday', word_type: 'time_reference' },
  { word: 'anochi', meaning: 'tonight/last night', word_type: 'time_reference' },
  { word: 'atardi', meaning: 'afternoon/evening', word_type: 'time_reference' },
  { word: 'mainta', meaning: 'morning', word_type: 'time_reference' },
  { word: 'djadumingu', meaning: 'Sunday', word_type: 'time_reference' },
  { word: 'djuluna', meaning: 'Monday', word_type: 'time_reference' },
  { word: 'djarason', meaning: 'Wednesday', word_type: 'time_reference' },
  { word: 'djaweps', meaning: 'Thursday', word_type: 'time_reference' },
  { word: 'diabierna', meaning: 'Friday', word_type: 'time_reference' },
  { word: 'djasabra', meaning: 'Saturday', word_type: 'time_reference' },
  { word: 'siman', meaning: 'week', word_type: 'time_reference' },
  { word: 'luna', meaning: 'month', word_type: 'time_reference' },
  { word: 'aña', meaning: 'year', word_type: 'time_reference' },
  { word: 'awor', meaning: 'now', word_type: 'time_reference' },
  { word: 'ainda', meaning: 'still/yet', word_type: 'time_reference' },
  { word: 'pronto', meaning: 'soon', word_type: 'time_reference' },
  { word: 'lihé', meaning: 'quickly/soon', word_type: 'time_reference' },
  
  // Modifiers
  { word: 'grandi', meaning: 'big/large', word_type: 'product_modifier' },
  { word: 'chikitu', meaning: 'small', word_type: 'product_modifier' },
  { word: 'chiki', meaning: 'small (short form)', word_type: 'product_modifier' },
  { word: 'fresku', meaning: 'fresh', word_type: 'product_modifier' },
  { word: 'bon', meaning: 'good', word_type: 'product_modifier' },
  { word: 'maduro', meaning: 'ripe', word_type: 'product_modifier' },
  { word: 'madurado', meaning: 'ripened', word_type: 'product_modifier' },
  { word: 'bèrt', meaning: 'green (unripe)', word_type: 'product_modifier' },
  { word: 'korá', meaning: 'red', word_type: 'product_modifier' },
  { word: 'hel', meaning: 'yellow', word_type: 'product_modifier' },
  { word: 'blanku', meaning: 'white', word_type: 'product_modifier' },
  { word: 'pretu', meaning: 'black', word_type: 'product_modifier' },
  { word: 'dushi', meaning: 'sweet/delicious', word_type: 'product_modifier' },
  { word: 'stof', meaning: 'dry/dried', word_type: 'product_modifier' },
  { word: 'kongelá', meaning: 'frozen', word_type: 'product_modifier' },
  { word: 'limpi', meaning: 'clean', word_type: 'product_modifier' },
  
  // Actions/Verbs
  { word: 'manda', meaning: 'send', word_type: 'action' },
  { word: 'traha', meaning: 'make/prepare/bring', word_type: 'action' },
  { word: 'duna', meaning: 'give', word_type: 'action' },
  { word: 'bai', meaning: 'go', word_type: 'action' },
  { word: 'bini', meaning: 'come', word_type: 'action' },
  { word: 'pidi', meaning: 'ask for/request/order', word_type: 'action' },
  { word: 'kompra', meaning: 'buy', word_type: 'action' },
  { word: 'bende', meaning: 'sell', word_type: 'action' },
  { word: 'warda', meaning: 'wait/save', word_type: 'action' },
  { word: 'paga', meaning: 'pay', word_type: 'action' },
  { word: 'entrega', meaning: 'deliver', word_type: 'action' },
  { word: 'risibí', meaning: 'receive', word_type: 'action' },
  { word: 'buska', meaning: 'look for/get', word_type: 'action' },
  { word: 'ke', meaning: 'want', word_type: 'action' },
  { word: 'mester', meaning: 'need', word_type: 'action' },
  { word: 'por', meaning: 'can', word_type: 'action' },
  { word: 'kansel', meaning: 'cancel', word_type: 'action' },
  { word: 'kambia', meaning: 'change', word_type: 'action' },
  
  // Connectors
  { word: 'ku', meaning: 'with', word_type: 'connector' },
  { word: 'i', meaning: 'and', word_type: 'connector' },
  { word: 'of', meaning: 'or', word_type: 'connector' },
  { word: 'pa', meaning: 'for/to', word_type: 'connector' },
  { word: 'sin', meaning: 'without', word_type: 'connector' },
  { word: 'pero', meaning: 'but', word_type: 'connector' },
  { word: 'tambe', meaning: 'also/too', word_type: 'connector' },
  { word: 'anto', meaning: 'so/then', word_type: 'connector' },
  { word: 'pasobra', meaning: 'because', word_type: 'connector' },
  { word: 'si', meaning: 'if/yes', word_type: 'connector' },
  { word: 'no', meaning: 'no/not', word_type: 'connector' },
  { word: 'tin', meaning: 'have/there is', word_type: 'connector' },
  { word: 'ta', meaning: 'is/are (verb)', word_type: 'connector' },
  { word: 'di', meaning: 'of/from', word_type: 'connector' },
  { word: 'na', meaning: 'at/in', word_type: 'connector' },
  
  // Common Food Products
  { word: 'tomati', meaning: 'tomato', word_type: 'product_name' },
  { word: 'siboyo', meaning: 'onion', word_type: 'product_name' },
  { word: 'yerba', meaning: 'cilantro/herbs', word_type: 'product_name' },
  { word: 'komkòmber', meaning: 'cucumber', word_type: 'product_name' },
  { word: 'piperoni', meaning: 'pepper', word_type: 'product_name' },
  { word: 'lechuga', meaning: 'lettuce', word_type: 'product_name' },
  { word: 'sla', meaning: 'salad/lettuce', word_type: 'product_name' },
  { word: 'pampuna', meaning: 'pumpkin', word_type: 'product_name' },
  { word: 'batata', meaning: 'sweet potato', word_type: 'product_name' },
  { word: 'yuca', meaning: 'cassava/yuca', word_type: 'product_name' },
  { word: 'papaya', meaning: 'papaya', word_type: 'product_name' },
  { word: 'mango', meaning: 'mango', word_type: 'product_name' },
  { word: 'banana', meaning: 'banana', word_type: 'product_name' },
  { word: 'piña', meaning: 'pineapple', word_type: 'product_name' },
  { word: 'melon', meaning: 'melon', word_type: 'product_name' },
  { word: 'sandía', meaning: 'watermelon', word_type: 'product_name' },
  { word: 'limón', meaning: 'lemon/lime', word_type: 'product_name' },
  { word: 'naranja', meaning: 'orange', word_type: 'product_name' },
  { word: 'ahos', meaning: 'garlic', word_type: 'product_name' },
  { word: 'sinkuenta', meaning: 'fifty', word_type: 'quantity_phrase' },
  { word: 'shen', meaning: 'hundred', word_type: 'quantity_phrase' },
  
  // Greetings/Common Phrases
  { word: 'bon dia', meaning: 'good morning', word_type: 'greeting' },
  { word: 'bon tardi', meaning: 'good afternoon', word_type: 'greeting' },
  { word: 'bon nochi', meaning: 'good evening/night', word_type: 'greeting' },
  { word: 'danki', meaning: 'thank you', word_type: 'greeting' },
  { word: 'masha danki', meaning: 'thank you very much', word_type: 'greeting' },
  { word: 'por fabor', meaning: 'please', word_type: 'greeting' },
  { word: 'te aworo', meaning: 'see you', word_type: 'greeting' },
  { word: 'ayo', meaning: 'bye/hello', word_type: 'greeting' },
  { word: 'halo', meaning: 'hello', word_type: 'greeting' },
  { word: 'kon ta bai', meaning: 'how are you', word_type: 'greeting' },
];

interface DictionaryImportDialogProps {
  trigger?: React.ReactNode;
}

export function DictionaryImportDialog({ trigger }: DictionaryImportDialogProps) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("curated");
  const [customText, setCustomText] = useState("");
  const [selectedType, setSelectedType] = useState<string>("product_name");
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<{ success: number; skipped: number; errors: string[] }>({ success: 0, skipped: 0, errors: [] });
  const [selectedCategories, setSelectedCategories] = useState<string[]>(WORD_TYPES.map(t => t.value));
  
  const queryClient = useQueryClient();

  const parseCustomEntries = (text: string): DictionaryWord[] => {
    const lines = text.split('\n').filter(line => line.trim());
    const words: DictionaryWord[] = [];
    
    for (const line of lines) {
      // Support formats: "word = meaning" or "word: meaning" or "word - meaning" or "word    meaning"
      const match = line.match(/^([^=:\-\t]+)[=:\-\t]+(.+)$/);
      if (match) {
        words.push({
          word: match[1].trim().toLowerCase(),
          meaning: match[2].trim(),
          word_type: selectedType,
        });
      }
    }
    
    return words;
  };

  const importWords = async (words: DictionaryWord[]) => {
    setImporting(true);
    setProgress(0);
    setResults({ success: 0, skipped: 0, errors: [] });
    
    const successCount = { value: 0 };
    const skippedCount = { value: 0 };
    const errors: string[] = [];
    
    const batchSize = 50;
    const batches = Math.ceil(words.length / batchSize);
    
    for (let i = 0; i < batches; i++) {
      const batch = words.slice(i * batchSize, (i + 1) * batchSize);
      
      const { error } = await supabase
        .from('distribution_context_words')
        .upsert(
          batch.map(w => ({
            word: w.word.toLowerCase().trim(),
            word_type: w.word_type,
            meaning: w.meaning,
            language: 'pap',
            is_verified: true,
            usage_count: 0,
          })),
          { onConflict: 'word', ignoreDuplicates: true }
        );
      
      if (error) {
        errors.push(`Batch ${i + 1}: ${error.message}`);
      } else {
        successCount.value += batch.length;
      }
      
      setProgress(Math.round(((i + 1) / batches) * 100));
    }
    
    // Also add to translations table for full dictionary reference
    for (let i = 0; i < batches; i++) {
      const batch = words.slice(i * batchSize, (i + 1) * batchSize);
      
      await supabase
        .from('distribution_translations')
        .upsert(
          batch.map(w => ({
            papiamentu: w.word.toLowerCase().trim(),
            english: w.meaning,
            category: w.word_type,
            is_verified: true,
            source: 'dictionary_import',
          })),
          { onConflict: 'papiamentu', ignoreDuplicates: true }
        );
    }
    
    setResults({ success: successCount.value, skipped: skippedCount.value, errors });
    setImporting(false);
    
    queryClient.invalidateQueries({ queryKey: ['context-words'] });
    queryClient.invalidateQueries({ queryKey: ['pending-context-words-count'] });
    
    if (errors.length === 0) {
      toast.success(`Successfully imported ${successCount.value} words!`);
    } else {
      toast.warning(`Imported ${successCount.value} words with ${errors.length} errors`);
    }
  };

  const handleImportCurated = () => {
    const filteredWords = CURATED_WORDS.filter(w => selectedCategories.includes(w.word_type));
    importWords(filteredWords);
  };

  const handleImportCustom = () => {
    const words = parseCustomEntries(customText);
    if (words.length === 0) {
      toast.error("No valid entries found. Use format: word = meaning");
      return;
    }
    importWords(words);
  };

  const toggleCategory = (category: string) => {
    setSelectedCategories(prev => 
      prev.includes(category) 
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const curatedByType = WORD_TYPES.reduce((acc, type) => {
    acc[type.value] = CURATED_WORDS.filter(w => w.word_type === type.value);
    return acc;
  }, {} as Record<string, DictionaryWord[]>);

  const filteredCuratedCount = CURATED_WORDS.filter(w => selectedCategories.includes(w.word_type)).length;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" className="gap-2">
            <Upload className="h-4 w-4" />
            Import Dictionary
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Import Papiamentu Dictionary Words
          </DialogTitle>
          <DialogDescription>
            Import essential Papiamentu words to improve AI order parsing accuracy
          </DialogDescription>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="curated" className="gap-2">
              <Languages className="h-4 w-4" />
              Curated Words ({CURATED_WORDS.length})
            </TabsTrigger>
            <TabsTrigger value="custom" className="gap-2">
              <Upload className="h-4 w-4" />
              Custom Import
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="curated" className="space-y-4 mt-4">
            <div className="space-y-3">
              <Label>Select categories to import:</Label>
              <div className="flex flex-wrap gap-2">
                {WORD_TYPES.map(type => (
                  <Badge
                    key={type.value}
                    variant={selectedCategories.includes(type.value) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleCategory(type.value)}
                  >
                    {type.label} ({curatedByType[type.value]?.length || 0})
                  </Badge>
                ))}
              </div>
            </div>
            
            <ScrollArea className="h-[280px] border rounded-md p-3">
              <div className="space-y-4">
                {WORD_TYPES.filter(t => selectedCategories.includes(t.value)).map(type => (
                  <div key={type.value}>
                    <h4 className="font-medium text-sm mb-2">{type.label}</h4>
                    <div className="flex flex-wrap gap-2">
                      {curatedByType[type.value]?.map(word => (
                        <Badge key={word.word} variant="secondary" className="text-xs">
                          {word.word} → {word.meaning}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
            
            {importing && (
              <div className="space-y-2">
                <Progress value={progress} />
                <p className="text-sm text-muted-foreground text-center">Importing... {progress}%</p>
              </div>
            )}
            
            {results.success > 0 && !importing && (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                Successfully imported {results.success} words
              </div>
            )}
            
            {results.errors.length > 0 && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                {results.errors.length} errors occurred
              </div>
            )}
            
            <Button 
              onClick={handleImportCurated} 
              disabled={importing || filteredCuratedCount === 0}
              className="w-full"
            >
              <Upload className="h-4 w-4 mr-2" />
              Import {filteredCuratedCount} Words
            </Button>
          </TabsContent>
          
          <TabsContent value="custom" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Word Type</Label>
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WORD_TYPES.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Examples: {WORD_TYPES.find(t => t.value === selectedType)?.examples}
              </p>
            </div>
            
            <div className="space-y-2">
              <Label>Paste your words (one per line)</Label>
              <Textarea
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                placeholder={"kaha = box\ntros = bunch\nsiboyo = onion"}
                className="h-[200px] font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Supported formats: word = meaning, word: meaning, word - meaning
              </p>
            </div>
            
            {importing && (
              <div className="space-y-2">
                <Progress value={progress} />
                <p className="text-sm text-muted-foreground text-center">Importing... {progress}%</p>
              </div>
            )}
            
            <Button 
              onClick={handleImportCustom} 
              disabled={importing || !customText.trim()}
              className="w-full"
            >
              <Upload className="h-4 w-4 mr-2" />
              Import Custom Words
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
