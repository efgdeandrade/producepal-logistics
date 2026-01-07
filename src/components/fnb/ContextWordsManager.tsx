import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Check, X, Trash2, Plus, Languages, Search } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface ContextWord {
  id: string;
  word: string;
  word_type: string;
  meaning: string;
  language: string;
  usage_count: number;
  is_verified: boolean;
  examples: string[];
  created_at: string;
}

const WORD_TYPES = [
  { value: 'unit', label: 'Unit', color: 'bg-blue-500' },
  { value: 'quantity_phrase', label: 'Quantity', color: 'bg-green-500' },
  { value: 'product_modifier', label: 'Modifier', color: 'bg-purple-500' },
  { value: 'action', label: 'Action', color: 'bg-orange-500' },
  { value: 'connector', label: 'Connector', color: 'bg-gray-500' },
  { value: 'time_reference', label: 'Time', color: 'bg-pink-500' },
];

export function ContextWordsManager() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterVerified, setFilterVerified] = useState<string>("all");
  const [newWord, setNewWord] = useState({ word: "", word_type: "unit", meaning: "" });
  const [showAddForm, setShowAddForm] = useState(false);

  // Fetch context words
  const { data: words, isLoading } = useQuery({
    queryKey: ['context-words'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fnb_context_words')
        .select('*')
        .order('is_verified', { ascending: true })
        .order('usage_count', { ascending: false });
      
      if (error) throw error;
      return data as ContextWord[];
    }
  });

  // Verify word mutation
  const verifyMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('fnb_context_words')
        .update({ is_verified: true, verified_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['context-words'] });
      toast.success('Word verified!');
    },
    onError: () => {
      toast.error('Failed to verify word');
    }
  });

  // Delete word mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('fnb_context_words')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['context-words'] });
      toast.success('Word deleted');
    },
    onError: () => {
      toast.error('Failed to delete word');
    }
  });

  // Add word mutation
  const addMutation = useMutation({
    mutationFn: async (word: typeof newWord) => {
      const { error } = await supabase
        .from('fnb_context_words')
        .insert({
          word: word.word.toLowerCase().trim(),
          word_type: word.word_type,
          meaning: word.meaning,
          language: 'pap',
          is_verified: true,
          usage_count: 0,
          examples: []
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['context-words'] });
      toast.success('Word added!');
      setNewWord({ word: "", word_type: "unit", meaning: "" });
      setShowAddForm(false);
    },
    onError: (error: any) => {
      if (error.message?.includes('duplicate')) {
        toast.error('This word already exists');
      } else {
        toast.error('Failed to add word');
      }
    }
  });

  // Filter words
  const filteredWords = words?.filter(w => {
    const matchesSearch = !search || 
      w.word.toLowerCase().includes(search.toLowerCase()) ||
      w.meaning.toLowerCase().includes(search.toLowerCase());
    const matchesType = filterType === "all" || w.word_type === filterType;
    const matchesVerified = filterVerified === "all" || 
      (filterVerified === "verified" ? w.is_verified : !w.is_verified);
    return matchesSearch && matchesType && matchesVerified;
  }) || [];

  const pendingCount = words?.filter(w => !w.is_verified).length || 0;

  const getTypeBadge = (type: string) => {
    const t = WORD_TYPES.find(wt => wt.value === type);
    return t ? (
      <Badge variant="secondary" className={`${t.color} text-white`}>
        {t.label}
      </Badge>
    ) : <Badge variant="outline">{type}</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Languages className="h-5 w-5" />
              Papiamentu Dictionary
            </CardTitle>
            <CardDescription>
              Context words that help the AI understand local language
              {pendingCount > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {pendingCount} pending review
                </Badge>
              )}
            </CardDescription>
          </div>
          <Button onClick={() => setShowAddForm(!showAddForm)} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Add Word
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add new word form */}
        {showAddForm && (
          <Card className="border-primary/50 bg-primary/5">
            <CardContent className="pt-4">
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  placeholder="Word (e.g., kaha)"
                  value={newWord.word}
                  onChange={(e) => setNewWord({ ...newWord, word: e.target.value })}
                  className="flex-1"
                />
                <Select
                  value={newWord.word_type}
                  onValueChange={(v) => setNewWord({ ...newWord, word_type: v })}
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WORD_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Meaning (e.g., box/case)"
                  value={newWord.meaning}
                  onChange={(e) => setNewWord({ ...newWord, meaning: e.target.value })}
                  className="flex-1"
                />
                <Button 
                  onClick={() => addMutation.mutate(newWord)}
                  disabled={!newWord.word || !newWord.meaning || addMutation.isPending}
                >
                  Add
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search words..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {WORD_TYPES.map(t => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterVerified} onValueChange={setFilterVerified}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="verified">Verified</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Words table */}
        {isLoading ? (
          <div className="space-y-2">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="h-12 bg-muted animate-pulse rounded" />
            ))}
          </div>
        ) : (
          <ScrollArea className="h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Word</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Meaning</TableHead>
                  <TableHead className="text-center">Used</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredWords.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No words found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredWords.map(word => (
                    <TableRow key={word.id} className={!word.is_verified ? 'bg-yellow-50 dark:bg-yellow-950/20' : ''}>
                      <TableCell className="font-medium">{word.word}</TableCell>
                      <TableCell>{getTypeBadge(word.word_type)}</TableCell>
                      <TableCell className="text-muted-foreground">{word.meaning}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">{word.usage_count}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {word.is_verified ? (
                          <Badge variant="default" className="bg-green-600">
                            <Check className="h-3 w-3 mr-1" />
                            Verified
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Pending</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {!word.is_verified && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-green-600"
                              onClick={() => verifyMutation.mutate(word.id)}
                              disabled={verifyMutation.isPending}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive"
                            onClick={() => deleteMutation.mutate(word.id)}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
