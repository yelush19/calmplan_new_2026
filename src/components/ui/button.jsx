import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B8DB8]/30 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 motion-reduce:transition-none",
  {
    variants: {
      variant: {
        default:
          "bg-[#5B8DB8] text-white hover:bg-[#2A5A8A] hover:-translate-y-px",
        destructive:
          "bg-[#FDF2EE] text-[#9A3E1E] hover:bg-[#E07B54] hover:text-white",
        outline:
          "border border-[#EEF1F5] bg-white text-[#1A2332] hover:bg-[#EFF4FA] hover:border-[#5B8DB8]",
        secondary:
          "bg-[#EFF4FA] text-[#5B8DB8] hover:bg-[#DBEAFE]",
        ghost: "text-[#1A2332] hover:bg-[#EFF4FA]",
        link: "text-[#5B8DB8] underline-offset-4 hover:underline hover:text-[#2A5A8A]",
      },
      size: {
        default: "h-10 px-6 py-2.5",
        sm: "h-8 px-4 text-xs",
        lg: "h-11 px-8 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button"
  return (
    (<Comp
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props} />)
  );
})
Button.displayName = "Button"

export { Button, buttonVariants }
