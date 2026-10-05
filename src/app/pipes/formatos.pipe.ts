import { Pipe, PipeTransform } from '@angular/core';

/** (63) 99999-0001 / (63) 3215-0001 a partir de dígitos. */
@Pipe({ name: 'telefone', standalone: true })
export class TelefonePipe implements PipeTransform {
  transform(v: string | null | undefined): string {
    if (!v) return '—';
    const d = String(v).replace(/\D/g, '');
    if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
    if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return v;
  }
}

/** CNPJ (14 dígitos) ou CPF (11 dígitos) formatados; mantém o valor se já vier formatado. */
@Pipe({ name: 'documento', standalone: true })
export class DocumentoPipe implements PipeTransform {
  transform(v: string | null | undefined): string {
    if (!v) return '—';
    const d = String(v).replace(/\D/g, '');
    if (d.length === 14) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
    if (d.length === 11) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
    return v;
  }
}

/** 1536 → "1,5 KB" */
@Pipe({ name: 'bytes', standalone: true })
export class BytesPipe implements PipeTransform {
  transform(v: number | null | undefined): string {
    if (v == null || isNaN(v)) return '—';
    if (v < 1024) return `${v} B`;
    const un = ['KB', 'MB', 'GB', 'TB'];
    let n = v / 1024, i = 0;
    while (n >= 1024 && i < un.length - 1) { n /= 1024; i++; }
    return `${n.toLocaleString('pt-BR', { maximumFractionDigits: n < 10 ? 1 : 0 })} ${un[i]}`;
  }
}

/**
 * Prazo relativo a partir de "dias para vencer" (número) ou de uma data ISO.
 * 0 → "Vence hoje", 1 → "Vence amanhã", 5 → "Em 5 dias", -3 → "Venceu há 3 dias"
 */
@Pipe({ name: 'prazo', standalone: true })
export class PrazoPipe implements PipeTransform {
  transform(v: number | string | null | undefined): string {
    const dias = diasAte(v);
    if (dias == null) return '—';
    if (dias === 0) return 'Vence hoje';
    if (dias === 1) return 'Vence amanhã';
    if (dias === -1) return 'Venceu ontem';
    if (dias < 0) return `Venceu há ${-dias} dias`;
    return `Em ${dias} dias`;
  }
}

/** Classe de cor para um prazo: 'danger' | 'warning' | 'success' | 'neutral' */
@Pipe({ name: 'prazoTom', standalone: true })
export class PrazoTomPipe implements PipeTransform {
  transform(v: number | string | null | undefined): 'danger' | 'warning' | 'success' | 'neutral' {
    const dias = diasAte(v);
    if (dias == null) return 'neutral';
    if (dias < 0 || dias <= 1) return 'danger';
    if (dias <= 7) return 'warning';
    return 'success';
  }
}

/** Iniciais para avatar: "Padaria Pão Quente" → "PP" */
@Pipe({ name: 'iniciais', standalone: true })
export class IniciaisPipe implements PipeTransform {
  transform(v: string | null | undefined): string {
    if (!v) return '?';
    const partes = v.replace(/@.*/, '').split(/[\s._-]+/).filter(p => p.length > 1 || /\d/.test(p));
    if (!partes.length) return v.charAt(0).toUpperCase();
    return (partes[0][0] + (partes[1]?.[0] ?? '')).toUpperCase();
  }
}

/** Cor estável de avatar (c1..c6) derivada do texto. */
@Pipe({ name: 'avatarCor', standalone: true })
export class AvatarCorPipe implements PipeTransform {
  transform(v: string | number | null | undefined): string {
    const s = String(v ?? '');
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return 'c' + ((h % 6) + 1);
  }
}

export function diasAte(v: number | string | null | undefined): number | null {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return v;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  if (!m) return null;
  const alvo = new Date(+m[1], +m[2] - 1, +m[3]);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return Math.round((alvo.getTime() - hoje.getTime()) / 86400000);
}

export const FORMATOS = [TelefonePipe, DocumentoPipe, BytesPipe, PrazoPipe, PrazoTomPipe, IniciaisPipe, AvatarCorPipe] as const;
