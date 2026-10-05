import { CertidaoResponseDTO, SituacaoCertidao, StatusValidade, TipoCertidao } from '../../models/certidao.dto';

export type Tom = 'success' | 'warning' | 'danger' | 'neutral';

export interface TipoInfo {
  id: TipoCertidao;
  /** rótulo completo (tabela, formulário) */
  rotulo: string;
  /** rótulo curto (cabeçalho da matriz, chips) */
  curto: string;
  icone: string;
  /** órgão emissor sugerido no formulário */
  orgao: string;
  /** validade usual em dias (sugestão de data no formulário) */
  validadeDias: number;
}

export const TIPOS: TipoInfo[] = [
  { id: 'FEDERAL', rotulo: 'CND Federal', curto: 'Federal', icone: 'landmark', orgao: 'Receita Federal do Brasil / PGFN', validadeDias: 180 },
  { id: 'ESTADUAL', rotulo: 'CND Estadual', curto: 'Estadual', icone: 'map-pin', orgao: 'SEFAZ-TO - Secretaria da Fazenda do Tocantins', validadeDias: 60 },
  { id: 'MUNICIPAL', rotulo: 'CND Municipal', curto: 'Municipal', icone: 'building', orgao: 'Prefeitura de Palmas - Secretaria de Finanças', validadeDias: 90 },
  { id: 'FGTS', rotulo: 'CRF FGTS', curto: 'FGTS', icone: 'banknote', orgao: 'Caixa Econômica Federal (CRF)', validadeDias: 30 },
  { id: 'TRABALHISTA', rotulo: 'CNDT Trabalhista', curto: 'Trabalhista', icone: 'briefcase', orgao: 'Tribunal Superior do Trabalho (CNDT)', validadeDias: 180 },
  { id: 'FALENCIA', rotulo: 'Certidão de Falência', curto: 'Falência', icone: 'scale', orgao: 'TJTO - Distribuidor Cível', validadeDias: 30 },
  { id: 'OUTRA', rotulo: 'Outra certidão', curto: 'Outra', icone: 'file-text', orgao: '', validadeDias: 30 },
];

/** Colunas da matriz empresas × tipos (OUTRA fica de fora) */
export const TIPOS_MATRIZ = TIPOS.filter(t => t.id !== 'OUTRA');

const TIPO_MAP = new Map(TIPOS.map(t => [t.id, t]));
export const tipoInfo = (t: TipoCertidao): TipoInfo => TIPO_MAP.get(t) ?? TIPOS[TIPOS.length - 1];

export const SITUACOES: { id: SituacaoCertidao; rotulo: string; curto: string }[] = [
  { id: 'NEGATIVA', rotulo: 'Negativa', curto: 'Negativa' },
  { id: 'POSITIVA_COM_EFEITO_DE_NEGATIVA', rotulo: 'Positiva com efeito de negativa', curto: 'Positiva c/ efeito neg.' },
  { id: 'POSITIVA', rotulo: 'Positiva (com débitos)', curto: 'Positiva' },
];

export function situacaoRotulo(s: SituacaoCertidao, curto = false): string {
  const x = SITUACOES.find(i => i.id === s);
  return x ? (curto ? x.curto : x.rotulo) : s;
}

export function situacaoClasse(s: SituacaoCertidao): string {
  return s === 'NEGATIVA' ? 'badge-success' : s === 'POSITIVA' ? 'badge-danger' : 'badge-info';
}

export const STATUS_ROTULO: Record<StatusValidade, string> = {
  VALIDA: 'Válida',
  VENCENDO: 'Vencendo',
  VENCIDA: 'Vencida',
};

/** Tom da certidão: vencida ou positiva (com débitos) = perigo; vencendo = atenção. */
export function tomCertidao(c: CertidaoResponseDTO): Tom {
  if (c.statusValidade === 'VENCIDA' || c.situacao === 'POSITIVA') return 'danger';
  if (c.statusValidade === 'VENCENDO') return 'warning';
  return 'success';
}

/** Badge do prazo: vencida → danger · até 15 dias → warning · demais → neutro/sucesso */
export function prazoTexto(dias: number): string {
  if (dias === 0) return 'Vence hoje';
  if (dias === 1) return 'Vence amanhã';
  if (dias === -1) return 'Venceu ontem';
  if (dias < 0) return `Venceu há ${-dias} dias`;
  return `${dias} dias`;
}

export function prazoClasse(dias: number): string {
  if (dias <= 0) return 'badge-danger';
  if (dias <= 15) return 'badge-warning';
  return 'badge-success';
}

/** Ordem de urgência: vencidas, vencendo, válidas; dentro do grupo, menor prazo primeiro. */
export function porUrgencia(a: CertidaoResponseDTO, b: CertidaoResponseDTO): number {
  const peso = (c: CertidaoResponseDTO) => c.statusValidade === 'VENCIDA' ? 0 : c.statusValidade === 'VENCENDO' ? 1 : 2;
  return peso(a) - peso(b) || a.diasParaVencer - b.diasParaVencer || a.nomeEmpresa.localeCompare(b.nomeEmpresa);
}

export function hojeIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function somarDias(iso: string, dias: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d + dias);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

/** Normaliza para busca (sem acento, minúsculas). */
export function normalizar(s: string | null | undefined): string {
  return (s ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

export function mensagemErro(err: any, padrao = 'Tente novamente em instantes.'): string {
  return err?.error?.mensagem || err?.error?.message || (typeof err?.error === 'string' ? err.error : '') || padrao;
}

/** Abre o PDF numa nova aba (ou baixa, se não for PDF/imagem). */
export function abrirBlob(blob: Blob, nome: string, baixar = false): void {
  const ext = nome.toLowerCase().split('.').pop() ?? '';
  const tipo = ext === 'pdf' ? 'application/pdf' : ext === 'png' ? 'image/png' : (ext === 'jpg' || ext === 'jpeg') ? 'image/jpeg' : blob.type;
  const url = URL.createObjectURL(new Blob([blob], { type: tipo || 'application/octet-stream' }));
  if (!baixar && (tipo === 'application/pdf' || tipo.startsWith('image/'))) {
    const w = window.open(url, '_blank');
    if (w) { setTimeout(() => URL.revokeObjectURL(url), 60000); return; }
  }
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
