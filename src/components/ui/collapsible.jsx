import React from "react";

export const Collapsible = ({ children, open, onOpenChange, ...props }) => {
  return (
    <div {...props}>
      {React.Children.map(children, child => {
        // Add a check to ensure the child is a valid React element before cloning
        if (React.isValidElement(child)) {
          return React.cloneElement(child, { open, onOpenChange });
        }
        // Return non-element children (like booleans from conditional rendering) as is
        return child;
      })}
    </div>
  );
};

export const CollapsibleTrigger = React.forwardRef(({ children, open, onOpenChange, ...props }, ref) => {
  return (
    <div 
      ref={ref} 
      onClick={() => onOpenChange?.(!open)} 
      {...props}
    >
      {children}
    </div>
  );
});

export const CollapsibleContent = ({ children, open }) => {
  if (!open) return null;
  
  return (
    <div className="animate-in slide-in-from-top-1">
      {children}
    </div>
  );
};