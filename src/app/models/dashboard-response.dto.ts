import { StatusArquivo } from './enums/status-arquivo.enum';
import { CategoriaFiscal } from './enums/categoria-fiscal.enum';

export interface MaiorAtraso {
  idArquivo: number;
  nome: string;
  descricao: string | null;
  diasAtraso: number;
}

export interface DashboardResponseDTO {
  idEmpresa: number;
  nomeEmpresa: string;
  totalArquivos: number;
  totalArquivosVencidos: number;
  totalArquivosVencendo7Dias: number;
  totalArquivosVencendo30Dias: number;
  taxaEntregaNoPrazo: number | null;
  totalObrigacoesPendentes: number;
  totalObrigacoesVencidas: number;
  distribuicaoPorStatus: Partial<Record<StatusArquivo, number>>;
  distribuicaoPorCategoria: Partial<Record<CategoriaFiscal, number>>;
  top5MaioresAtrasos: MaiorAtraso[];
}
