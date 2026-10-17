import { NetaWordmark } from '@/components/brand/neta-wordmark';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="from-muted/60 via-background to-background relative flex min-h-svh flex-col items-center justify-center gap-8 bg-gradient-to-b p-6">
      <div
        aria-hidden
        className="bg-primary/10 absolute top-1/4 left-1/2 -z-10 size-[28rem] -translate-x-1/2 rounded-full blur-3xl"
      />
      <NetaWordmark className="h-14 w-auto" />
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
