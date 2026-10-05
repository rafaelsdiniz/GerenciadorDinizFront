import { ObrigacaoPendenteResponseDTO, SituacaoPagamento } from '../../models/obrigacao-pendente-response.dto';
import { PastaResponseDTO } from '../../models/pasta-response.dto';
import { CategoriaFiscal } from '../../models/enums/categoria-fiscal.enum';
import { ResponsavelObrigacao } from '../../models/enums/responsavel-obrigacao.enum';

/** Utilitários do fluxo de entrega de obrigações (pendências, drawer e modal de anexo). */

export function isCliente(p: Pick<ObrigacaoPendenteResponseDTO, 'responsavel'> | null | undefined): boolean {
  return p?.responsavel === ResponsavelObrigacao.CLIENTE;
}

/** Rótulo da ação principal: o escritório anexa a guia; o cliente envia o documento. */
export function rotuloAnexar(p: Pick<ObrigacaoPendenteResponseDTO, 'responsavel'> | null | undefined): string {
  return isCliente(p) ? 'Enviar documento' : 'Anexar guia';
}

export function rotuloResponsavel(p: Pick<ObrigacaoPendenteResponseDTO, 'responsavel'> | null | undefined): string {
  return isCliente(p) ? 'Cliente envia' : 'Escritório';
}

const RX_DP = /fgts|folha|inss|esocial|e-social|pr[oó][- ]?labore|ponto|f[eé]rias|rescis|sal[aá]rio|dctfweb|gps/i;
const RX_DOC = /nota|nf|compra|venda|extrato|banc|xml/i;

/** Pasta sugerida para o anexo conforme o tipo da obrigação (fallback: primeira pasta raiz). */
export function sugerirPasta(p: ObrigacaoPendenteResponseDTO, pastas: PastaResponseDTO[]): PastaResponseDTO | null {
  if (!pastas.length) return null;
  const nome = p.nomeObrigacao ?? '';
  let rx: RegExp;
  if (RX_DP.test(nome)) rx = /folha|pessoal|\bdp\b|departamento/i;
  else if (isCliente(p) && RX_DOC.test(nome)) rx = /nota|fiscal|banc|extrato|documento/i;
  else rx = /imposto|guia|fiscal|tribut/i;
  const raiz = pastas.filter(f => !f.idPastaPai);
  return raiz.find(f => rx.test(f.nome)) ?? pastas.find(f => rx.test(f.nome)) ?? raiz[0] ?? pastas[0];
}

/** Categoria fiscal inferida do nome da obrigação (opcional no upload). */
export function sugerirCategoria(p: ObrigacaoPendenteResponseDTO): CategoriaFiscal | null {
  const n = p.nomeObrigacao ?? '';
  if (/\bdas\b|simples/i.test(n)) return CategoriaFiscal.DAS;
  if (/darf/i.test(n)) return CategoriaFiscal.DARF;
  if (/extrato|banc/i.test(n)) return CategoriaFiscal.EXTRATO_BANCARIO;
  if (/folha|ponto|pr[oó][- ]?labore/i.test(n)) return CategoriaFiscal.FOLHA_PAGAMENTO;
  if (/balancete/i.test(n)) return CategoriaFiscal.BALANCETE;
  if (/compra|entrada/i.test(n)) return CategoriaFiscal.NFE_ENTRADA;
  if (/venda|sa[ií]da/i.test(n)) return CategoriaFiscal.NFE_SAIDA;
  if (!isCliente(p) && /fgts|inss|gps|icms|iss|pis|cofins|irpj|csll|guia|dctf/i.test(n)) return CategoriaFiscal.GUIA_IMPOSTO;
  return null;
}

/** "Notas Fiscais / 2026" — caminho legível de uma pasta. */
export function caminhoPasta(f: PastaResponseDTO, todas: PastaResponseDTO[]): string {
  const partes = [f.nome];
  let pai = f.idPastaPai ? todas.find(x => x.id === f.idPastaPai) : undefined;
  let guarda = 0;
  while (pai && guarda++ < 10) {
    partes.unshift(pai.nome);
    pai = pai.idPastaPai ? todas.find(x => x.id === pai!.idPastaPai) : undefined;
  }
  return partes.join(' / ');
}

// ---------------------------------------------------------------- pagamento da guia

export function situacaoPagamento(p: Pick<ObrigacaoPendenteResponseDTO, 'situacaoPagamento'> | null | undefined): SituacaoPagamento {
  return p?.situacaoPagamento ?? 'NAO_SE_APLICA';
}

/** Guia entregue pelo escritório ainda sem pagamento confirmado (no prazo ou atrasada). */
export function aguardaPagamento(p: Pick<ObrigacaoPendenteResponseDTO, 'situacaoPagamento'> | null | undefined): boolean {
  const s = situacaoPagamento(p);
  return s === 'AGUARDANDO' || s === 'ATRASADO';
}

export interface PagamentoVisual { texto: string; classe: string; icone: string; }

/** Badge do pagamento: "Aguardando pagamento" · "Pagamento atrasado" · "Paga em dd/MM" (null quando não se aplica). */
export function pagamentoVisual(p: Pick<ObrigacaoPendenteResponseDTO, 'situacaoPagamento' | 'dataPagamento'>): PagamentoVisual | null {
  switch (situacaoPagamento(p)) {
    case 'AGUARDANDO': return { texto: 'Aguardando pagamento', classe: 'badge-warning', icone: 'clock' };
    case 'ATRASADO': return { texto: 'Pagamento atrasado', classe: 'badge-danger', icone: 'alert-circle' };
    case 'PAGO': {
      const d = p.dataPagamento;
      return { texto: d ? `Paga em ${d.slice(8, 10)}/${d.slice(5, 7)}` : 'Paga', classe: 'badge-success', icone: 'check-circle' };
    }
    default: return null;
  }
}

/** Data local de hoje em "yyyy-MM-dd". */
export function hojeIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** "yyyy-MM-dd" → "dd/MM/yyyy". */
export function formatarData(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [a, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
}

/** Mensagem de erro vinda da API (ou fallback). */
export function mensagemErro(err: any, padrao = 'Tente novamente em instantes.'): string {
  return err?.error?.mensagem || err?.error?.message || (typeof err?.error === 'string' ? err.error : '') || err?.message || padrao;
}
