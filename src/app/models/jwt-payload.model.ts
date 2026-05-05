import { PerfilUsuario } from "./enums/tipo-usuario.enum";

export interface JwtPayload {
  sub: string;           // email do usuário
  usuarioId: number;
  empresaId: number;
  groups: PerfilUsuario[];
  exp: number;
  iss: string;
}