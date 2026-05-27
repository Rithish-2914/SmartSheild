import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface CyberCardProps {
  children: ReactNode;
  className?: string;
  title?: string;
  borderColor?: "primary" | "secondary" | "accent" | "destructive";
}

export function CyberCard({ children, className, title, borderColor = "primary" }: CyberCardProps) {
  const borderColors = {
    primary: "border-primary/50 shadow-primary/10",
    secondary: "border-secondary/50 shadow-secondary/10",
    accent: "border-accent/50 shadow-accent/10",
    destructive: "border-destructive/50 shadow-destructive/10",
  };

  const glowColors = {
    primary: "text-primary shadow-primary/20",
    secondary: "text-secondary shadow-secondary/20",
    accent: "text-accent shadow-accent/20",
    destructive: "text-destructive shadow-destructive/20",
  };

  return (
    <div className={cn(
      "relative bg-card/50 backdrop-blur-sm border rounded-xl overflow-hidden shadow-lg transition-all duration-300 hover:shadow-xl hover:border-opacity-100",
      borderColors[borderColor],
      className
    )}>
      {/* Corner decorations */}
      <div className={cn("absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 rounded-tl-xl", glowColors[borderColor].split(' ')[0])} />
      <div className={cn("absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 rounded-br-xl", glowColors[borderColor].split(' ')[0])} />

      {title && (
        <div className="px-6 py-4 border-b border-border/50 bg-black/20 flex items-center justify-between">
          <h3 className={cn("font-display font-bold uppercase tracking-wider text-glow", glowColors[borderColor])}>
            {title}
          </h3>
          <div className="flex gap-1">
            <div className={cn("w-2 h-2 rounded-full animate-pulse", `bg-${borderColor}`)} />
            <div className={cn("w-2 h-2 rounded-full animate-pulse delay-75 opacity-50", `bg-${borderColor}`)} />
          </div>
        </div>
      )}
      <div className="p-6 relative z-10">
        {children}
      </div>
      
      {/* Background grid overlay */}
      <div className="absolute inset-0 bg-grid-pattern opacity-10 pointer-events-none z-0" />
    </div>
  );
}
