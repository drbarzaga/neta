'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
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

const schema = z.object({ email: z.email('Email inválido') });
type Values = z.infer<typeof schema>;

export function ForgotPasswordForm() {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: '' },
  });

  async function onSubmit(values: Values) {
    setLoading(true);
    const { error } = await authClient.requestPasswordReset({
      email: values.email,
      redirectTo: '/reset-password',
    });
    setLoading(false);
    if (error) {
      toast.error(error.message ?? 'No se pudo enviar el correo');
      return;
    }
    setSent(true);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recuperar contraseña</CardTitle>
        <CardDescription>
          Te enviaremos un enlace para restablecerla.
        </CardDescription>
      </CardHeader>
      {sent ? (
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Si el email existe, recibirás un correo con el enlace para
            restablecer tu contraseña.
          </p>
        </CardContent>
      ) : (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent>
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="tu@email.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
            <CardFooter className="mt-4">
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Enviando…' : 'Enviar enlace'}
              </Button>
            </CardFooter>
          </form>
        </Form>
      )}
      <CardFooter>
        <Link href="/login" className="text-muted-foreground text-sm hover:underline">
          Volver a iniciar sesión
        </Link>
      </CardFooter>
    </Card>
  );
}
