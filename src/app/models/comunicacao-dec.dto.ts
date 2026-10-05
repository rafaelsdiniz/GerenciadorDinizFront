/** Comunicação do DEC (Domicílio Eletrônico do Contribuinte · SEFAZ-TO), sincronizada do DEC Monitor. Somente leitura. */
export interface ComunicacaoDecDTO {
  id: number;
  idExterno: string;
  idEmpresa: number | null;
  nomeEmpresa: string | null;
  cnpj: string;
  razaoSocial: string | null;
  numero: string | null;
  tipo: TipoComunicacaoDec | string;
  assunto: string;
  corpo: string | null;
  remetente: string | null;
  disponibilizadaEm: string;
  cienteEm: string | null;
  prazoCienciaEm: string | null;
  diasParaResposta: number | null;
  coletadaEm: string | null;
  status: StatusComunicacaoDec | string;
  urgencia: UrgenciaDec | string;
  motivo: string | null;
  /** dias até a ciência tácita (negativo = já passou) */
  diasRestantes: number | null;
  cienciaTacitaEm: string | null;
  prazoRespostaEm: string | null;
  encerrada: boolean;
  temInteiroTeor: boolean;
  link: string | null;
  sincronizadaEm: string | null;
}

export interface StatusIntegracaoDec {
  configurada: boolean;
  url?: string | null;
  ultimaSincronizacao?: string | null;
  ultimoErro?: string | null;
  ultimoTotal?: number;
  ultimasNovas?: number;
  escritorio?: string | null;
  semEmpresa?: number;
}

export interface ResultadoSincronizacaoDec {
  recebidas: number;
  novas: number;
  atualizadas: number;
  semEmpresa: number;
}

export type TipoComunicacaoDec = 'NOTIFICACAO' | 'INTIMACAO' | 'ALERTA' | 'COMUNICADO' | 'INFORMATIVO' | 'AVISO' | 'DOCUMENTO_ADMINISTRATIVO';
export type StatusComunicacaoDec = 'NOVA' | 'EM_ANDAMENTO' | 'RESOLVIDA' | 'ARQUIVADA';
export type UrgenciaDec = 'CRITICA' | 'ALTA' | 'MEDIA' | 'BAIXA' | 'SEM_RISCO';

export const TipoDecLabel: Record<string, string> = {
  NOTIFICACAO: 'Notificação',
  INTIMACAO: 'Intimação',
  ALERTA: 'Alerta',
  COMUNICADO: 'Comunicado',
  INFORMATIVO: 'Informativo',
  AVISO: 'Aviso',
  DOCUMENTO_ADMINISTRATIVO: 'Documento administrativo'
};

export const StatusDecLabel: Record<string, string> = {
  NOVA: 'Nova',
  EM_ANDAMENTO: 'Em andamento',
  RESOLVIDA: 'Resolvida',
  ARQUIVADA: 'Arquivada'
};

export const UrgenciaDecLabel: Record<string, string> = {
  CRITICA: 'Crítica',
  ALTA: 'Alta',
  MEDIA: 'Média',
  BAIXA: 'Baixa',
  SEM_RISCO: 'Sem risco'
};

/** Tom visual (classe badge-*) por urgência. */
export function tomUrgenciaDec(u: string | null | undefined): 'danger' | 'warning' | 'info' | 'neutral' | 'success' {
  switch (u) {
    case 'CRITICA': return 'danger';
    case 'ALTA': return 'warning';
    case 'MEDIA': return 'info';
    case 'BAIXA': return 'neutral';
    default: return 'success';
  }
}

/** Tom visual por status no DEC. */
export function tomStatusDec(s: string | null | undefined): 'primary' | 'warning' | 'success' | 'neutral' {
  switch (s) {
    case 'NOVA': return 'primary';
    case 'EM_ANDAMENTO': return 'warning';
    case 'RESOLVIDA': return 'success';
    default: return 'neutral';
  }
}

/**
 * Precisa de atenção: está aberta (sem ciência, não encerrada nem resolvida/arquivada) e
 * é crítica/alta OU vira ciência tácita em até 3 dias — mesmo sendo de urgência baixa.
 */
export function decPrecisaAtencao(c: ComunicacaoDecDTO): boolean {
  const aberta = !c.cienteEm && !c.encerrada && c.status !== 'RESOLVIDA' && c.status !== 'ARQUIVADA';
  if (!aberta) return false;
  const urgente = c.urgencia === 'CRITICA' || c.urgencia === 'ALTA';
  const tacitaProxima = c.diasRestantes != null && c.diasRestantes <= 3;
  return urgente || tacitaProxima;
}
