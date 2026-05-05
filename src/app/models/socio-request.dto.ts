export interface SocioRequestDTO {
  nome: string;
  cpf: string;
  idEmpresa: number;
  participacao?: number | null;
  administrador?: boolean | null;
}
