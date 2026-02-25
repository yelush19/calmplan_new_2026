import React from "react";
import { Check } from "lucide-react";

export const Checkbox = ({ checked, onChange, onCheckedChange, disabled = false, className = "", id, ...props }) => {
  const handleClick = () => {
    if (disabled) return;
    const newValue = !checked;
    onChange?.(newValue);
    onCheckedChange?.(newValue);
  };

  return (
    <div
      id={id}
      role="checkbox"
      aria-checked={!!checked}
      className={`
        w-4 h-4 border-2 rounded cursor-pointer flex items-center justify-center transition-all
        ${checked ? 'bg-primary border-primary' : 'border-[#008291]/40 hover:border-[#008291]/60'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        ${className}
      `}
      onClick={handleClick}
      {...props}
    >
      {checked && <Check className="w-3 h-3 text-white" />}
    </div>
  );
};