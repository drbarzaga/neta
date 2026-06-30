'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Bookmark } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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

  function toggle(id: string) {
    setSelected((s) => ({ ...s, [id]: !s[id] }));
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
          <Bookmark /> Agregar desde plantilla
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Agregar desde plantilla</DialogTitle>
          <DialogDescription>
            Elige los ítems reutilizables para insertar en este mes.
          </DialogDescription>
        </DialogHeader>

        {templates.length === 0 ? (
          <div className="text-muted-foreground flex flex-col items-center gap-3 py-8 text-center text-sm">
            <Bookmark className="size-8" />
            <p>No tienes plantillas todavía.</p>
            <Button asChild variant="outline" size="sm">
              <Link href="/plantillas">Crear plantillas</Link>
            </Button>
          </div>
        ) : available.length === 0 ? (
          <div className="text-muted-foreground flex flex-col items-center gap-3 py-8 text-center text-sm">
            <Bookmark className="size-8" />
            <p>Ya agregaste todas tus plantillas a este mes.</p>
          </div>
        ) : (
          <div className="-mx-2 max-h-[50vh] overflow-y-auto px-2">
            <div className="flex flex-col gap-1">
              {available.map((t) => (
                <label
                  key={t.id}
                  className="hover:bg-muted/60 flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2.5"
                >
                  <Checkbox
                    checked={!!selected[t.id]}
                    onCheckedChange={() => toggle(t.id)}
                  />
                  <span
                    className="flex size-8 shrink-0 items-center justify-center rounded-lg"
                    style={{ backgroundColor: `${t.categoryColor}33`, color: t.categoryColor }}
                  >
                    <CategoryIcon name={t.categoryIcon} className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{t.concept}</p>
                    <p className="text-muted-foreground text-xs">{t.categoryName}</p>
                  </div>
                  <span className="text-muted-foreground text-sm tabular-nums">
                    {t.amount ? formatMoney(t.amount, t.currency) : t.currency}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        <DialogFooter>
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
