import { CategoriaFiscal } from './enums/categoria-fiscal.enum';
import { ArquivoResponseDTO } from './arquivo-response.dto';

/** Tipo de documento identificado pela leitura inteligente. */
export type TipoDocumento =
  | 'DAS' | 'DARF' | 'GPS' | 'FGTS' | 'ICMS' | 'ISS' | 'NFE' | 'NFSE'
  | 'EXTRATO_BANCARIO' | 'CERTIDAO' | 'CONTRATO' | 'BALANCETE' | 'FOLHA' | 'OUTRO';

export const TipoDocumentoLabel: Record<TipoDocumento, string> = {
  DAS: 'DAS — Simples Nacional',
  DARF: 'DARF',
  GPS: 'GPS / INSS',
  FGTS: 'Guia do FGTS',
  ICMS: 'ICMS (DARE)',
  ISS: 'ISS',
  NFE: 'NF-e',
  NFSE: 'NFS-e',
  EXTRATO_BANCARIO: 'Extrato bancário',
  CERTIDAO: 'Certidão',
  CONTRATO: 'Contrato',
  BALANCETE: 'Balancete',
  FOLHA: 'Folha de pagamento',
  OUTRO: 'Outro documento'
};

export interface AlertaLeitura {
  codigo: string;
  /** danger | warning | info */
  nivel: 'danger' | 'warning' | 'info';
  mensagem: string;
}

/** Resultado de POST /ia/analisar (nada é gravado). */
export interface DocumentoAnalisado {
  tipoDocumento: TipoDocumento;
  tipoDocumentoRotulo: string;
  categoriaFiscalSugerida: CategoriaFiscal | null;
  descricaoSugerida: string | null;
  cnpj: string | null;
  /** true = confere com a empresa · false = diverge · null = sem comparação */
  cnpjConfere: boolean | null;
  razaoSocial: string | null;
  /** "MM/aaaa" */
  competencia: string | null;
  /** "aaaa-mm-dd" */
  vencimento: string | null;
  valor: number | null;
  /** só dígitos (47 boleto · 48 arrecadação) */
  linhaDigitavel: string | null;
  codigoBarras: string | null;
  numeroDocumento: string | null;
  validade: string | null;
  /** "IA" (DeepSeek) ou "PADROES" (leitura automática por padrões) */
  fonte: 'IA' | 'PADROES';
  modelo: string | null;
  /** 0 a 1 */
  confianca: number;
  textoLegivel: boolean;
  alertas: AlertaLeitura[];
  textoExtraidoResumo: string;
}

export interface StatusIa {
  configurada: boolean;
  provedor: string;
  modelo: string | null;
  leituraPorPadroes: boolean;
}

export interface ResultadoLeituraArquivo {
  analise: DocumentoAnalisado;
  arquivo: ArquivoResponseDTO;
}

/** Linha digitável em blocos legíveis. */
export function formatarLinhaDigitavel(l: string | null | undefined): string {
  if (!l) return '';
  if (l.length === 48) return [0, 1, 2, 3].map(b => `${l.slice(b * 12, b * 12 + 11)}-${l[b * 12 + 11]}`).join(' ');
  if (l.length === 47) {
    return `${l.slice(0, 5)}.${l.slice(5, 10)} ${l.slice(10, 15)}.${l.slice(15, 21)} ${l.slice(21, 26)}.${l.slice(26, 32)} ${l[32]} ${l.slice(33)}`;
  }
  return l;
}

export function formatarCnpj(c: string | null | undefined): string {
  if (!c) return '';
  const d = c.replace(/\D/g, '');
  return d.length === 14 ? `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}` : c;
}

/** Extensões que têm texto para ler (imagens/escaneados não). */
export function legivelPorIa(nome: string | null | undefined): boolean {
  const ext = (nome ?? '').split('.').pop()?.toLowerCase() ?? '';
  return ['pdf', 'xml', 'txt', 'csv', 'docx', 'xlsx', 'odt', 'ods', 'ofx', 'html', 'htm'].includes(ext);
}

/** Copia para a área de transferência (com alternativa para navegadores sem Clipboard API). */
export async function copiarTexto(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    try {
      const t = document.createElement('textarea');
      t.value = texto;
      t.style.position = 'fixed';
      t.style.opacity = '0';
      document.body.appendChild(t);
      t.select();
      const ok = document.execCommand('copy');
      t.remove();
      return ok;
    } catch {
      return false;
    }
  }
}
