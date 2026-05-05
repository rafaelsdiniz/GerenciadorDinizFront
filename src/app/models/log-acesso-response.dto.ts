import { AcaoLog } from './enums/acao-log.enum';

export interface LogAcessoResponseDTO {
  id: number;
  dataCriacao: string;
  idUsuario: number | null;
  nomeUsuario: string | null;
  acao: AcaoLog;
  entidade: string | null;
  idEntidade: number | null;
  detalhes: string | null;
}
