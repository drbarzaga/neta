'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { RiBookmarkLine, RiCheckLine } from '@remixicon/react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { formatMoney } from '@/lib/money';
import { CategoryIcon } from '@/components/category-icon';
import type { TemplateRow } from '../../../plantillas/queries';
import { addExpensesFromTemplates } from '../actions';

/** Clave para emparejar una plantilla con un gasto ya presente en el mes. */
function key(categoryId: string, concept: string) {
  return `${categoryId}|${concept.trim().toLowerCase()}`;
}

export function AddFromTemplateDialog({
  periodId,
  templates,
  taken,
}: {
  periodId: string;
  templates: TemplateRow[];
  /** Claves (categoría|concepto) de gastos ya presentes en el mes. */
  taken?: Set<string>;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [pending, startTransition] = useTransition();

  // Solo ofrecemos plantillas que aún no estén cargadas en este mes.
  const available = taken
    ? templates.filter((t) => !taken.has(key(t.categoryId, t.concept)))
    : templates;

  const ids = Object.keys(selected).filter((k) => selected[k]);
  const allSelected = available.length > 0 && available.every((t) => selected[t.id]);

  function toggle(id: string) {
    setSelected((s) => ({ ...s, [id]: !s[id] }));
  }

  function toggleAll() {
    if (allSelected) {
      setSelected({});
    } else {
      setSelected(Object.fromEntries(available.map((t) => [t.id, true])));
    }
  }

  function confirm() {
    startTransition(async () => {
      const res = await addExpensesFromTemplates(periodId, ids);
      if (!res.ok) {
        toast.error(res.error ?? 'Error');
        return;
      }
      toast.success(`${res.data?.count ?? 0} gasto(s) agregado(s)`);
      setSelected({});
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <RiBookmarkLine /> Agregar desde plantilla
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="border-b px-6 py-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <DialogTitle>Agregar desde plantilla</DialogTitle>
              <DialogDescription>
                Elige los ítems reutilizables para insertar en este mes.
              </DialogDescription>
            </div>
            {available.length > 0 && (
              <Button type="button" variant="outline" size="sm" onClick={toggleAll} className="shrink-0">
                {allSelected ? 'Ninguna' : 'Todas'}
              </Button>
            )}
          </div>
        </DialogHeader>

        {templates.length === 0 ? (
          <div className="text-muted-foreground flex flex-col items-center gap-3 px-6 py-10 text-center text-sm">
            <RiBookmarkLine className="size-8" />
            <p>No tienes plantillas todavía.</p>
            <Button asChild variant="outline" size="sm">
              <Link href="/plantillas">Crear plantillas</Link>
            </Button>
          </div>
        ) : available.length === 0 ? (
          <div className="text-muted-foreground flex flex-col items-center gap-3 px-6 py-10 text-center text-sm">
            <RiBookmarkLine className="size-8" />
            <p>Ya agregaste todas tus plantillas a este mes.</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {available.map((t) => {
                const isSelected = !!selected[t.id];
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggle(t.id)}
                    className={cn(
                      'group relative flex flex-col gap-2 rounded-xl border p-3.5 text-left transition-colors',
                      isSelected
                        ? 'border-primary bg-primary/5'
                        : 'hover:bg-muted/60 hover:border-muted-foreground/30'
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span
                        className="flex size-9 shrink-0 items-center justify-center rounded-lg"
                        style={{ backgroundColor: `${t.categoryColor}33`, color: t.categoryColor }}
                      >
                        <CategoryIcon name={t.categoryIcon} className="size-4" />
                      </span>
                      <span
                        className={cn(
                          'flex size-5 shrink-0 items-center justify-center rounded-full border',
                          isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/30'
                        )}
                      >
                        {isSelected && <RiCheckLine className="size-3.5" />}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{t.concept}</p>
                      <p className="text-muted-foreground truncate text-xs">{t.categoryName}</p>
                    </div>
                    <p className="text-muted-foreground text-xs tabular-nums">
                      {t.amount ? formatMoney(t.amount, t.currency) : t.currency}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <DialogFooter className="border-t px-6 py-4">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={confirm} disabled={pending || ids.length === 0}>
            {pending ? 'Agregando…' : `Agregar ${ids.length || ''}`.trim()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
