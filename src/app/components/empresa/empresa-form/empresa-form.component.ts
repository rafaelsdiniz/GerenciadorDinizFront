import { Component, Input, Output, EventEmitter, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EmpresaService } from '../../../services/empresa.service';
import { EmpresaRequestDTO } from '../../../models/empresa-request.dto';
import { EmpresaResponseDTO } from '../../../models/empresa-response.dto';
import { SituacaoCadastral, SituacaoCadastralLabel } from '../../../models/enums/situacao-cadastral.enum';
import { NaturezaJuridica, NaturezaJuridicaLabel } from '../../../models/enums/natureza-juridica.enum';
import { RegimeTributario, RegimeTributarioLabel } from '../../../models/enums/regime-tributario.enum';

@Component({
  selector: 'app-empresa-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './empresa-form.component.html',
  styleUrl: './empresa-form.component.css'
})
export class EmpresaFormComponent implements OnChanges {

  @Input() empresa: EmpresaResponseDTO | null = null;
  @Input() modo: 'novo' | 'editar' | 'detalhes' = 'novo';

  @Output() fechar = new EventEmitter<void>();
  @Output() salvo = new EventEmitter<void>();
  @Output() deletado = new EventEmitter<void>();

  dto: EmpresaRequestDTO = this.dtoVazio();
  erros: Record<string, string> = {};
  erroGeral = '';
  salvando = false;

  situacoes = Object.values(SituacaoCadastral);
  situacaoLabel = SituacaoCadastralLabel;
  naturezas = Object.values(NaturezaJuridica);
  naturezaLabel = NaturezaJuridicaLabel;
  regimes = Object.values(RegimeTributario);
  regimeLabel = RegimeTributarioLabel;

  constructor(private empresaService: EmpresaService) {}

  ngOnChanges(): void {
    this.erros = {};
    this.erroGeral = '';

    if (this.modo === 'editar' && this.empresa) {
      this.dto = this.fromEmpresa(this.empresa);
    } else {
      this.dto = this.dtoVazio();
    }
  }

  dtoVazio(): EmpresaRequestDTO {
    return {
      nomeFantasia: '',
      razaoSocial: '',
      cnpj: '',
      telefone: '',
      email: '',
      dataAbertura: null,
      situacaoCadastral: null,
      naturezaJuridica: null,
      site: null,
      endereco: {
        logradouro: null,
        numero: null,
        complemento: null,
        bairro: null,
        cidade: null,
        uf: null,
        cep: null
      },
      inscricaoEstadual: null,
      inscricaoMunicipal: null,
      regimeTributario: null,
      cnaePrincipal: null,
      cnaesSecundarios: null
    };
  }

  fromEmpresa(e: EmpresaResponseDTO): EmpresaRequestDTO {
    return {
      nomeFantasia: e.nomeFantasia,
      razaoSocial: e.razaoSocial,
      cnpj: this.formatarCnpjView(e.cnpj),
      telefone: this.formatarTelefoneView(e.telefone),
      email: e.email,
      dataAbertura: e.dataAbertura ?? null,
      situacaoCadastral: e.situacaoCadastral ?? null,
      naturezaJuridica: e.naturezaJuridica ?? null,
      site: e.site ?? null,
      endereco: {
        logradouro: e.endereco?.logradouro ?? null,
        numero: e.endereco?.numero ?? null,
        complemento: e.endereco?.complemento ?? null,
        bairro: e.endereco?.bairro ?? null,
        cidade: e.endereco?.cidade ?? null,
        uf: e.endereco?.uf ?? null,
        cep: this.formatarCepView(e.endereco?.cep ?? null)
      },
      inscricaoEstadual: e.inscricaoEstadual ?? null,
      inscricaoMunicipal: e.inscricaoMunicipal ?? null,
      regimeTributario: e.regimeTributario ?? null,
      cnaePrincipal: e.cnaePrincipal ?? null,
      cnaesSecundarios: e.cnaesSecundarios ?? null
    };
  }

  irParaEdicao(): void {
    this.modo = 'editar';
    if (this.empresa) {
      this.dto = this.fromEmpresa(this.empresa);
    }
  }

  formatarCnpjView(cnpj: string | null | undefined): string {
    if (!cnpj) return '';
    const v = cnpj.replace(/\D/g, '');
    return v.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  }

  formatarTelefoneView(tel: string | null | undefined): string {
    if (!tel) return '';
    const v = tel.replace(/\D/g, '');
    if (v.length === 11) return v.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
    if (v.length === 10) return v.replace(/^(\d{2})(\d{4})(\d{4})$/, '($1) $2-$3');
    return tel;
  }

  formatarCepView(cep: string | null | undefined): string | null {
    if (!cep) return null;
    const v = cep.replace(/\D/g, '');
    return v.replace(/^(\d{5})(\d{3})$/, '$1-$2');
  }

  mascaraCep(event: Event): void {
    const input = event.target as HTMLInputElement;
    let v = input.value.replace(/\D/g, '').substring(0, 8);
    v = v.replace(/^(\d{5})(\d)/, '$1-$2');
    if (this.dto.endereco) this.dto.endereco.cep = v;
  }

  mascaraCnpj(event: Event): void {
    const input = event.target as HTMLInputElement;
    let v = input.value.replace(/\D/g, '').substring(0, 14);
    v = v.replace(/^(\d{2})(\d)/, '$1.$2');
    v = v.replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3');
    v = v.replace(/\.(\d{3})(\d)/, '.$1/$2');
    v = v.replace(/(\d{4})(\d)/, '$1-$2');
    this.dto.cnpj = v;
  }

  mascaraTelefone(event: Event): void {
    const input = event.target as HTMLInputElement;
    let v = input.value.replace(/\D/g, '').substring(0, 11);
    if (v.length <= 10) {
      v = v.replace(/^(\d{2})(\d)/, '($1) $2');
      v = v.replace(/(\d{4})(\d)/, '$1-$2');
    } else {
      v = v.replace(/^(\d{2})(\d)/, '($1) $2');
      v = v.replace(/(\d{5})(\d)/, '$1-$2');
    }
    this.dto.telefone = v;
  }

  private static readonly EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  validar(): boolean {
    this.erros = {};
    if (!this.dto.nomeFantasia.trim()) this.erros['nomeFantasia'] = 'Nome fantasia é obrigatório.';
    if (!this.dto.razaoSocial.trim()) this.erros['razaoSocial'] = 'Razão social é obrigatória.';
    if (!this.dto.cnpj.trim()) this.erros['cnpj'] = 'CNPJ é obrigatório.';
    if (!this.dto.telefone.trim()) this.erros['telefone'] = 'Telefone é obrigatório.';
    if (!this.dto.email.trim()) {
      this.erros['email'] = 'Email é obrigatório.';
    } else if (!EmpresaFormComponent.EMAIL_REGEX.test(this.dto.email.trim())) {
      this.erros['email'] = 'Email inválido.';
    }
    return Object.keys(this.erros).length === 0;
  }

  salvar(): void {
    if (!this.validar()) return;
    this.salvando = true;
    this.erroGeral = '';

    // Remove máscaras antes de enviar
    const dtoLimpo: EmpresaRequestDTO = {
      ...this.dto,
      cnpj: this.dto.cnpj.replace(/\D/g, ''),
      telefone: this.dto.telefone.replace(/\D/g, ''),
      endereco: this.dto.endereco
        ? {
            ...this.dto.endereco,
            cep: this.dto.endereco.cep ? this.dto.endereco.cep.replace(/\D/g, '') : null
          }
        : null
    };

    const request = this.modo === 'novo'
      ? this.empresaService.salvar(dtoLimpo)
      : this.empresaService.atualizar(this.empresa!.id!, dtoLimpo);

    request.subscribe({
      next: () => {
        this.salvando = false;
        this.salvo.emit();
      },
      error: (err) => {
        this.salvando = false;
        this.erroGeral = this.extrairMensagemErro(err);
      }
    });
  }

  private extrairMensagemErro(err: any): string {
    const violations = err?.error?.violations;
    if (Array.isArray(violations) && violations.length > 0) {
      return violations.map((v: any) => v.message).join(' ');
    }
    return err?.error?.message
      ?? err?.error?.mensagem
      ?? (typeof err?.error === 'string' ? err.error : null)
      ?? 'Erro ao salvar empresa. Verifique os dados e tente novamente.';
  }
}