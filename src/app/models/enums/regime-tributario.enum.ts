export enum RegimeTributario {
  SIMPLES_NACIONAL = 'SIMPLES_NACIONAL',
  LUCRO_PRESUMIDO = 'LUCRO_PRESUMIDO',
  LUCRO_REAL = 'LUCRO_REAL',
  MEI = 'MEI'
}

export const RegimeTributarioLabel: Record<RegimeTributario, string> = {
  [RegimeTributario.SIMPLES_NACIONAL]: 'Simples Nacional',
  [RegimeTributario.LUCRO_PRESUMIDO]: 'Lucro Presumido',
  [RegimeTributario.LUCRO_REAL]: 'Lucro Real',
  [RegimeTributario.MEI]: 'MEI'
};
