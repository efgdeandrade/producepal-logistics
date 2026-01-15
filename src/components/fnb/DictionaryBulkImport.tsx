import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Upload, CheckCircle, AlertCircle, Loader2, BookOpen, FileSpreadsheet } from "lucide-react";
import * as XLSX from 'xlsx';

interface ImportStats {
  total: number;
  inserted: number;
  updated: number;
  skipped: number;
  errors: number;
}

interface DictionaryEntry {
  word: string;
  type: string;
  meaning: string;
  usage: string;
  extra: string;
}

export function DictionaryBulkImport() {
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stats, setStats] = useState<ImportStats | null>(null);
  const [markAsVerified, setMarkAsVerified] = useState(false);
  const [parsedEntries, setParsedEntries] = useState<DictionaryEntry[]>([]);
  const queryClient = useQueryClient();

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      // Convert to JSON - the data starts from row 1 (no headers)
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
        header: ['word', 'type', 'meaning', 'usage', 'extra'],
        defval: ''
      }) as DictionaryEntry[];
      
      // Filter out empty rows and clean data
      const validEntries = jsonData.filter(row => 
        row.word && 
        typeof row.word === 'string' && 
        row.word.trim().length > 0 &&
        row.meaning &&
        typeof row.meaning === 'string' &&
        row.meaning.trim().length > 0
      );
      
      setParsedEntries(validEntries);
      toast.success(`Parsed ${validEntries.length} dictionary entries`);
    } catch (error) {
      console.error('Parse error:', error);
      toast.error('Failed to parse Excel file');
    }
  };

  const startImport = async () => {
    if (parsedEntries.length === 0) {
      toast.error('No entries to import');
      return;
    }

    setIsImporting(true);
    setProgress(0);
    setStats(null);

    try {
      // Process in chunks to show progress
      const chunkSize = 500;
      let totalInserted = 0;
      let totalErrors = 0;
      
      for (let i = 0; i < parsedEntries.length; i += chunkSize) {
        const chunk = parsedEntries.slice(i, i + chunkSize);
        
        const { data, error } = await supabase.functions.invoke('import-dictionary', {
          body: { 
            words: chunk,
            markAsVerified 
          }
        });

        if (error) {
          console.error('Chunk error:', error);
          totalErrors += chunk.length;
        } else if (data?.stats) {
          totalInserted += data.stats.inserted;
          totalErrors += data.stats.errors;
        }

        // Update progress
        const progressPercent = Math.round(((i + chunk.length) / parsedEntries.length) * 100);
        setProgress(progressPercent);
      }

      setStats({
        total: parsedEntries.length,
        inserted: totalInserted,
        updated: 0,
        skipped: 0,
        errors: totalErrors,
      });

      // Refresh the context words query
      queryClient.invalidateQueries({ queryKey: ['context-words'] });
      queryClient.invalidateQueries({ queryKey: ['pending-context-words-count'] });

      toast.success(`Imported ${totalInserted} words successfully!`);
    } catch (error) {
      console.error('Import error:', error);
      toast.error('Import failed');
    } finally {
      setIsImporting(false);
    }
  };

  const resetImport = () => {
    setParsedEntries([]);
    setStats(null);
    setProgress(0);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="h-5 w-5" />
          Bulk Dictionary Import
        </CardTitle>
        <CardDescription>
          Import Papiamentu-English dictionary from Excel file
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!stats && (
          <>
            {parsedEntries.length === 0 ? (
              <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
                <FileSpreadsheet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">
                  Upload your Papiamentu dictionary Excel file
                </p>
                <Label htmlFor="dictionary-file" className="cursor-pointer">
                  <input
                    id="dictionary-file"
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <Button asChild variant="outline">
                    <span>
                      <Upload className="h-4 w-4 mr-2" />
                      Select Excel File
                    </span>
                  </Button>
                </Label>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                  <div>
                    <p className="font-medium">Ready to import</p>
                    <p className="text-sm text-muted-foreground">
                      {parsedEntries.length.toLocaleString()} dictionary entries parsed
                    </p>
                  </div>
                  <Badge variant="secondary" className="text-lg">
                    {parsedEntries.length.toLocaleString()} words
                  </Badge>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="verify-all"
                    checked={markAsVerified}
                    onCheckedChange={setMarkAsVerified}
                  />
                  <Label htmlFor="verify-all" className="text-sm">
                    Mark all words as verified (skip review)
                  </Label>
                </div>

                {isImporting && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Importing...</span>
                      <span>{progress}%</span>
                    </div>
                    <Progress value={progress} />
                  </div>
                )}

                <div className="flex gap-2">
                  <Button 
                    onClick={startImport} 
                    disabled={isImporting}
                    className="flex-1"
                  >
                    {isImporting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Importing...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Start Import
                      </>
                    )}
                  </Button>
                  <Button variant="outline" onClick={resetImport} disabled={isImporting}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </>
        )}

        {stats && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle className="h-6 w-6" />
              <span className="font-medium text-lg">Import Complete!</span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-muted rounded-lg text-center">
                <p className="text-2xl font-bold">{stats.total.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Total Processed</p>
              </div>
              <div className="p-4 bg-green-100 dark:bg-green-950 rounded-lg text-center">
                <p className="text-2xl font-bold text-green-600">{stats.inserted.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Imported</p>
              </div>
            </div>

            {stats.errors > 0 && (
              <div className="flex items-center gap-2 text-amber-600 p-3 bg-amber-50 dark:bg-amber-950/50 rounded-lg">
                <AlertCircle className="h-5 w-5" />
                <span>{stats.errors} entries had errors and were skipped</span>
              </div>
            )}

            <Button onClick={resetImport} className="w-full">
              Import Another File
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
