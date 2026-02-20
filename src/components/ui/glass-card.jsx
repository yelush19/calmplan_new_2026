import * as React from "react"

import { cn } from "@/lib/utils"

const GlassCard = React.forwardRef(({ className, gradient, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-2xl",
      "border border-white/20",
      "bg-white/10 backdrop-blur-xl",
      "shadow-[0_8px_32px_rgba(0,0,0,0.12)]",
      "transition-all duration-300",
      "hover:shadow-[0_12px_48px_rgba(0,0,0,0.18)]",
      "hover:bg-white/15",
      className
    )}
    style={gradient ? { backgroundImage: gradient } : undefined}
    {...props}
  />
))
GlassCard.displayName = "GlassCard"

export { GlassCard }
