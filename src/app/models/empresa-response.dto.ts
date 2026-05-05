import { EnderecoDTO } from './endereco.dto';
import { SituacaoCadastral } from './enums/situacao-cadastral.enum';
import { NaturezaJuridica } from './enums/natureza-juridica.enum';
import { RegimeTributario } from './enums/regime-tributario.enum';

export interface EmpresaResponseDTO {
  id: number;
  nomeFantasia: string;
  razaoSocial: string;
  cnpj: string;
  telefone: string;
  email: string;

  dataAbertura?: string | null;
  situacaoCadastral?: SituacaoCadastral | null;
  naturezaJuridica?: NaturezaJuridica | null;
  site?: string | null;

  endereco?: EnderecoDTO | null;

  inscricaoEstadual?: string | null;
  inscricaoMunicipal?: string | null;
  regimeTributario?: RegimeTributario | null;
  cnaePrincipal?: string | null;
  cnaesSecundarios?: string | null;
}
