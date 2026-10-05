export interface EventoCalendarioDTO {
  data: string;
  tipo: 'ARQUIVO' | 'OBRIGACAO' | 'DEC' | 'CERTIDAO';
  idReferencia: number;
  titulo: string;
  descricao: string | null;
  status: string | null;
  categoria: string | null;
}
