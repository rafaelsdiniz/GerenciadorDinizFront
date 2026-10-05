export type EtapaFechamento = 'AGUARDANDO_DOCUMENTOS' | 'EM_APURACAO' | 'GUIAS_EMITIDAS' | 'CONCLUIDO';

export interface IndicadoresFechamento {
  documentosClienteTotal: number;
  documentosClientePendentes: number;
  obrigacoesEscritorioTotal: number;
  obrigacoesEscritorioEntregues: number;
  obrigacoesEscritorioPendentes: number;
  obrigacoesVencidas: number;
  guiasAguardandoPagamento: number;
  guiasPagamentoAtrasado: number;
  guiasPagas: number;
}

export interface FechamentoMensalDTO {
  id: number;
  idEmpresa: number;
  nomeEmpresa: string;
  cnpj: string | null;
  regimeTributario: string | null;
  /** "MM/aaaa" */
  competencia: string;
  etapa: EtapaFechamento;
  idResponsavel: number | null;
  nomeResponsavel: string | null;
  prazo: string | null;
  diasParaPrazo: number | null;
  atrasado: boolean;
  observacao: string | null;
  concluidoEm: string | null;
  dataAtualizacao: string | null;
  indicadores: IndicadoresFechamento;
}

export interface FechamentoUpdateDTO {
  etapa?: EtapaFechamento;
  idResponsavel?: number;
  removerResponsavel?: boolean;
  /** "" apaga a observação */
  observacao?: string;
}

export interface FechamentoResumoDTO {
  competencia: string;
  total: number;
  porEtapa: Record<EtapaFechamento, number>;
  percentualConcluido: number;
  atrasados: number;
  semResponsavel: number;
}

export interface CompetenciaDTO {
  competencia: string;
  rotulo: string;
  padrao: boolean;
}
