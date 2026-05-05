export interface PastaResponseDTO {
  id: number;
  nome: string;
  descricao?: string;
  idEmpresa: number;
  idPastaPai?: number | null;
}