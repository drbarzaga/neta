'use client';

import { useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { es } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

function toDate(iso?: string | null): Date | undefined {
  if (!iso) return undefined;
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function toIso(d?: Date): string | null {
  if (!d) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Rango del selector de año (acota el dropdown del calendario).
const NOW_YEAR = new Date().getFullYear();
const START_MONTH = new Date(NOW_YEAR - 5, 0);
const END_MONTH = new Date(NOW_YEAR + 10, 11);

/**
 * Selector de fecha propio (Popover + Calendar), en reemplazo del input nativo.
 * `value`/`onChange` trabajan con strings ISO (YYYY-MM-DD) o null.
 */
export function DatePicker({
  value,
  onChange,
  placeholder = 'Fecha',
  className,
}: {
  value: string | null | undefined;
  onChange: (iso: string | null) => void;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const date = toDate(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            'justify-start gap-2 font-normal',
            !date && 'text-muted-foreground',
            className
          )}
        >
          <CalendarDays className="size-4 shrink-0 opacity-70" />
          <span className="truncate">
            {date
              ? date.toLocaleDateString('es-UY', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })
              : placeholder}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="single"
          selected={date}
          onSelect={(d) => {
            onChange(toIso(d));
            setOpen(false);
          }}
          locale={es}
          captionLayout="dropdown"
          startMonth={START_MONTH}
          endMonth={END_MONTH}
          defaultMonth={date}
          autoFocus
        />
        {date && (
          <div className="border-t p-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground w-full"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
            >
              Borrar fecha
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
