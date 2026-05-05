import { Empresa } from './empresa.model';
import { Usuario } from './usuario.model';
import { Pasta } from './pasta.model';
import { TipoArquivo } from './enums/tipo-arquivo.enum';
import { DefaultEntity } from './default-entity.model';

export interface Arquivo extends DefaultEntity {
  nome: string;
  nomeOriginal: string;
  tamanho: number;
  tipoArquivo: TipoArquivo;
  caminho: string;
  hash: string;
  empresa: Empresa;
  usuario: Usuario;
  pasta: Pasta;
}