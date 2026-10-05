import { ObrigacaoPendenteResponseDTO } from '../../models/obrigacao-pendente-response.dto';
import { StatusObrigacao } from '../../models/enums/status-obrigacao.enum';

/** Competência no formato do input month: "yyyy-MM". */
export type Ym = string;

export function ymDe(d: Date): Ym {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Soma meses a um "yyyy-MM". */
export function ymSomar(ym: Ym, meses: number): Ym {
  const [a, m] = ym.split('-').map(Number);
  return ymDe(new Date(a, m - 1 + meses, 1));
}

/** "2026-09" → "09/2026" */
export function ymRotulo(ym: Ym): string {
  const [a, m] = ym.split('-');
  return `${m}/${a}`;
}

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/** "2026-09" → "setembro de 2026" */
export function ymExtenso(ym: Ym): string {
  const [a, m] = ym.split('-').map(Number);
  return `${MESES[m - 1]} de ${a}`;
}

/** Primeiro e último dia do mês ("dd/MM/yyyy"). */
export function ymIntervalo(ym: Ym): [string, string] {
  const [a, m] = ym.split('-').map(Number);
  const fim = new Date(a, m, 0).getDate();
  const mm = String(m).padStart(2, '0');
  return [`01/${mm}/${a}`, `${fim}/${mm}/${a}`];
}

/** Mês ("yyyy-MM") de uma data ISO ("yyyy-MM-dd..."), ou null. */
export function ymDaData(iso: string | null | undefined): Ym | null {
  const m = /^(\d{4})-(\d{2})/.exec(iso ?? '');
  return m ? `${m[1]}-${m[2]}` : null;
}

/**
 * Competência da obrigação ("yyyy-MM"): usa o campo `competencia` ("MM/yyyy") do DTO;
 * se faltar (ou for anual), assume o mês anterior ao vencimento.
 */
export function competenciaDe(o: ObrigacaoPendenteResponseDTO): Ym | null {
  const c = /^(\d{2})\/(\d{4})$/.exec(o.competencia ?? '');
  if (c) return `${c[2]}-${c[1]}`;
  const venc = ymDaData(o.dataVencimento);
  return venc ? ymSomar(venc, -1) : null;
}

function hojeIso(): string {
  const d = new Date();
  return `${ymDe(d)}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Dias corridos de hoje até a data ISO (negativo se já passou); null se a data for inválida. */
export function diasAte(iso: string | null | undefined): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  if (!m) return null;
  const h = new Date();
  const hoje = Date.UTC(h.getFullYear(), h.getMonth(), h.getDate());
  return Math.round((Date.UTC(+m[1], +m[2] - 1, +m[3]) - hoje) / 86400000);
}

/** Situação efetiva: um PENDENTE com vencimento passado conta como vencida. */
export type Situacao = 'noPrazo' | 'atraso' | 'pendente' | 'vencida';

export function situacaoDe(o: ObrigacaoPendenteResponseDTO): Situacao {
  if (o.status === StatusObrigacao.ENTREGUE) {
    const ent = (o.dataEntrega ?? '').slice(0, 10);
    return ent && ent > o.dataVencimento.slice(0, 10) ? 'atraso' : 'noPrazo';
  }
  if (o.status === StatusObrigacao.VENCIDA || o.dataVencimento.slice(0, 10) < hojeIso()) return 'vencida';
  return 'pendente';
}

export interface Resumo {
  total: number;
  noPrazo: number;
  atraso: number;
  pendentes: number;
  vencidas: number;
  /** % de entregas no prazo entre as obrigações já resolvidas (entregues + vencidas); null sem base */
  taxa: number | null;
  guiasAPagar: number;
}

export function resumir(lista: ObrigacaoPendenteResponseDTO[]): Resumo {
  const r: Resumo = { total: lista.length, noPrazo: 0, atraso: 0, pendentes: 0, vencidas: 0, taxa: null, guiasAPagar: 0 };
  for (const o of lista) {
    const s = situacaoDe(o);
    if (s === 'noPrazo') r.noPrazo++;
    else if (s === 'atraso') r.atraso++;
    else if (s === 'vencida') r.vencidas++;
    else r.pendentes++;
    if (o.situacaoPagamento === 'AGUARDANDO' || o.situacaoPagamento === 'ATRASADO') r.guiasAPagar++;
  }
  const base = r.noPrazo + r.atraso + r.vencidas;
  r.taxa = base ? Math.round((r.noPrazo / base) * 100) : null;
  return r;
}

/** "yyyy-MM-dd..." → "dd/MM/yyyy" (ou "—"). */
export function dataBr(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '—';
}

export function moedaBr(v: number | null | undefined): string {
  return v == null || isNaN(+v) ? '—' : (+v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function cnpjBr(v: string | null | undefined): string {
  const d = String(v ?? '').replace(/\D/g, '');
  return d.length === 14 ? `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}` : (v || '—');
}

/** Valor da guia, se o backend já expõe o campo (opcional). */
export function valorGuiaDe(o: ObrigacaoPendenteResponseDTO): number | null {
  const v = (o as unknown as { valorGuia?: number | string | null }).valorGuia;
  return v == null || v === '' || isNaN(+v) ? null : +v;
}

// ---------------- CSV (Excel pt-BR: BOM UTF-8 + separador ;) ----------------

export type Celula = string | number | null | undefined;

function celulaCsv(c: Celula): string {
  if (c == null) return '';
  const s = typeof c === 'number' ? c.toLocaleString('pt-BR', { maximumFractionDigits: 2, useGrouping: false }) : String(c);
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function baixarCsv(nomeArquivo: string, linhas: Celula[][]): void {
  const csv = '﻿' + linhas.map(l => l.map(celulaCsv).join(';')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Nome de arquivo seguro: "Padaria Pão Quente" → "padaria-pao-quente" */
export function slug(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
