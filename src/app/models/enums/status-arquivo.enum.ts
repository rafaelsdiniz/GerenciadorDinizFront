export enum StatusArquivo {
  PENDENTE = 'PENDENTE',
  ENTREGUE = 'ENTREGUE',
  VENCIDO = 'VENCIDO',
  ARQUIVADO = 'ARQUIVADO'
}

export const StatusArquivoLabel: Record<StatusArquivo, string> = {
  [StatusArquivo.PENDENTE]: 'Pendente',
  [StatusArquivo.ENTREGUE]: 'Entregue',
  [StatusArquivo.VENCIDO]: 'Vencido',
  [StatusArquivo.ARQUIVADO]: 'Arquivado'
};
