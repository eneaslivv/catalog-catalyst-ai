import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive: "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
        success: "border-transparent bg-success text-success-foreground",
        warning: "border-transparent bg-warning text-warning-foreground",
        info: "border-transparent bg-info text-info-foreground",
        // Status badges
        uploaded: "border-transparent bg-status-uploaded text-info-foreground",
        parsed: "border-transparent bg-status-parsed text-primary-foreground",
        aiReady: "border-transparent bg-status-ai-ready text-warning-foreground",
        verified: "border-transparent bg-status-verified text-success-foreground",
        published: "border-transparent bg-status-published text-primary-foreground",
        failed: "border-transparent bg-status-failed text-destructive-foreground",
        // Confidence badges
        confidenceHigh: "border-transparent bg-confidence-high/20 text-confidence-high",
        confidenceMedium: "border-transparent bg-confidence-medium/20 text-confidence-medium",
        confidenceLow: "border-transparent bg-confidence-low/20 text-confidence-low",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
