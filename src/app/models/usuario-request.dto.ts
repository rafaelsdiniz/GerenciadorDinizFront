import { PerfilUsuario } from "./enums/tipo-usuario.enum";

export interface UsuarioRequestDTO {
  nome: string;
  email: string;
  senha: string;
  idEmpresa: number;
  perfilUsuario: PerfilUsuario;
}