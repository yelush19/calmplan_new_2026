import * as React from "react"
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils"
import { getBranchStyle, normalizeBranchKey } from "@/lib/branchStyles"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-3 py-0.5 text-xs font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground shadow-sm hover:bg-primary/80",
        secondary:
          "border-[#E0E0E0] bg-white text-secondary-foreground hover:bg-[#EEEEEE]",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/80",
        outline: "text-foreground border-[#E0E0E0]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

/**
 * Badge
 *
 * Extensions over the base shadcn Badge:
 * - `branch` prop — pass 'P1'..'P6' (or a Hebrew label / task category) to
 *   get DesignContext-aware branch colors via CSS vars. Any user palette
 *   override propagates live without re-rendering this component.
 * - `branchVariant` — 'soft' (default), 'solid', or 'outline'.
 *
 * Other props behave exactly like the upstream shadcn Badge.
 */
function Badge({
  className,
  variant,
  branch,
  branchVariant = 'soft',
  style,
  ...props
}) {
  const resolvedBranch = branch ? normalizeBranchKey(branch) : null;
  const branchStyle = resolvedBranch
    ? getBranchStyle(resolvedBranch, { variant: branchVariant })
    : null;

  return (
    <div
      className={cn(badgeVariants({ variant }), className)}
      style={branchStyle ? { ...branchStyle, ...style } : style}
      {...props}
    />
  );
}

export { Badge, badgeVariants }
