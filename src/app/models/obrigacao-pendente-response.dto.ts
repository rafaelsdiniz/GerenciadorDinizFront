import { StatusObrigacao } from './enums/status-obrigacao.enum';

export interface ObrigacaoPendenteResponseDTO {
  id: number;
  idEmpresa: number;
  idObrigacaoRecorrente: number | null;
  nomeObrigacao: string | null;
  dataVencimento: string;
  dataEntrega: string | null;
  status: StatusObrigacao;
  diasParaVencer: number | null;
}
