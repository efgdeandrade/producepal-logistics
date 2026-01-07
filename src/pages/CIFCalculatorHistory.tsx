import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../integrations/supabase/client";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";
import { toast } from "../hooks/use-toast";
import { Plus, Eye, Edit, Trash2, FileDown, Search, ArrowLeft } from "lucide-react";
import { format } from "date-fns";

interface CIFCalculation {
  id: string;
  calculation_name: string;
  calculation_type: 'estimate' | 'actual';
  created_at: string;
  total_pallets: number;
  total_chargeable_weight: number;
  selected_distribution_method: string;
  products: any[];
  notes: string;
}

const CIFCalculatorHistory = () => {
  const navigate = useNavigate();
  const [calculations, setCalculations] = useState<CIFCalculation[]>([]);
  const [filteredCalculations, setFilteredCalculations] = useState<CIFCalculation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    fetchCalculations();
  }, []);

  useEffect(() => {
    filterCalculations();
  }, [calculations, searchTerm, typeFilter]);

  const fetchCalculations = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('cif_calculations')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCalculations((data || []) as CIFCalculation[]);
    } catch (error) {
      console.error('Error fetching calculations:', error);
      toast({
        title: "Error",
        description: "Failed to load calculations",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const filterCalculations = () => {
    let filtered = calculations;

    if (searchTerm) {
      filtered = filtered.filter(calc =>
        calc.calculation_name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (typeFilter !== 'all') {
      filtered = filtered.filter(calc => calc.calculation_type === typeFilter);
    }

    setFilteredCalculations(filtered);
  };

  const handleLoad = (calculationId: string) => {
    navigate(`/cif-calculator?load=${calculationId}`);
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      const { error } = await supabase
        .from('cif_calculations')
        .delete()
        .eq('id', deleteId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Calculation deleted successfully"
      });

      fetchCalculations();
    } catch (error) {
      console.error('Error deleting calculation:', error);
      toast({
        title: "Error",
        description: "Failed to delete calculation",
        variant: "destructive"
      });
    } finally {
      setDeleteId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-3xl font-bold">CIF Calculator History</h1>
        </div>
        <Button onClick={() => navigate('/cif-calculator')}>
          <Plus className="mr-2 h-4 w-4" />
          New Calculation
        </Button>
      </div>

        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-4 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="estimate">Estimates</SelectItem>
                  <SelectItem value="actual">Actuals</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : filteredCalculations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No calculations found. Create your first one!
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Products</TableHead>
                    <TableHead>Weight (kg)</TableHead>
                    <TableHead>Pallets</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCalculations.map((calc) => (
                    <TableRow key={calc.id}>
                      <TableCell className="font-medium">{calc.calculation_name}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                          calc.calculation_type === 'estimate' 
                            ? 'bg-blue-100 text-blue-800' 
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {calc.calculation_type}
                        </span>
                      </TableCell>
                      <TableCell>{calc.products?.length || 0}</TableCell>
                      <TableCell>{calc.total_chargeable_weight?.toFixed(2) || 'N/A'}</TableCell>
                      <TableCell>{calc.total_pallets || 'N/A'}</TableCell>
                      <TableCell className="text-xs">{calc.selected_distribution_method || 'N/A'}</TableCell>
                      <TableCell>{format(new Date(calc.created_at), 'MMM dd, yyyy')}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleLoad(calc.id)}
                            title="Load calculation"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteId(calc.id)}
                            title="Delete calculation"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Calculation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this calculation? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CIFCalculatorHistory;