export interface SocioResponseDTO {
  id: number;
  nome: string;
  cpf: string;
  idEmpresa: number;
  participacao?: number | null;
  administrador?: boolean | null;
}
