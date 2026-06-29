'use client';

import { useState } from 'react';
import { Fingerprint, Plus, Trash2, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { authClient } from '@/lib/auth-client';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

function formatDate(value: Date | string | null | undefined) {
  if (!value) return null;
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('es-UY', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function PasskeysForm() {
  const { data: passkeys, isPending, error } = authClient.useListPasskeys();
  const [name, setName] = useState('');
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function add() {
    if (!window.PublicKeyCredential) {
      toast.error('Tu navegador no soporta passkeys');
      return;
    }
    setAdding(true);
    const res = await authClient.passkey.addPasskey({
      name: name.trim() || undefined,
    });
    setAdding(false);
    // addPasskey devuelve undefined si todo salió bien; un objeto con .error si falló.
    if (res?.error) {
      const cancelled =
        'code' in res.error && res.error.code === 'ERROR_CEREMONY_ABORTED';
      if (!cancelled)
        toast.error(res.error.message ?? 'No se pudo agregar la passkey');
      return;
    }
    setName('');
    toast.success('Passkey agregada');
  }

  async function remove(id: string) {
    setDeletingId(id);
    const { error } = await authClient.passkey.deletePasskey({ id });
    setDeletingId(null);
    if (error) {
      toast.error(error.message ?? 'No se pudo eliminar');
      return;
    }
    toast.success('Passkey eliminada');
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Passkeys</CardTitle>
        <CardDescription>
          Inicia sesión sin contraseña con tu huella, rostro o PIN del
          dispositivo.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isPending ? (
          <p className="text-muted-foreground text-sm">Cargando…</p>
        ) : error ? (
          <p className="text-destructive text-sm">
            No se pudieron cargar las passkeys.
          </p>
        ) : passkeys && passkeys.length > 0 ? (
          <ul className="divide-border divide-y rounded-lg border">
            {passkeys.map((pk) => {
              const created = formatDate(pk.createdAt);
              return (
                <li key={pk.id} className="flex items-center gap-3 p-3">
                  <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
                    <KeyRound className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {pk.name || 'Passkey'}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {[pk.deviceType === 'singleDevice' ? 'Este dispositivo' : 'Sincronizada', created && `agregada ${created}`]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Eliminar passkey"
                    onClick={() => remove(pk.id)}
                    disabled={deletingId === pk.id}
                  >
                    <Trash2 className="text-destructive size-4" />
                  </Button>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="text-muted-foreground flex flex-col items-center gap-2 rounded-lg border border-dashed py-8 text-center text-sm">
            <Fingerprint className="size-6" />
            Aún no tenés passkeys.
          </div>
        )}

        <div className="flex items-end gap-2">
          <div className="grid flex-1 gap-1.5">
            <label className="text-sm font-medium" htmlFor="passkey-name">
              Nombre (opcional)
            </label>
            <Input
              id="passkey-name"
              placeholder="Ej. MacBook de Dayan"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  add();
                }
              }}
            />
          </div>
          <Button type="button" onClick={add} disabled={adding}>
            <Plus className="size-4" />
            {adding ? 'Esperando…' : 'Agregar passkey'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
