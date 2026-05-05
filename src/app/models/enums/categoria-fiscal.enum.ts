export enum CategoriaFiscal {
  NFE_ENTRADA = 'NFE_ENTRADA',
  NFE_SAIDA = 'NFE_SAIDA',
  FOLHA_PAGAMENTO = 'FOLHA_PAGAMENTO',
  BALANCETE = 'BALANCETE',
  CERTIDAO = 'CERTIDAO',
  CONTRATO_SOCIAL = 'CONTRATO_SOCIAL',
  GUIA_IMPOSTO = 'GUIA_IMPOSTO',
  DARF = 'DARF',
  DAS = 'DAS',
  EXTRATO_BANCARIO = 'EXTRATO_BANCARIO',
  RELATORIO = 'RELATORIO',
  OUTRO = 'OUTRO'
}

export const CategoriaFiscalLabel: Record<CategoriaFiscal, string> = {
  [CategoriaFiscal.NFE_ENTRADA]: 'NF-e Entrada',
  [CategoriaFiscal.NFE_SAIDA]: 'NF-e Saída',
  [CategoriaFiscal.FOLHA_PAGAMENTO]: 'Folha de Pagamento',
  [CategoriaFiscal.BALANCETE]: 'Balancete',
  [CategoriaFiscal.CERTIDAO]: 'Certidão',
  [CategoriaFiscal.CONTRATO_SOCIAL]: 'Contrato Social',
  [CategoriaFiscal.GUIA_IMPOSTO]: 'Guia de Imposto',
  [CategoriaFiscal.DARF]: 'DARF',
  [CategoriaFiscal.DAS]: 'DAS',
  [CategoriaFiscal.EXTRATO_BANCARIO]: 'Extrato Bancário',
  [CategoriaFiscal.RELATORIO]: 'Relatório',
  [CategoriaFiscal.OUTRO]: 'Outro'
};
