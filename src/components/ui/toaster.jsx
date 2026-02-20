import { Toaster as SonnerToaster } from 'sonner';

export function Toaster() {
  return (
    <SonnerToaster
      position="top-center"
      toastOptions={{
        style: {
          direction: 'rtl',
        },
        className: 'rtl',
      }}
    />
  );
}
