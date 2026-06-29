'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { updateAppearance } from '../actions';

export function AppearanceForm({ initialEnabled }: { initialEnabled: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [enabled, setEnabled] = useState(initialEnabled);

  function toggle(v: boolean) {
    setEnabled(v);
    startTransition(async () => {
      const res = await updateAppearance({ animationsEnabled: v });
      if (!res.ok) {
        toast.error(res.error ?? 'Error al guardar');
        setEnabled(!v);
        return;
      }
      toast.success(v ? 'Animaciones activadas' : 'Animaciones desactivadas');
      // Aplica el cambio en toda la app (el provider vive en el layout).
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Apariencia</CardTitle>
        <CardDescription>Cómo se ve y se siente la interfaz.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span
              className={cn(
                'flex size-10 shrink-0 items-center justify-center rounded-xl transition-colors',
                enabled ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
              )}
            >
              <Wand2 className="size-5" />
            </span>
            <div className="space-y-0.5">
              <Label>Animaciones</Label>
              <p className="text-muted-foreground text-sm">
                Conteo de números, anillos y gráficas animadas. Desactivá para una
                experiencia más rápida y estática.
              </p>
            </div>
          </div>
          <Switch checked={enabled} onCheckedChange={toggle} disabled={pending} />
        </div>
      </CardContent>
    </Card>
  );
}
