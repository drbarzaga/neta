'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Fingerprint } from 'lucide-react';
import { authClient } from '@/lib/auth-client';
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
  name: z.string().min(2, 'Ingresa tu nombre'),
  email: z.email('Email inválido'),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
});

type Values = z.infer<typeof schema>;

export function RegisterForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  // Tras crear la cuenta ofrecemos registrar una passkey antes de entrar.
  const [step, setStep] = useState<'form' | 'passkey'>('form');
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '', password: '' },
  });

  function goHome() {
    router.push('/');
    router.refresh();
  }

  async function onSubmit(values: Values) {
    setLoading(true);
    const { error } = await authClient.signUp.email({
      name: values.name,
      email: values.email,
      password: values.password,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message ?? 'No se pudo crear la cuenta');
      return;
    }
    toast.success('Cuenta creada');
    // La sesión ya quedó iniciada: ofrecemos crear una passkey opcional.
    if (typeof window !== 'undefined' && window.PublicKeyCredential) {
      setStep('passkey');
      return;
    }
    goHome();
  }

  async function createPasskey() {
    setPasskeyLoading(true);
    const res = await authClient.passkey.addPasskey();
    setPasskeyLoading(false);
    if (res?.error) {
      const cancelled =
        'code' in res.error && res.error.code === 'ERROR_CEREMONY_ABORTED';
      if (!cancelled)
        toast.error(res.error.message ?? 'No se pudo crear la passkey');
      return;
    }
    toast.success('Passkey creada');
    goHome();
  }

  if (step === 'passkey') {
    return (
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl">Protege tu cuenta</CardTitle>
          <CardDescription className="text-base">
            Agrega una passkey para entrar sin contraseña con tu huella, rostro o
            PIN del dispositivo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-primary/10 text-primary mx-auto flex size-16 items-center justify-center rounded-2xl">
            <Fingerprint className="size-8" />
          </div>
        </CardContent>
        <CardFooter className="mt-2 flex flex-col gap-3">
          <Button
            type="button"
            size="lg"
            className="w-full"
            onClick={createPasskey}
            disabled={passkeyLoading}
          >
            <Fingerprint className="size-4" />
            {passkeyLoading ? 'Esperando…' : 'Crear passkey'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="lg"
            className="w-full"
            onClick={goHome}
            disabled={passkeyLoading}
          >
            Ahora no
          </Button>
          <p className="text-muted-foreground text-center text-xs">
            Podés agregarla más tarde desde Configuración.
          </p>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="text-2xl">Crear cuenta</CardTitle>
        <CardDescription className="text-base">Empieza a controlar tus gastos.</CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre</FormLabel>
                  <FormControl>
                    <Input autoComplete="name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="tu@email.com" autoComplete="email" {...field} />
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
                  <FormLabel>Contraseña</FormLabel>
                  <FormControl>
                    <Input type="password" autoComplete="new-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
          <CardFooter className="mt-4 flex flex-col gap-3">
            <Button type="submit" size="lg" className="w-full" disabled={loading}>
              {loading ? 'Creando…' : 'Crear cuenta'}
            </Button>
            <p className="text-muted-foreground text-center text-sm">
              ¿Ya tienes cuenta?{' '}
              <Link href="/login" className="text-primary hover:underline">
                Iniciar sesión
              </Link>
            </p>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
