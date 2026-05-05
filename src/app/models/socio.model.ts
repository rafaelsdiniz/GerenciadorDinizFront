import { Cpf } from './value-objects/cpf.vo';
import { Empresa } from './empresa.model';
import { DefaultEntity } from './default-entity.model';

export interface Socio extends DefaultEntity {
  nome: string;
  cpf: Cpf;
  empresa?: Empresa;
}