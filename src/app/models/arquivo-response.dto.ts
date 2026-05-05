import { TipoArquivo } from './enums/tipo-arquivo.enum';
import { StatusArquivo } from './enums/status-arquivo.enum';
import { CategoriaFiscal } from './enums/categoria-fiscal.enum';

export interface ArquivoResponseDTO {
  id: number;
  nome: string;
  nomeOriginal: string;
  tamanho: number;
  tipoArquivo: TipoArquivo;
  categoriaFiscal: CategoriaFiscal | null;
  caminho: string;
  descricao: string | null;
  dataVencimento: string | null;
  status: StatusArquivo | null;
  diasParaVencer: number | null;
  excluidoEm: string | null;
  idEmpresa: number;
  idUsuario: number;
  idPasta: number;
  idObrigacaoPendente: number | null;
}
