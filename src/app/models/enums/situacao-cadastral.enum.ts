export enum SituacaoCadastral {
  ATIVA = 'ATIVA',
  INAPTA = 'INAPTA',
  BAIXADA = 'BAIXADA',
  SUSPENSA = 'SUSPENSA',
  NULA = 'NULA'
}

export const SituacaoCadastralLabel: Record<SituacaoCadastral, string> = {
  [SituacaoCadastral.ATIVA]: 'Ativa',
  [SituacaoCadastral.INAPTA]: 'Inapta',
  [SituacaoCadastral.BAIXADA]: 'Baixada',
  [SituacaoCadastral.SUSPENSA]: 'Suspensa',
  [SituacaoCadastral.NULA]: 'Nula'
};
