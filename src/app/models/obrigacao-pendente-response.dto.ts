import { StatusObrigacao } from './enums/status-obrigacao.enum';
import { ResponsavelObrigacao } from './enums/responsavel-obrigacao.enum';

/**
 * Ciclo de pagamento da guia entregue pelo escritório:
 * NAO_SE_APLICA (documento do cliente ou guia ainda não entregue) · AGUARDANDO (entregue, não paga, no prazo)
 * · ATRASADO (entregue, não paga, vencimento passou) · PAGO (dataPagamento preenchida).
 */
export type SituacaoPagamento = 'NAO_SE_APLICA' | 'AGUARDANDO' | 'ATRASADO' | 'PAGO';

export interface ObrigacaoPendenteResponseDTO {
  id: number;
  idEmpresa: number;
  idObrigacaoRecorrente: number | null;
  nomeObrigacao: string | null;
  dataVencimento: string;
  dataEntrega: string | null;
  status: StatusObrigacao;
  diasParaVencer: number | null;
  /** nome fantasia da empresa */
  nomeEmpresa?: string | null;
  /** "MM/yyyy" (ou "yyyy" para anuais) */
  competencia?: string | null;
  responsavel?: ResponsavelObrigacao | null;
  /** arquivos anexados à obrigação */
  totalArquivos?: number | null;
  /** "yyyy-MM-dd" — data em que a guia foi paga */
  dataPagamento?: string | null;
  situacaoPagamento?: SituacaoPagamento | null;
}
