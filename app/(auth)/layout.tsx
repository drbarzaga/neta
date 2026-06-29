import { Wallet } from 'lucide-react';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="from-muted/60 via-background to-background relative flex min-h-svh flex-col items-center justify-center gap-8 bg-gradient-to-b p-6">
      <div
        aria-hidden
        className="bg-primary/10 absolute top-1/4 left-1/2 -z-10 size-[28rem] -translate-x-1/2 rounded-full blur-3xl"
      />
      <div className="flex items-center gap-3 text-2xl font-semibold tracking-tight">
        <div className="bg-primary text-primary-foreground flex size-11 items-center justify-center rounded-2xl shadow-lg shadow-primary/25">
          <Wallet className="size-6" />
        </div>
        Neta
      </div>
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
