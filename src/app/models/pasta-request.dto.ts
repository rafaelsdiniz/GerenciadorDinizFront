export interface PastaRequestDTO {
  nome: string;
  descricao?: string;
  idEmpresa: number;
  idPastaPai?: number | null;
}