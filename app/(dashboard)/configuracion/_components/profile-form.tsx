'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Check, CircleAlert } from 'lucide-react';
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
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { authClient } from '@/lib/auth-client';
import { checkEmailAvailable } from '../actions';

type EmailStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ProfileForm({
  initialName,
  initialEmail,
}: {
  initialName: string;
  initialEmail: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [emailStatus, setEmailStatus] = useState<EmailStatus>('idle');

  const nameChanged = name.trim() !== initialName && name.trim() !== '';
  const emailChanged =
    email.trim().toLowerCase() !== initialEmail.toLowerCase() &&
    email.trim() !== '';

  // Chequeo de disponibilidad del correo (con debounce), estilo Google.
  useEffect(() => {
    let active = true;
    const e = email.trim().toLowerCase();
    const handle = setTimeout(async () => {
      if (!active) return;
      if (e === '' || e === initialEmail.toLowerCase()) {
        setEmailStatus('idle');
        return;
      }
      if (!EMAIL_RE.test(e)) {
        setEmailStatus('invalid');
        return;
      }
      setEmailStatus('checking');
      try {
        const res = await checkEmailAvailable(e);
        if (active) setEmailStatus(res.available ? 'available' : 'taken');
      } catch {
        if (active) setEmailStatus('idle');
      }
    }, 450);
    return () => {
      active = false;
      clearTimeout(handle);
    };
  }, [email, initialEmail]);

  const emailOk = !emailChanged || emailStatus === 'available';
  const canSave = !pending && (nameChanged || emailChanged) && emailOk;

  function save() {
    if (!canSave) return;
    startTransition(async () => {
      if (nameChanged) {
        const { error } = await authClient.updateUser({ name: name.trim() });
        if (error) {
          toast.error(error.message ?? 'No se pudo actualizar el nombre');
          return;
        }
      }
      if (emailChanged) {
        const { error } = await authClient.changeEmail({
          newEmail: email.trim().toLowerCase(),
        });
        if (error) {
          toast.error(error.message ?? 'No se pudo cambiar el correo');
          return;
        }
      }
      toast.success('Perfil actualizado');
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Perfil</CardTitle>
        <CardDescription>Datos de tu cuenta.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="profile-name">Nombre</Label>
            <Input
              id="profile-name"
              value={name}
              autoComplete="name"
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && save()}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="profile-email">Email</Label>
            <Input
              id="profile-email"
              type="email"
              value={email}
              autoComplete="email"
              aria-invalid={emailStatus === 'taken' || emailStatus === 'invalid'}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && save()}
            />
            <EmailHint status={emailStatus} />
          </div>
        </div>

        <Button onClick={save} disabled={!canSave}>
          {pending ? 'Guardando…' : 'Guardar cambios'}
        </Button>
      </CardContent>
    </Card>
  );
}

function EmailHint({ status }: { status: EmailStatus }) {
  if (status === 'idle') return null;
  const map = {
    checking: { icon: Loader2, text: 'Comprobando…', cls: 'text-muted-foreground', spin: true },
    available: { icon: Check, text: 'Disponible', cls: 'text-emerald-600 dark:text-emerald-400', spin: false },
    taken: { icon: CircleAlert, text: 'Este correo ya está en uso', cls: 'text-destructive', spin: false },
    invalid: { icon: CircleAlert, text: 'Correo inválido', cls: 'text-destructive', spin: false },
  }[status];
  const Icon = map.icon;
  return (
    <p className={cn('flex items-center gap-1.5 text-xs', map.cls)}>
      <Icon className={cn('size-3.5', map.spin && 'animate-spin')} />
      {map.text}
    </p>
  );
}
