export enum Periodicidade {
  MENSAL = 'MENSAL',
  TRIMESTRAL = 'TRIMESTRAL',
  ANUAL = 'ANUAL'
}

export const PeriodicidadeLabel: Record<Periodicidade, string> = {
  [Periodicidade.MENSAL]: 'Mensal',
  [Periodicidade.TRIMESTRAL]: 'Trimestral',
  [Periodicidade.ANUAL]: 'Anual'
};
