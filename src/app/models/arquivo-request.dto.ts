import { CategoriaFiscal } from './enums/categoria-fiscal.enum';

export interface ArquivoRequestDTO {
  idEmpresa: number;
  idUsuario: number;
  idPasta: number;
  descricao?: string | null;
  dataVencimento?: string | null;
  idObrigacaoPendente?: number | null;
  categoriaFiscal?: CategoriaFiscal | null;
}
