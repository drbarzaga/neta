'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { CATEGORY_ICON_KEYS } from '@/lib/category-icons';
import { CategoryIcon } from '@/components/category-icon';

export function IconPicker({
  value,
  color = '#64748b',
  onChange,
  size = 'default',
}: {
  value: string;
  color?: string;
  onChange: (key: string) => void;
  size?: 'default' | 'sm';
}) {
  const [open, setOpen] = useState(false);
  const dim = size === 'sm' ? 'size-8' : 'size-10';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Elegir icono"
          className={cn(
            'flex shrink-0 items-center justify-center rounded-xl transition-transform hover:scale-105',
            dim
          )}
          style={{ backgroundColor: `${color}33`, color }}
        >
          <CategoryIcon name={value} className={size === 'sm' ? 'size-4' : 'size-5'} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="start">
        <div className="grid grid-cols-7 gap-1">
          {CATEGORY_ICON_KEYS.map((key) => {
            const active = key === value;
            return (
              <Button
                key={key}
                type="button"
                variant="ghost"
                size="icon"
                className={cn('size-9', active && 'bg-primary/10 text-primary ring-1 ring-primary/30')}
                onClick={() => {
                  onChange(key);
                  setOpen(false);
                }}
              >
                <CategoryIcon name={key} className="size-4" />
              </Button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
