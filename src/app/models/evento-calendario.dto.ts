export interface EventoCalendarioDTO {
  data: string;
  tipo: 'ARQUIVO' | 'OBRIGACAO' | 'DEC';
  idReferencia: number;
  titulo: string;
  descricao: string | null;
  status: string | null;
  categoria: string | null;
}
