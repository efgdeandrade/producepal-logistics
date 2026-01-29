import * as React from 'react';
import { Check, ChevronsUpDown, Sparkles, CheckCircle, AlertTriangle, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';

interface ProductMatchDropdownProps {
  products: any[];
  value: string | null;
  confidence: 'high' | 'medium' | 'low' | 'none';
  wasManuallyChanged?: boolean;
  itemDescription?: string;
  onChange: (productId: string | null) => void;
}

export function ProductMatchDropdown({
  products,
  value,
  confidence,
  wasManuallyChanged,
  itemDescription = '',
  onChange,
}: ProductMatchDropdownProps) {
  const [open, setOpen] = React.useState(false);
  
  const selectedProduct = products.find(p => p.id === value);
  
  // Create search terms that include code, name, and common variations
  const options = React.useMemo(() => products.map(p => ({
    value: p.id,
    label: `${p.code} - ${p.name}`,
    searchTerms: `${p.code} ${p.name} ${p.name.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
  })), [products]);

  const getConfidenceBadge = () => {
    // If user manually changed, show "Will Learn" badge
    if (wasManuallyChanged && value) {
      return (
        <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 text-xs gap-1 shrink-0">
          <Sparkles className="h-3 w-3" />
          Learn
        </Badge>
      );
    }
    
    switch (confidence) {
      case 'high':
        return (
          <Badge variant="default" className="bg-green-500 text-white text-xs gap-1 shrink-0">
            <CheckCircle className="h-3 w-3" />
            Verified
          </Badge>
        );
      case 'medium':
        return (
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300 text-xs gap-1 shrink-0">
            <Sparkles className="h-3 w-3" />
            AI Match
          </Badge>
        );
      case 'low':
        return (
          <Badge variant="secondary" className="bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300 text-xs gap-1 shrink-0">
            <AlertTriangle className="h-3 w-3" />
            Low
          </Badge>
        );
      case 'none':
        return (
          <Badge variant="destructive" className="text-xs gap-1 shrink-0">
            <HelpCircle className="h-3 w-3" />
            Select
          </Badge>
        );
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "w-full justify-between font-normal min-w-[200px]",
              !value && "text-muted-foreground"
            )}
          >
            <span className="truncate max-w-[200px]">
              {selectedProduct ? `${selectedProduct.code} - ${selectedProduct.name}` : "Select product..."}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent 
          className="w-[350px] p-0" 
          align="start"
          side="bottom"
          sideOffset={4}
        >
          <Command shouldFilter={true}>
            <CommandInput 
              placeholder="Search products..." 
              className="h-9"
            />
            <CommandList className="max-h-[300px]">
              <CommandEmpty>No products found.</CommandEmpty>
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.searchTerms}
                    onSelect={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                    className="cursor-pointer"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4 shrink-0",
                        value === option.value ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="truncate">{option.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {getConfidenceBadge()}
    </div>
  );
}