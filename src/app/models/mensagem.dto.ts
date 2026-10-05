/** Mensagem da conversa de uma obrigação (já do ponto de vista do usuário logado). */
export interface MensagemDTO {
  id: number;
  idObrigacao: number;
  texto: string;
  dataCriacao: string;
  idAutor: number | null;
  autorNome: string | null;
  /** ADMIN (escritório) | FUNCIONARIO (cliente) */
  autorPerfil: 'ADMIN' | 'FUNCIONARIO';
  doEscritorio: boolean;
  /** enviada pelo usuário logado */
  minha: boolean;
  idArquivo: number | null;
  nomeArquivo: string | null;
  lidaPeloEscritorioEm: string | null;
  lidaPeloClienteEm: string | null;
  /** o outro lado já leu */
  lidaPeloDestinatario: boolean;
}

export interface MensagemRequestDTO {
  texto: string;
  idArquivo?: number | null;
}

/** Não lidas pelo usuário logado: total e contagem por obrigação. */
export interface MensagensNaoLidasDTO {
  total: number;
  porObrigacao: Record<number, number>;
}

/** Conversa com atividade recente (painel de notificações). */
export interface ConversaRecenteDTO {
  idObrigacao: number;
  nomeObrigacao: string;
  competencia: string | null;
  idEmpresa: number | null;
  nomeEmpresa: string | null;
  idMensagem: number;
  autorNome: string | null;
  autorPerfil: 'ADMIN' | 'FUNCIONARIO';
  doEscritorio: boolean;
  minha: boolean;
  previa: string;
  dataUltimaMensagem: string;
  naoLidas: number;
}
