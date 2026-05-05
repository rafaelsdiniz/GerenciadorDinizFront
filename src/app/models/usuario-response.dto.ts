import { PerfilUsuario } from "./enums/tipo-usuario.enum";


export interface UsuarioResponseDTO {
  id: number;
  nome: string;
  email: string;
  perfilUsuario: PerfilUsuario;
  idEmpresa: number;
}