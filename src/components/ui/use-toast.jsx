import { toast as sonnerToast } from 'sonner';

export function useToast() {
  return { toast, toasts: [], dismiss: () => {} };
}

export const toast = ({ title, description, variant = 'default', duration = 3000 }) => {
  if (variant === 'destructive') {
    sonnerToast.error(title, { description, duration });
  } else {
    sonnerToast.success(title, { description, duration });
  }
};
