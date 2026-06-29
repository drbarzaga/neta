'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Papa from 'papaparse';
import { UploadCloud, Check } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
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
import { MONTHS_ES } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { parseSheet, type ParsedSheet } from '@/lib/sheet-parser';
import { importPeriod } from '../actions';

export function ImportClient() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const now = new Date();
  const [parsed, setParsed] = useState<ParsedSheet | null>(null);
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [income, setIncome] = useState('');
  const [rate, setRate] = useState('');

  function handleFile(file: File) {
    Papa.parse<string[]>(file, {
      skipEmptyLines: false,
      complete: (res) => {
        const sheet = parseSheet(res.data as string[][]);
        if (sheet.rows.length === 0) {
          toast.error('No se detectaron filas. ¿Es el CSV de la planilla?');
          return;
        }
        setParsed(sheet);
        setIncome(sheet.incomeTotal ? String(sheet.incomeTotal) : '');
        setRate(sheet.dollarRate ? String(sheet.dollarRate) : '');
        toast.success(`Detectados ${sheet.rows.length} gastos`);
      },
      error: () => toast.error('No se pudo leer el archivo'),
    });
  }

  function doImport() {
    if (!parsed) return;
    startTransition(async () => {
      const res = await importPeriod({
        year: Number(year),
        month: Number(month),
        incomeTotal: income === '' ? 0 : Number(income),
        dollarRate: rate === '' ? 0 : Number(rate),
        rows: parsed.rows,
      });
      if (!res.ok) {
        toast.error(res.error ?? 'No se pudo importar');
        return;
      }
      toast.success('Mes importado');
      if (res.data?.id) router.push(`/meses/${res.data.id}`);
    });
  }

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Importar planilla</h1>
        <p className="text-muted-foreground text-sm">
          Sube el CSV exportado de tu Google Sheet (una pestaña de mes).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>1. Archivo CSV</CardTitle>
          <CardDescription>
            En Google Sheets: Archivo → Descargar → CSV (de la pestaña del mes).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <label className="border-input hover:bg-muted/40 flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed p-8 text-center transition-colors">
            <UploadCloud className="text-muted-foreground size-8" />
            <span className="text-sm font-medium">Elige un archivo .csv</span>
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
          </label>
        </CardContent>
      </Card>

      {parsed && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>2. Datos del mes</CardTitle>
              <CardDescription>Revisa y ajusta antes de importar.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="grid gap-1.5">
                <Label>Mes</Label>
                <Select value={month} onValueChange={setMonth}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS_ES.map((m, i) => (
                      <SelectItem key={m} value={String(i + 1)}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="y">Año</Label>
                <Input id="y" value={year} onChange={(e) => setYear(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="inc">Ingreso total</Label>
                <Input id="inc" value={income} onChange={(e) => setIncome(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="rt">Dólar</Label>
                <Input id="rt" value={rate} onChange={(e) => setRate(e.target.value)} />
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden py-0">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <CardTitle className="text-base">
                3. Vista previa
              </CardTitle>
              <Badge variant="secondary">{parsed.rows.length} gastos</Badge>
            </div>
            <div className="max-h-96 overflow-auto">
              <Table>
                <TableHeader className="bg-background sticky top-0">
                  <TableRow>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Concepto</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Vencimiento</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsed.rows.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-muted-foreground text-xs">
                        {r.categoria}
                      </TableCell>
                      <TableCell>{r.concepto}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {r.amount ? formatMoney(r.amount, r.currency) : '—'}
                      </TableCell>
                      <TableCell className="capitalize">{r.status}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {r.dueDate ?? '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>

          <div>
            <Button onClick={doImport} disabled={pending} size="lg">
              <Check className="size-4" />
              {pending ? 'Importando…' : 'Importar mes'}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
