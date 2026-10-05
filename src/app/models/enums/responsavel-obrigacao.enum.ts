/** Quem cumpre a obrigação: o escritório entrega a guia/declaração ou o cliente envia documentos. */
export enum ResponsavelObrigacao {
  ESCRITORIO = 'ESCRITORIO',
  CLIENTE = 'CLIENTE'
}

export const ResponsavelObrigacaoLabel: Record<ResponsavelObrigacao, string> = {
  [ResponsavelObrigacao.ESCRITORIO]: 'Escritório',
  [ResponsavelObrigacao.CLIENTE]: 'Cliente envia'
};

/** Texto curto de apoio exibido no formulário de recorrentes. */
export const ResponsavelObrigacaoAjuda: Record<ResponsavelObrigacao, string> = {
  [ResponsavelObrigacao.ESCRITORIO]: 'O escritório apura/transmite e anexa a guia ou declaração (DAS, FGTS, DCTFWeb…).',
  [ResponsavelObrigacao.CLIENTE]: 'O cliente envia documentos ao escritório (extratos, notas de compra, cartão-ponto…).'
};
