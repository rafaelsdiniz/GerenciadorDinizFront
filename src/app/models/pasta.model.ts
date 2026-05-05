// model/pasta.model.ts
import { Empresa } from './empresa.model';
import { Arquivo } from './arquivo.model';
import { DefaultEntity } from './default-entity.model';

export interface Pasta extends DefaultEntity {
  nome: string;
  descricao?: string;
  empresa?: Empresa;
  pastaPai?: Pasta;
  subpastas?: Pasta[];
  arquivos?: Arquivo[];
}