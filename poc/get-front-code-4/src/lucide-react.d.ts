declare module 'lucide-react' {
  import { ComponentType, SVGProps } from 'react';
  export type LucideIcon = ComponentType<SVGProps<SVGSVGElement> & { size?: number | string; strokeWidth?: number | string; }>;
  export const Search: LucideIcon;
  export const Loader2: LucideIcon;
  export const FolderOpen: LucideIcon;
  export const Clipboard: LucideIcon;
  export const Check: LucideIcon;
  export const ChevronsDown: LucideIcon;
  export const ChevronsUp: LucideIcon;
}
