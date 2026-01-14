import * as React from "react";
import { Check, Search, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

export interface MobileSearchableSelectOption {
  value: string;
  label: string;
  searchTerms?: string;
}

interface MobileSearchableSelectProps {
  options: MobileSearchableSelectOption[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  emptyMessage?: string;
  addNewLabel?: string;
  onAddNew?: () => void;
  addNewIcon?: React.ReactNode;
  disabled?: boolean;
  className?: string;
  onSelectComplete?: () => void;
  triggerRef?: React.Ref<HTMLButtonElement>;
}

export function MobileSearchableSelect({
  options,
  value,
  onValueChange,
  placeholder = "Select...",
  emptyMessage = "No results found.",
  addNewLabel,
  onAddNew,
  addNewIcon,
  disabled = false,
  className,
  onSelectComplete,
  triggerRef,
}: MobileSearchableSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  const selectedOption = options.find((option) => option.value === value);

  // Filter options based on search
  const filteredOptions = React.useMemo(() => {
    if (!search.trim()) return options;
    const searchLower = search.toLowerCase();
    return options.filter((option) => {
      const searchText = option.searchTerms || option.label;
      return searchText.toLowerCase().includes(searchLower);
    });
  }, [options, search]);

  // Focus input when drawer opens
  React.useEffect(() => {
    if (open) {
      // Small delay to ensure drawer animation completes
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    } else {
      setSearch("");
    }
  }, [open]);

  const handleSelect = (optionValue: string) => {
    onValueChange(optionValue);
    setOpen(false);
    onSelectComplete?.();
  };

  return (
    <>
      <Button
        ref={triggerRef}
        variant="outline"
        role="combobox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen(true)}
        className={cn(
          "w-full justify-between font-normal h-12 text-base",
          !value && "text-muted-foreground",
          className
        )}
      >
        <span className="truncate">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader className="border-b pb-4">
            <div className="flex items-center justify-between">
              <DrawerTitle>{placeholder}</DrawerTitle>
              <DrawerClose asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <X className="h-4 w-4" />
                </Button>
              </DrawerClose>
            </div>
            {/* Sticky search input */}
            <div className="relative mt-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                ref={inputRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="pl-10 h-12 text-base"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
              />
            </div>
          </DrawerHeader>

          {/* Scrollable options list */}
          <div 
            className="flex-1 overflow-y-auto overscroll-contain px-4 pb-safe"
            style={{ 
              maxHeight: 'calc(85vh - 140px)',
              WebkitOverflowScrolling: 'touch'
            }}
          >
            {/* Add new option */}
            {onAddNew && addNewLabel && (
              <button
                onClick={() => {
                  onAddNew();
                  setOpen(false);
                }}
                className="flex items-center w-full py-4 px-3 text-primary font-medium border-b touch-manipulation"
              >
                {addNewIcon || <Plus className="mr-3 h-5 w-5" />}
                {addNewLabel}
              </button>
            )}

            {/* Options list */}
            {filteredOptions.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                {emptyMessage}
              </div>
            ) : (
              <div className="py-2">
                {filteredOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => handleSelect(option.value)}
                    className={cn(
                      "flex items-center w-full py-4 px-3 text-left rounded-lg transition-colors touch-manipulation",
                      "min-h-[52px] active:bg-accent",
                      value === option.value
                        ? "bg-primary/10 text-primary"
                        : "hover:bg-muted"
                    )}
                  >
                    <Check
                      className={cn(
                        "mr-3 h-5 w-5 shrink-0",
                        value === option.value ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="text-base">{option.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
