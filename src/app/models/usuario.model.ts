import { Email } from './value-objects/email.vo';
import { Empresa } from './empresa.model';
import { PerfilUsuario } from './enums/tipo-usuario.enum';
import { DefaultEntity } from './default-entity.model';

export interface Usuario extends DefaultEntity {
  nome: string;
  email: Email;
  senha?: string;
  perfilUsuario: PerfilUsuario;
  empresa?: Empresa;
}