'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { Plus, Trash2, Bookmark } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useConfirm } from '@/components/confirm-provider';
import type { TemplateRow } from '../queries';
import { addTemplate, updateTemplate, deleteTemplate } from '../actions';

interface Cat {
  id: string;
  name: string;
  color: string;
}

export function TemplatesClient({
  categories,
  templates,
}: {
  categories: Cat[];
  templates: TemplateRow[];
}) {
  const [pending, startTransition] = useTransition();
  const [concept, setConcept] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<'UYU' | 'USD'>('UYU');
  const [categoryId, setCategoryId] = useState<string>(categories[0]?.id ?? '');

  function add() {
    if (!concept.trim() || !categoryId) return;
    startTransition(async () => {
      const res = await addTemplate({
        concept,
        categoryId,
        amount: amount === '' ? 0 : Number(amount),
        currency,
      });
      if (!res.ok) toast.error(res.error ?? 'Error');
      else {
        toast.success('Plantilla creada');
        setConcept('');
        setAmount('');
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Plantillas</h1>
        <p className="text-muted-foreground mt-1 text-base">
          Ítems reutilizables (tarjetas, gastos fijos…) que puedes insertar en
          cualquier mes con un clic.
        </p>
      </div>

      {categories.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Bookmark className="text-muted-foreground size-10" />
            <p className="font-medium">Primero crea categorías</p>
            <p className="text-muted-foreground text-sm">
              Las plantillas necesitan una categoría.
            </p>
            <Button asChild variant="outline">
              <Link href="/categorias">Ir a Categorías</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Nueva plantilla</CardTitle>
              <CardDescription>
                Ej. “BROU USD” en Tarjetas, o “Alquiler” en Gastos fijos.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto_auto_auto]">
              <div className="grid gap-1.5">
                <Label htmlFor="t-concept">Concepto</Label>
                <Input
                  id="t-concept"
                  value={concept}
                  placeholder="Ej. BROU USD"
                  onChange={(e) => setConcept(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && add()}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Categoría</Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="t-amount">Monto</Label>
                <Input
                  id="t-amount"
                  inputMode="decimal"
                  placeholder="0"
                  className="w-28"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Moneda</Label>
                <Select value={currency} onValueChange={(v) => setCurrency(v as 'UYU' | 'USD')}>
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UYU">UYU</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={add} disabled={pending}>
                <Plus /> Agregar
              </Button>
            </CardContent>
          </Card>

          <Card className="overflow-hidden py-0">
            {templates.length === 0 ? (
              <CardContent className="text-muted-foreground py-12 text-center text-sm">
                Todavía no tienes plantillas.
              </CardContent>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Concepto</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    <TableHead>Mon.</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templates.map((t) => (
                    <TemplateLine key={t.id} template={t} categories={categories} />
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

function TemplateLine({
  template,
  categories,
}: {
  template: TemplateRow;
  categories: Cat[];
}) {
  const [pending, startTransition] = useTransition();
  const confirm = useConfirm();
  const [concept, setConcept] = useState(template.concept);
  const [amount, setAmount] = useState(template.amount ? String(template.amount) : '');

  function save(fields: Parameters<typeof updateTemplate>[0]) {
    startTransition(async () => {
      const res = await updateTemplate(fields);
      if (!res.ok) toast.error(res.error ?? 'Error');
    });
  }

  async function remove() {
    const ok = await confirm({
      title: 'Eliminar plantilla',
      description: `Se eliminará la plantilla "${template.concept}".`,
      confirmText: 'Eliminar',
      destructive: true,
    });
    if (!ok) return;
    startTransition(async () => {
      const res = await deleteTemplate(template.id);
      if (!res.ok) toast.error(res.error ?? 'Error');
      else toast.success('Plantilla eliminada');
    });
  }

  return (
    <TableRow className={pending ? 'opacity-60' : undefined}>
      <TableCell className="w-48">
        <Select
          value={template.categoryId}
          onValueChange={(v) => save({ id: template.id, categoryId: v })}
        >
          <SelectTrigger size="sm" className="w-full border-transparent bg-transparent hover:border-input">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Input
          value={concept}
          onChange={(e) => setConcept(e.target.value)}
          onBlur={() => {
            const t = concept.trim();
            if (t && t !== template.concept) save({ id: template.id, concept: t });
            else if (!t) setConcept(template.concept);
          }}
          className="border-transparent bg-transparent hover:border-input"
        />
      </TableCell>
      <TableCell className="w-32">
        <Input
          inputMode="decimal"
          value={amount}
          placeholder="0"
          onChange={(e) => setAmount(e.target.value)}
          onBlur={() => {
            const v = amount === '' ? 0 : Number(amount);
            if (!Number.isNaN(v) && v !== template.amount)
              save({ id: template.id, amount: v });
          }}
          className="border-transparent bg-transparent text-right tabular-nums hover:border-input"
        />
      </TableCell>
      <TableCell className="w-24">
        <Select
          value={template.currency}
          onValueChange={(v) => save({ id: template.id, currency: v as 'UYU' | 'USD' })}
        >
          <SelectTrigger size="sm" className="w-full border-transparent bg-transparent hover:border-input">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="UYU">UYU</SelectItem>
            <SelectItem value="USD">USD</SelectItem>
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground hover:text-destructive"
          onClick={remove}
          disabled={pending}
          aria-label="Eliminar plantilla"
        >
          <Trash2 className="size-4" />
        </Button>
      </TableCell>
    </TableRow>
  );
}
