
// Simple toast implementation for immediate feedback
let sonnerToast;

try {
  // Try to import sonner if available
  // Using a dynamic import with await. This makes the module's initialization asynchronous.
  // This is valid in environments supporting top-level await (e.g., modern Node.js, bundlers like Webpack/Vite).
  const sonner = await import('sonner');
  sonnerToast = sonner.toast;
} catch (error) {
  // Sonner not available, will use fallback
  sonnerToast = null;
}

export const toast = ({ title, description, variant = 'default', duration = 3000 }) => {
  if (sonnerToast) {
    // If sonnerToast was successfully imported, use it
    if (variant === 'destructive') {
      sonnerToast.error(title, {
        description,
        duration,
      });
    } else {
      sonnerToast.success(title, {
        description,
        duration,
      });
    }
  } else {
    // Fallback - simple alert if sonnerToast is null (meaning import failed or sonner not installed)
    alert(`${title}\n${description}`);
  }
};
