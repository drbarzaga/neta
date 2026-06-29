'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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

const schema = z.object({ password: z.string().min(8, 'Mínimo 8 caracteres') });
type Values = z.infer<typeof schema>;

export function ResetPasswordForm({
  token,
  invalid,
}: {
  token?: string;
  invalid?: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { password: '' },
  });

  async function onSubmit(values: Values) {
    if (!token) return;
    setLoading(true);
    const { error } = await authClient.resetPassword({
      newPassword: values.password,
      token,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message ?? 'No se pudo restablecer la contraseña');
      return;
    }
    toast.success('Contraseña actualizada');
    router.push('/login');
  }

  if (invalid || !token) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Enlace inválido</CardTitle>
          <CardDescription>
            El enlace expiró o no es válido. Solicita uno nuevo.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Link href="/forgot-password" className="text-primary text-sm hover:underline">
            Pedir nuevo enlace
          </Link>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nueva contraseña</CardTitle>
        <CardDescription>Elige una contraseña segura.</CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent>
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
          <CardFooter className="mt-4">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Guardando…' : 'Restablecer contraseña'}
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
