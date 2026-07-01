'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Fingerprint, Clock } from 'lucide-react';
import { authClient } from '@/lib/auth-client';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';

const schema = z.object({
  email: z.email('Email inválido'),
  password: z.string().min(1, 'Ingresa tu contraseña'),
});

type Values = z.infer<typeof schema>;

interface AuthError {
  message?: string;
  code?: string;
}

/** El usuario cerró/canceló el diálogo del navegador (no es un fallo real). */
function isCancelledPasskey(error: AuthError): boolean {
  const text = `${error.code ?? ''} ${error.message ?? ''}`.toLowerCase();
  return (
    text.includes('cancel') ||
    text.includes('abort') ||
    text.includes('not allowed') ||
    text.includes('notallowed')
  );
}

/** Mensaje en español para los fallos de passkey más comunes. */
function translatePasskeyError(error: AuthError): string {
  const text = `${error.code ?? ''} ${error.message ?? ''}`.toLowerCase();
  if (text.includes('timeout') || text.includes('timed out')) {
    return 'Se agotó el tiempo para usar la passkey. Intenta de nuevo.';
  }
  if (text.includes('no passkey') || text.includes('not found') || text.includes('no credentials')) {
    return 'No encontramos una passkey en este dispositivo.';
  }
  return 'No se pudo iniciar sesión con passkey. Intenta de nuevo.';
}

export function LoginForm({ expired = false }: { expired?: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  // Método con el que el usuario inició sesión la última vez (cookie).
  const [lastMethod, setLastMethod] = useState<string | null>(null);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  function goHome() {
    router.push('/');
    router.refresh();
  }

  useEffect(() => {
    // Conditional UI: si el navegador soporta autofill de WebAuthn, ofrece
    // las passkeys directamente en el campo de email.
    let active = true;
    void (async () => {
      setLastMethod(authClient.getLastUsedLoginMethod());
      if (
        typeof PublicKeyCredential === 'undefined' ||
        !PublicKeyCredential.isConditionalMediationAvailable
      )
        return;
      const available =
        await PublicKeyCredential.isConditionalMediationAvailable();
      if (!available || !active) return;
      const { error } = await authClient.signIn.passkey({ autoFill: true });
      if (!error && active) goHome();
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSubmit(values: Values) {
    setLoading(true);
    const { error } = await authClient.signIn.email({
      email: values.email,
      password: values.password,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message ?? 'No se pudo iniciar sesión');
      return;
    }
    goHome();
  }

  async function onPasskey() {
    setPasskeyLoading(true);
    const { error } = await authClient.signIn.passkey();
    setPasskeyLoading(false);
    if (error) {
      // Si el usuario cancela el diálogo del navegador no es un fallo: no molestamos.
      if (isCancelledPasskey(error)) return;
      toast.error(translatePasskeyError(error));
      return;
    }
    goHome();
  }

  const lastUsed = (method: string) =>
    lastMethod === method ? (
      <Badge variant="secondary" className="ml-2 text-[0.7rem] font-normal">
        Última vez
      </Badge>
    ) : null;

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="text-2xl">Iniciar sesión</CardTitle>
        <CardDescription className="text-base">Accede a tu gestor de gastos.</CardDescription>
        {expired && (
          <Alert className="mt-2">
            <Clock className="size-4" />
            <AlertDescription>
              Tu sesión se cerró por inactividad. Inicia sesión de nuevo.
            </AlertDescription>
          </Alert>
        )}
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="tu@email.com" autoComplete="email webauthn" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel>Contraseña</FormLabel>
                    <Link
                      href="/forgot-password"
                      className="text-muted-foreground text-xs hover:underline"
                    >
                      ¿Olvidaste tu contraseña?
                    </Link>
                  </div>
                  <FormControl>
                    <Input type="password" autoComplete="current-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
          <CardFooter className="mt-4 flex flex-col gap-3">
            <Button type="submit" size="lg" className="w-full" disabled={loading}>
              {loading ? 'Ingresando…' : 'Ingresar'}
              {lastUsed('email')}
            </Button>

            <div className="flex w-full items-center gap-3">
              <span className="bg-border h-px flex-1" />
              <span className="text-muted-foreground text-xs">o</span>
              <span className="bg-border h-px flex-1" />
            </div>

            <Button
              type="button"
              variant="outline"
              size="lg"
              className="w-full"
              onClick={onPasskey}
              disabled={passkeyLoading}
            >
              <Fingerprint className="size-4" />
              {passkeyLoading ? 'Esperando…' : 'Ingresar con passkey'}
              {lastUsed('passkey')}
            </Button>

            <p className="text-muted-foreground text-center text-sm">
              ¿No tienes cuenta?{' '}
              <Link href="/register" className="text-primary hover:underline">
                Crear cuenta
              </Link>
            </p>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
