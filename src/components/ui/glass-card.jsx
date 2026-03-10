import * as React from "react"

import { cn } from "@/lib/utils"

const GlassCard = React.forwardRef(({ className, gradient, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-2xl",
      "border border-[#000000]",
      "bg-[#FFFFFF]",
      "shadow-none",
      "transition-all duration-300",
      "hover:shadow-none",
      "hover:bg-[#FFFFFF]",
      className
    )}
    style={gradient ? { backgroundImage: gradient } : undefined}
    {...props}
  />
))
GlassCard.displayName = "GlassCard"

export { GlassCard }
