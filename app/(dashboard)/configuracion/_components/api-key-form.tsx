'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound, Check } from 'lucide-react';
import { toast } from 'sonner';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { updateAnthropicKey } from '../actions';

export function ApiKeyForm({ configured }: { configured: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(!configured);
  const [value, setValue] = useState('');

  function saveKey() {
    startTransition(async () => {
      const res = await updateAnthropicKey({ apiKey: value.trim() });
      if (!res.ok) {
        toast.error(res.error ?? 'No se pudo guardar');
        return;
      }
      toast.success('API key verificada y guardada');
      setValue('');
      setEditing(false);
      router.refresh();
    });
  }

  function removeKey() {
    startTransition(async () => {
      const res = await updateAnthropicKey({ apiKey: '' });
      if (!res.ok) {
        toast.error(res.error ?? 'No se pudo eliminar');
        return;
      }
      toast.success('API key eliminada');
      setValue('');
      setEditing(true);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Asesor con IA</CardTitle>
        <CardDescription>
          Pega tu API key para activar el asesor. Funciona con{' '}
          <a
            href="https://console.anthropic.com/settings/keys"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2"
          >
            Anthropic
          </a>{' '}
          o{' '}
          <a
            href="https://openrouter.ai/keys"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2"
          >
            OpenRouter
          </a>
          . Detectamos el proveedor y la verificamos automáticamente; se guarda
          cifrada y no se muestra de nuevo.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {configured && !editing ? (
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Check className="size-5" />
              </span>
              <div className="space-y-0.5">
                <p className="text-sm font-medium">API key configurada</p>
                <p className="text-muted-foreground text-sm">
                  El asesor está activo.
                </p>
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditing(true)}
                disabled={pending}
              >
                Cambiar
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive"
                onClick={removeKey}
                disabled={pending}
              >
                Eliminar
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-end gap-2">
            <div className="relative flex-1">
              <KeyRound className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input
                type="password"
                autoComplete="off"
                placeholder="Pega tu API key…"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (value.trim()) saveKey();
                  }
                }}
                className="pl-9 font-mono"
              />
            </div>
            <Button onClick={saveKey} disabled={pending || value.trim() === ''}>
              {pending ? 'Verificando…' : 'Guardar'}
            </Button>
            {configured && (
              <Button
                variant="ghost"
                onClick={() => {
                  setValue('');
                  setEditing(false);
                }}
                disabled={pending}
              >
                Cancelar
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
