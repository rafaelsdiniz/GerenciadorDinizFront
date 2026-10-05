import { Component, ElementRef, EventEmitter, HostListener, Input, OnChanges, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { EmpresaService } from '../../../services/empresa.service';
import { EmpresaRequestDTO } from '../../../models/empresa-request.dto';
import { EmpresaResponseDTO } from '../../../models/empresa-response.dto';
import { SituacaoCadastral, SituacaoCadastralLabel } from '../../../models/enums/situacao-cadastral.enum';
import { NaturezaJuridica, NaturezaJuridicaLabel } from '../../../models/enums/natureza-juridica.enum';
import { RegimeTributario, RegimeTributarioLabel } from '../../../models/enums/regime-tributario.enum';
import { IconComponent } from '../../../shared/icon.component';
import { ToastService } from '../../../shared/ui/toast.service';
import { ConfirmService } from '../../../shared/ui/confirm.service';
import { AvatarCorPipe, DocumentoPipe, IniciaisPipe, TelefonePipe } from '../../../pipes/formatos.pipe';

type Campo = 'nomeFantasia' | 'razaoSocial' | 'cnpj' | 'telefone' | 'email' | 'cep';

/**
 * Modal de cadastro/edição de empresa (e visualização rápida no modo 'detalhes').
 * Renderiza o próprio backdrop — basta envolver em @if no componente pai.
 */
@Component({
  selector: 'app-empresa-form',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, IconComponent, DocumentoPipe, TelefonePipe, IniciaisPipe, AvatarCorPipe],
  templateUrl: './empresa-form.component.html',
  styleUrl: './empresa-form.component.css'
})
export class EmpresaFormComponent implements OnChanges {

  @Input() empresa: EmpresaResponseDTO | null = null;
  @Input() modo: 'novo' | 'editar' | 'detalhes' = 'novo';
  /** Valores iniciais ao criar (ex.: CNPJ e razão social vindos do DEC). */
  @Input() preenchimento: Partial<EmpresaRequestDTO> | null = null;

  @Output() fechar = new EventEmitter<void>();
  @Output() salvo = new EventEmitter<EmpresaResponseDTO>();
  @Output() deletado = new EventEmitter<void>();

  dto: EmpresaRequestDTO = this.dtoVazio();
  erros: Partial<Record<Campo, string>> = {};
  erroGeral = '';
  salvando = false;
  excluindo = false;

  situacoes = Object.values(SituacaoCadastral);
  situacaoLabel = SituacaoCadastralLabel;
  naturezas = Object.values(NaturezaJuridica);
  naturezaLabel = NaturezaJuridicaLabel;
  regimes = Object.values(RegimeTributario);
  regimeLabel = RegimeTributarioLabel;
  readonly ufs = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB',
    'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];

  constructor(
    private empresaService: EmpresaService,
    private toast: ToastService,
    private confirm: ConfirmService,
    private el: ElementRef<HTMLElement>
  ) {}

  ngOnChanges(): void {
    this.erros = {};
    this.erroGeral = '';
    this.dto = this.modo === 'editar' && this.empresa
      ? this.fromEmpresa(this.empresa)
      : { ...this.dtoVazio(), ...(this.modo === 'novo' && this.preenchimento ? this.preenchimento : {}) };
  }

  get editando(): boolean { return this.modo === 'novo' || this.modo === 'editar'; }

  // ============ teclado ============

  @HostListener('document:keydown', ['$event'])
  onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape' && !this.salvando) {
      e.preventDefault();
      this.fechar.emit();
    } else if (this.editando && (e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'Enter')) {
      e.preventDefault();
      this.salvar();
    }
  }

  fecharPeloFundo(e: MouseEvent): void {
    if (e.target === e.currentTarget && !this.salvando) this.fechar.emit();
  }

  // ============ dados ============

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
      endereco: { logradouro: null, numero: null, complemento: null, bairro: null, cidade: null, uf: null, cep: null },
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
    if (this.empresa) this.dto = this.fromEmpresa(this.empresa);
    setTimeout(() => this.el.nativeElement.querySelector<HTMLInputElement>('input')?.focus());
  }

  // ============ máscaras ============

  formatarCnpjView(cnpj: string | null | undefined): string {
    if (!cnpj) return '';
    return cnpj.replace(/\D/g, '').replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
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
    return cep.replace(/\D/g, '').replace(/^(\d{5})(\d{3})$/, '$1-$2');
  }

  mascaraCep(event: Event): void {
    const input = event.target as HTMLInputElement;
    const v = input.value.replace(/\D/g, '').substring(0, 8).replace(/^(\d{5})(\d)/, '$1-$2');
    input.value = v;
    if (this.dto.endereco) this.dto.endereco.cep = v;
    this.revalidar('cep');
  }

  mascaraCnpj(event: Event): void {
    const input = event.target as HTMLInputElement;
    let v = input.value.replace(/\D/g, '').substring(0, 14);
    v = v.replace(/^(\d{2})(\d)/, '$1.$2');
    v = v.replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3');
    v = v.replace(/\.(\d{3})(\d)/, '.$1/$2');
    v = v.replace(/(\d{4})(\d)/, '$1-$2');
    input.value = v;
    this.dto.cnpj = v;
    this.revalidar('cnpj');
  }

  mascaraTelefone(event: Event): void {
    const input = event.target as HTMLInputElement;
    let v = input.value.replace(/\D/g, '').substring(0, 11);
    v = v.replace(/^(\d{2})(\d)/, '($1) $2');
    v = v.length <= 14 ? v.replace(/(\d{4})(\d)/, '$1-$2') : v.replace(/(\d{5})(\d)/, '$1-$2');
    input.value = v;
    this.dto.telefone = v;
    this.revalidar('telefone');
  }

  // ============ validação ============

  private static readonly EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  private regra(campo: Campo): string | null {
    const d = (s: string | null | undefined) => (s ?? '').replace(/\D/g, '');
    switch (campo) {
      case 'nomeFantasia': return this.dto.nomeFantasia.trim() ? null : 'Informe o nome fantasia.';
      case 'razaoSocial': return this.dto.razaoSocial.trim() ? null : 'Informe a razão social.';
      case 'cnpj': {
        const v = d(this.dto.cnpj);
        if (!v) return 'Informe o CNPJ.';
        return v.length === 14 ? null : 'O CNPJ deve ter 14 dígitos.';
      }
      case 'telefone': {
        const v = d(this.dto.telefone);
        if (!v) return 'Informe o telefone.';
        return v.length >= 10 ? null : 'Telefone incompleto — inclua o DDD.';
      }
      case 'email': {
        const v = this.dto.email.trim();
        if (!v) return 'Informe o e-mail.';
        return EmpresaFormComponent.EMAIL_REGEX.test(v) ? null : 'E-mail inválido.';
      }
      case 'cep': {
        const v = d(this.dto.endereco?.cep);
        return !v || v.length === 8 ? null : 'O CEP deve ter 8 dígitos.';
      }
    }
  }

  /** Valida um campo ao sair dele. */
  validarCampo(campo: Campo): void {
    const msg = this.regra(campo);
    if (msg) this.erros[campo] = msg; else delete this.erros[campo];
  }

  /** Enquanto digita, só limpa o erro (não acusa antes da hora). */
  revalidar(campo: Campo): void {
    if (this.erros[campo] && !this.regra(campo)) delete this.erros[campo];
  }

  validar(): boolean {
    this.erros = {};
    (['nomeFantasia', 'razaoSocial', 'cnpj', 'telefone', 'email', 'cep'] as Campo[]).forEach(c => this.validarCampo(c));
    return Object.keys(this.erros).length === 0;
  }

  get qtdErros(): number { return Object.keys(this.erros).length; }

  // ============ ações ============

  salvar(): void {
    if (this.salvando) return;
    if (!this.validar()) {
      setTimeout(() => this.el.nativeElement.querySelector<HTMLElement>('.is-invalid')?.focus());
      return;
    }
    this.salvando = true;
    this.erroGeral = '';

    const dtoLimpo: EmpresaRequestDTO = {
      ...this.dto,
      cnpj: this.dto.cnpj.replace(/\D/g, ''),
      telefone: this.dto.telefone.replace(/\D/g, ''),
      endereco: this.dto.endereco
        ? { ...this.dto.endereco, cep: this.dto.endereco.cep ? this.dto.endereco.cep.replace(/\D/g, '') : null }
        : null
    };

    const novo = this.modo === 'novo';
    const request = novo
      ? this.empresaService.salvar(dtoLimpo)
      : this.empresaService.atualizar(this.empresa!.id!, dtoLimpo);

    request.subscribe({
      next: (res) => {
        this.salvando = false;
        this.toast.success(novo ? 'Empresa cadastrada' : 'Alterações salvas', res?.nomeFantasia ?? this.dto.nomeFantasia);
        this.salvo.emit(res);
      },
      error: (err) => {
        this.salvando = false;
        this.erroGeral = this.extrairMensagemErro(err);
        this.toast.error('Não foi possível salvar', this.erroGeral);
      }
    });
  }

  async excluir(): Promise<void> {
    if (!this.empresa?.id) return;
    const ok = await this.confirm.ask({
      titulo: 'Excluir empresa?',
      mensagem: `"${this.empresa.nomeFantasia}" será removida do sistema. Esta ação não pode ser desfeita.`,
      confirmar: 'Excluir',
      tom: 'danger'
    });
    if (!ok) return;
    this.excluindo = true;
    this.empresaService.deletar(this.empresa.id).subscribe({
      next: () => {
        this.excluindo = false;
        this.toast.success('Empresa excluída', this.empresa?.nomeFantasia);
        this.deletado.emit();
      },
      error: (err) => {
        this.excluindo = false;
        this.toast.error('Não foi possível excluir', this.extrairMensagemErro(err, 'Verifique se há arquivos ou usuários vinculados.'));
      }
    });
  }

  private extrairMensagemErro(err: any, padrao = 'Verifique os dados e tente novamente.'): string {
    const violations = err?.error?.violations;
    if (Array.isArray(violations) && violations.length > 0) {
      return violations.map((v: any) => v.message).join(' ');
    }
    return err?.error?.message
      ?? err?.error?.mensagem
      ?? (typeof err?.error === 'string' ? err.error : null)
      ?? padrao;
  }
}
