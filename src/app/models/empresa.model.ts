import { Cnpj } from './value-objects/cnpj.vo';
import { Telefone } from './value-objects/telefone.vo';
import { Email } from './value-objects/email.vo';
import { Usuario } from './usuario.model';
import { Socio } from './socio.model';
import { Pasta } from './pasta.model';
import { DefaultEntity } from './default-entity.model';

export interface Empresa extends DefaultEntity {
  nomeFantasia: string;
  razaoSocial: string;
  cnpj: Cnpj;
  telefone: Telefone;
  email: Email;
  usuarios?: Usuario[];
  socios?: Socio[];
  pastas?: Pasta[];
}