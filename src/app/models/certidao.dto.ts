export type TipoCertidao = 'FEDERAL' | 'ESTADUAL' | 'MUNICIPAL' | 'FGTS' | 'TRABALHISTA' | 'FALENCIA' | 'OUTRA';
export type SituacaoCertidao = 'NEGATIVA' | 'POSITIVA_COM_EFEITO_DE_NEGATIVA' | 'POSITIVA';
/** VALIDA | VENCENDO (vence em até 15 dias) | VENCIDA — calculado no backend */
export type StatusValidade = 'VALIDA' | 'VENCENDO' | 'VENCIDA';

export interface CertidaoResponseDTO {
  id: number;
  idEmpresa: number;
  nomeEmpresa: string;
  tipo: TipoCertidao;
  tipoRotulo: string;
  situacao: SituacaoCertidao;
  numero: string | null;
  dataEmissao: string | null;
  dataValidade: string;
  orgaoEmissor: string | null;
  observacao: string | null;
  idArquivo: number | null;
  nomeArquivo: string | null;
  statusValidade: StatusValidade;
  diasParaVencer: number;
  dataCriacao: string | null;
  dataAtualizacao: string | null;
}

export interface CertidaoRequestDTO {
  idEmpresa: number;
  tipo: TipoCertidao;
  situacao: SituacaoCertidao;
  numero: string | null;
  dataEmissao: string | null;
  dataValidade: string;
  orgaoEmissor: string | null;
  observacao: string | null;
  idArquivo?: number | null;
}

export interface CertidaoResumoDTO {
  total: number;
  validas: number;
  vencendo: number;
  vencidas: number;
  empresasComAlerta: number;
  proximoVencimentoDias: number | null;
}
