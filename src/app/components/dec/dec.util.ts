import { ComunicacaoDecDTO, decPrecisaAtencao } from '../../models/comunicacao-dec.dto';
import { diasAte } from '../../pipes/formatos.pipe';

export type TomDec = 'danger' | 'warning' | 'info' | 'neutral' | 'success' | 'primary';

const PESO_URGENCIA: Record<string, number> = { CRITICA: 0, ALTA: 1, MEDIA: 2, BAIXA: 3, SEM_RISCO: 4 };
export const URGENCIAS_DEC = ['CRITICA', 'ALTA', 'MEDIA', 'BAIXA', 'SEM_RISCO'] as const;
const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

/** Comunicação aberta: sem encerramento no DEC. */
export function decAberta(c: ComunicacaoDecDTO): boolean {
  return !c.encerrada && c.status !== 'RESOLVIDA' && c.status !== 'ARQUIVADA';
}

/** Ainda sem ciência formal da empresa (e não encerrada). */
export function decSemCiencia(c: ComunicacaoDecDTO): boolean {
  return !c.cienteEm && decAberta(c);
}

/** Dias até a ciência tácita (recalculado a partir da data; cai no valor do backend). */
export function decDiasTacita(c: ComunicacaoDecDTO): number | null {
  return diasAte(c.cienciaTacitaEm) ?? c.diasRestantes ?? null;
}

/** Tom do contador de ciência tácita: ≤ 2 dias perigo, ≤ 5 atenção. */
export function decTomTacita(dias: number | null): TomDec {
  if (dias == null) return 'neutral';
  if (dias <= 2) return 'danger';
  if (dias <= 5) return 'warning';
  return 'neutral';
}

/** "hoje" · "amanhã" · "em 4 dias" · "há 3 dias" */
export function decRelativo(dias: number | null): string {
  if (dias == null) return '—';
  if (dias === 0) return 'hoje';
  if (dias === 1) return 'amanhã';
  if (dias === -1) return 'ontem';
  return dias > 0 ? `em ${dias} dias` : `há ${-dias} dias`;
}

/** Dias desde que chegou no DEC (0 = hoje). */
export function decDiasDesde(iso: string | null | undefined): number | null {
  const d = diasAte(iso);
  return d == null ? null : -d;
}

export function decChegouHa(iso: string | null | undefined): string {
  const d = decDiasDesde(iso);
  if (d == null) return '';
  if (d <= 0) return 'Hoje';
  if (d === 1) return 'Ontem';
  return `Há ${d} dias`;
}

export function decDia(iso: string | null | undefined): string {
  return iso ? iso.slice(8, 10) : '—';
}

export function decMes(iso: string | null | undefined): string {
  return iso ? MESES[Number(iso.slice(5, 7)) - 1] ?? '' : '';
}

export function decNomeEmpresa(c: ComunicacaoDecDTO): string {
  return c.nomeEmpresa || c.razaoSocial || 'Empresa não identificada';
}

/** Urgência (abertas primeiro) e, dentro dela, mais recentes primeiro. */
export function decOrdenar(lista: ComunicacaoDecDTO[], ordem: 'urgencia' | 'data' = 'urgencia'): ComunicacaoDecDTO[] {
  const data = (a: ComunicacaoDecDTO, b: ComunicacaoDecDTO) => (b.disponibilizadaEm ?? '').localeCompare(a.disponibilizadaEm ?? '');
  if (ordem === 'data') return [...lista].sort(data);
  const peso = (c: ComunicacaoDecDTO) =>
    (decPrecisaAtencao(c) ? 0 : decAberta(c) ? 10 : 20) + (PESO_URGENCIA[c.urgencia] ?? 5);
  return [...lista].sort((a, b) => peso(a) - peso(b) || data(a, b));
}

/** Menor prazo de ciência tácita (dias) entre as comunicações, ignorando as já vencidas. */
export function decMenorTacita(lista: ComunicacaoDecDTO[]): number | null {
  const d = lista.map(decDiasTacita).filter((n): n is number => n != null && n >= 0);
  return d.length ? Math.min(...d) : null;
}

/** "agora mesmo" · "há 5 min" · "há 2 h" · "em 03/10 às 14:20" */
export function decAtualizadoHa(iso: string | null | undefined, agora = Date.now()): string {
  if (!iso) return 'Ainda não sincronizado';
  const t = new Date(iso).getTime();
  if (isNaN(t)) return 'Ainda não sincronizado';
  const min = Math.floor((agora - t) / 60000);
  if (min < 1) return 'Atualizado agora mesmo';
  if (min < 60) return `Atualizado há ${min} min`;
  if (min < 24 * 60) return `Atualizado há ${Math.floor(min / 60)} h`;
  const d = new Date(t);
  const p = (n: number) => String(n).padStart(2, '0');
  return `Atualizado em ${p(d.getDate())}/${p(d.getMonth() + 1)} às ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function decNormalizar(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** queryParams para /empresas abrir o cadastro já preenchido com o CNPJ da comunicação. */
export function decParamsCadastro(c: ComunicacaoDecDTO): Record<string, string | number> {
  const p: Record<string, string | number> = { novo: 1, cnpj: (c.cnpj ?? '').replace(/\D/g, '') };
  if (c.razaoSocial) p['razao'] = c.razaoSocial;
  return p;
}
