/** Aparência por tipo de arquivo (ícone + tom do .icon-tile), compartilhada pela área de Arquivos. */
export interface VisualTipo {
  icone: string;
  /** classe extra do .icon-tile: '' (primária) | success | warning | danger | info | accent | neutral */
  tom: string;
  ext: string;
}

/** Grupos do filtro "Tipo" (estilo Drive). */
export type GrupoTipo = 'pdf' | 'xml' | 'planilha' | 'imagem' | 'outros';

export const GRUPOS_TIPO: { valor: GrupoTipo; label: string; icone: string; tom: string }[] = [
  { valor: 'pdf', label: 'PDF', icone: 'file-text', tom: 'danger' },
  { valor: 'xml', label: 'XML', icone: 'file-code', tom: 'info' },
  { valor: 'planilha', label: 'Planilhas', icone: 'file-spreadsheet', tom: 'success' },
  { valor: 'imagem', label: 'Imagens', icone: 'file-image', tom: 'accent' },
  { valor: 'outros', label: 'Outros', icone: 'file', tom: 'neutral' },
];

export const EXT_IMAGEM = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'];
const EXT_PLANILHA = ['xls', 'xlsx', 'csv', 'ods'];

export function extensao(nome: string | null | undefined, tipo?: string | null): string {
  const e = (nome ?? '').includes('.') ? (nome as string).split('.').pop()!.toLowerCase() : '';
  if (e) return e;
  return (tipo && tipo !== 'OUTRO') ? tipo.toLowerCase() : '';
}

export function grupoTipo(nome: string | null | undefined, tipo?: string | null): GrupoTipo {
  const ext = extensao(nome, tipo);
  if (ext === 'pdf') return 'pdf';
  if (ext === 'xml') return 'xml';
  if (EXT_PLANILHA.includes(ext)) return 'planilha';
  if (EXT_IMAGEM.includes(ext)) return 'imagem';
  return 'outros';
}

export function visualTipo(nome: string | null | undefined, tipo?: string | null): VisualTipo {
  const ext = extensao(nome, tipo);
  const up = ext.toUpperCase() || 'ARQ';
  if (ext === 'pdf') return { icone: 'file-text', tom: 'danger', ext: up };
  if (ext === 'xml') return { icone: 'file-code', tom: 'info', ext: up };
  if (EXT_PLANILHA.includes(ext)) return { icone: 'file-spreadsheet', tom: 'success', ext: up };
  if (['doc', 'docx', 'txt', 'odt', 'rtf'].includes(ext)) return { icone: 'file-text', tom: '', ext: up };
  if (EXT_IMAGEM.includes(ext)) return { icone: 'file-image', tom: 'accent', ext: up };
  if (['zip', 'rar', '7z'].includes(ext)) return { icone: 'file-archive', tom: 'neutral', ext: up };
  return { icone: 'file', tom: 'neutral', ext: up };
}

/** Tom de badge para o status do arquivo (mapeamento padrão do DESIGN.md). */
export function tomStatus(status: string | null | undefined): string {
  switch (status) {
    case 'ENTREGUE': return 'badge-success';
    case 'PENDENTE': return 'badge-warning';
    case 'VENCIDO':
    case 'VENCIDA': return 'badge-danger';
    default: return 'badge-neutral';
  }
}

/** Prazo relativo só faz sentido para documentos ainda não entregues/arquivados. */
export function mostraPrazo(a: { dataVencimento: string | null; status: string | null }): boolean {
  return !!a.dataVencimento && a.status !== 'ENTREGUE' && a.status !== 'ARQUIVADO';
}

/** Converte "2026-10-04T13:20:00" (ou só a data) em timestamp local; 0 quando ausente/ inválido. */
export function tempoDe(v: string | null | undefined): number {
  if (!v) return 0;
  const t = new Date(v.length === 10 ? v + 'T00:00:00' : v).getTime();
  return isNaN(t) ? 0 : t;
}
