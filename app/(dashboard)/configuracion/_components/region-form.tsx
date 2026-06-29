'use client';

import { useState, useTransition } from 'react';
import { Globe, Coins } from 'lucide-react';
import { toast } from 'sonner';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { listCountries, getCountry, AR_CASAS } from '@/lib/countries';
import type { RegionInput } from '../schema';
import { updateUserSettings } from '../actions';

export function RegionForm({ initial }: { initial: RegionInput }) {
  const [pending, startTransition] = useTransition();
  const [region, setRegion] = useState<RegionInput>(initial);

  const country = getCountry(region.country);
  const countries = listCountries();

  function set<K extends keyof RegionInput>(key: K, value: RegionInput[K]) {
    setRegion((r) => ({ ...r, [key]: value }));
  }

  function save() {
    startTransition(async () => {
      const res = await updateUserSettings(region);
      if (!res.ok) toast.error(res.error ?? 'Error al guardar');
      else toast.success('Ajustes guardados');
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>País y moneda</CardTitle>
        <CardDescription>
          Define tu país (de ahí se toma la cotización del dólar) y en qué moneda
          ver el dashboard.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <Field
          icon={<Globe className="size-5" />}
          label="País"
          description="Se usa para traer la cotización del dólar y la moneda local."
        >
          <Select value={region.country} onValueChange={(v) => set('country', v)}>
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {countries.map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  <span className="mr-1">{c.flag}</span> {c.name}{' '}
                  <span className="text-muted-foreground">({c.currency})</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        {country.isArgentina && (
          <>
            <Separator />
            <Field
              icon={<Coins className="size-5" />}
              label="Casa del dólar"
              description="Argentina tiene varias cotizaciones; elegí cuál usar."
            >
              <Select value={region.arCasa} onValueChange={(v) => set('arCasa', v)}>
                <SelectTrigger className="w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AR_CASAS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </>
        )}

        <Separator />
        <Field
          icon={<Coins className="size-5" />}
          label="Ver dashboard en"
          description="Moneda en la que se muestran los totales."
        >
          <Select
            value={region.displayCurrency}
            onValueChange={(v) => set('displayCurrency', v as RegionInput['displayCurrency'])}
          >
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="local">Moneda local ({country.currency})</SelectItem>
              <SelectItem value="usd">Dólares (USD)</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        <div>
          <Button onClick={save} disabled={pending}>
            {pending ? 'Guardando…' : 'Guardar ajustes'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Field({
  icon,
  label,
  description,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <span className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-xl">
          {icon}
        </span>
        <div className="space-y-0.5">
          <Label>{label}</Label>
          <p className="text-muted-foreground text-sm">{description}</p>
        </div>
      </div>
      {children}
    </div>
  );
}
