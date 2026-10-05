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
  /** data/hora do envio */
  dataCriacao?: string | null;
  /** quem enviou */
  nomeUsuario?: string | null;
  // ---- leitura inteligente (null enquanto o documento não foi lido)
  /** valor do documento (ex.: total da guia) */
  valor?: number | null;
  /** linha digitável, só dígitos */
  linhaDigitavel?: string | null;
  /** "MM/aaaa" */
  competenciaDocumento?: string | null;
  cnpjDocumento?: string | null;
  tipoDocumento?: import('./documento-analisado.dto').TipoDocumento | null;
  /** "IA" | "PADROES" */
  fonteLeitura?: string | null;
  alertasLeitura?: string[] | null;
  analisadoEm?: string | null;
  /** false = registro sem o arquivo físico (dados de demonstração) */
  possuiConteudo?: boolean;
}
