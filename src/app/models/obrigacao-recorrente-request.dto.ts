import { Periodicidade } from './enums/periodicidade.enum';
import { TipoArquivo } from './enums/tipo-arquivo.enum';
import { ResponsavelObrigacao } from './enums/responsavel-obrigacao.enum';

export interface ObrigacaoRecorrenteRequestDTO {
  idEmpresa: number;
  nome: string;
  descricao?: string | null;
  periodicidade: Periodicidade;
  diaVencimento: number;
  tipoArquivoEsperado?: TipoArquivo | null;
  ativo: boolean;
  /** padrão no backend: ESCRITORIO */
  responsavel?: ResponsavelObrigacao | null;
}
