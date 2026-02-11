import React from "react";
import { Button } from "@/components/ui/button";

export const ToggleGroup = ({ children, type = "single", value, onValueChange, className = "" }) => {
  const handleToggle = (itemValue) => {
    if (type === "single") {
      onValueChange(value === itemValue ? null : itemValue);
    } else if (type === "multiple") {
      const currentValues = value || [];
      if (currentValues.includes(itemValue)) {
        onValueChange(currentValues.filter(v => v !== itemValue));
      } else {
        onValueChange([...currentValues, itemValue]);
      }
    }
  };

  return (
    <div className={`flex gap-2 ${className}`}>
      {React.Children.map(children, child => 
        React.cloneElement(child, { onToggle: handleToggle, selectedValues: value })
      )}
    </div>
  );
};

export const ToggleGroupItem = ({ children, value, onToggle, selectedValues, className = "" }) => {
  const isSelected = Array.isArray(selectedValues) ? selectedValues.includes(value) : selectedValues === value;
  
  return (
    <Button
      variant={isSelected ? "default" : "outline"}
      size="sm"
      onClick={() => onToggle(value)}
      className={`${className} ${isSelected ? 'bg-primary text-white' : ''}`}
    >
      {children}
    </Button>
  );
};