export enum StatusObrigacao {
  PENDENTE = 'PENDENTE',
  ENTREGUE = 'ENTREGUE',
  VENCIDA = 'VENCIDA'
}

export const StatusObrigacaoLabel: Record<StatusObrigacao, string> = {
  [StatusObrigacao.PENDENTE]: 'Pendente',
  [StatusObrigacao.ENTREGUE]: 'Entregue',
  [StatusObrigacao.VENCIDA]: 'Vencida'
};
