export enum NaturezaJuridica {
  MEI = 'MEI',
  EI = 'EI',
  LTDA = 'LTDA',
  EIRELI = 'EIRELI',
  SLU = 'SLU',
  SA = 'SA',
  OUTRA = 'OUTRA'
}

export const NaturezaJuridicaLabel: Record<NaturezaJuridica, string> = {
  [NaturezaJuridica.MEI]: 'MEI',
  [NaturezaJuridica.EI]: 'Empresário Individual',
  [NaturezaJuridica.LTDA]: 'LTDA',
  [NaturezaJuridica.EIRELI]: 'EIRELI',
  [NaturezaJuridica.SLU]: 'Sociedade Limitada Unipessoal',
  [NaturezaJuridica.SA]: 'S/A',
  [NaturezaJuridica.OUTRA]: 'Outra'
};
