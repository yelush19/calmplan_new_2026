import React from "react";
import { Check } from "lucide-react";

export const Checkbox = ({ checked, onChange, disabled = false, className = "" }) => {
  return (
    <div
      className={`
        w-4 h-4 border-2 rounded cursor-pointer flex items-center justify-center transition-all
        ${checked ? 'bg-primary border-primary' : 'border-gray-300 hover:border-gray-400'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        ${className}
      `}
      onClick={() => !disabled && onChange?.(!checked)}
    >
      {checked && <Check className="w-3 h-3 text-white" />}
    </div>
  );
};