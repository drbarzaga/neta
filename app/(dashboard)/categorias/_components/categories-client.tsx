'use client';

import { useState, useTransition } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { IconPicker } from '@/components/icon-picker';
import { useConfirm } from '@/components/confirm-provider';
import { cn } from '@/lib/utils';
import type { Category } from '@/db';
import { addCategory, updateCategory, deleteCategory } from '../actions';

export function CategoriesClient({ categories }: { categories: Category[] }) {
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState('');
  const [color, setColor] = useState('#10b981');
  const [icon, setIcon] = useState('tag');

  function add() {
    if (!name.trim()) return;
    startTransition(async () => {
      const res = await addCategory({ name, color, icon });
      if (!res.ok) toast.error(res.error ?? 'Error');
      else {
        toast.success('Categoría creada');
        setName('');
        setIcon('tag');
      }
    });
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Categorías</h1>
        <p className="text-muted-foreground mt-1 text-base">
          Organiza tus gastos. Se usan en todos los meses.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Nueva categoría</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="grid gap-1.5">
            <Label>Icono</Label>
            <IconPicker value={icon} color={color} onChange={setIcon} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="cat-color">Color</Label>
            <Input
              id="cat-color"
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-10 w-16 p-1"
            />
          </div>
          <div className="grid flex-1 gap-1.5">
            <Label htmlFor="cat-name">Nombre</Label>
            <Input
              id="cat-name"
              value={name}
              placeholder="Ej. AHORROS"
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && add()}
            />
          </div>
          <Button onClick={add} disabled={pending}>
            <Plus /> Agregar
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col divide-y p-0">
          {categories.length === 0 ? (
            <p className="text-muted-foreground p-6 text-center text-sm">
              Sin categorías todavía.
            </p>
          ) : (
            categories.map((c) => <CategoryRow key={c.id} category={c} />)
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function CategoryRow({ category }: { category: Category }) {
  const [pending, startTransition] = useTransition();
  const confirm = useConfirm();
  const [name, setName] = useState(category.name);

  function save(fields: { name?: string; color?: string; icon?: string }) {
    startTransition(async () => {
      const res = await updateCategory({ id: category.id, ...fields });
      if (!res.ok) toast.error(res.error ?? 'Error');
    });
  }

  async function remove() {
    const ok = await confirm({
      title: 'Eliminar categoría',
      description: `Se eliminará la categoría "${category.name}".`,
      confirmText: 'Eliminar',
      destructive: true,
    });
    if (!ok) return;
    startTransition(async () => {
      const res = await deleteCategory(category.id);
      if (!res.ok) toast.error(res.error ?? 'Error');
      else toast.success('Categoría eliminada');
    });
  }

  return (
    <div className={cn('flex items-center gap-3 p-3', pending && 'opacity-60')}>
      <IconPicker
        value={category.icon}
        color={category.color}
        onChange={(key) => save({ icon: key })}
      />
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => name.trim() && name !== category.name && save({ name })}
        className="flex-1"
      />
      <Input
        type="color"
        defaultValue={category.color}
        onBlur={(e) => e.target.value !== category.color && save({ color: e.target.value })}
        className="h-10 w-12 shrink-0 p-1"
        aria-label="Color"
      />
      <Button
        variant="ghost"
        size="icon"
        className="text-muted-foreground hover:text-destructive shrink-0"
        onClick={remove}
        disabled={pending}
        aria-label="Eliminar categoría"
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
}
