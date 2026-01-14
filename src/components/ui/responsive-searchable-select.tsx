import * as React from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { SearchableSelect, SearchableSelectOption } from "./searchable-select";
import { MobileSearchableSelect } from "@/components/mobile/MobileSearchableSelect";

interface ResponsiveSearchableSelectProps {
  options: SearchableSelectOption[];
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

/**
 * Responsive searchable select that uses:
 * - Drawer (bottom sheet) on mobile for better UX
 * - Popover on desktop for familiar behavior
 */
export function ResponsiveSearchableSelect(props: ResponsiveSearchableSelectProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return <MobileSearchableSelect {...props} />;
  }

  return <SearchableSelect {...props} />;
}
