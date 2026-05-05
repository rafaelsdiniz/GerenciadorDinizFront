import { Periodicidade } from './enums/periodicidade.enum';
import { TipoArquivo } from './enums/tipo-arquivo.enum';

export interface ObrigacaoRecorrenteRequestDTO {
  idEmpresa: number;
  nome: string;
  descricao?: string | null;
  periodicidade: Periodicidade;
  diaVencimento: number;
  tipoArquivoEsperado?: TipoArquivo | null;
  ativo: boolean;
}
