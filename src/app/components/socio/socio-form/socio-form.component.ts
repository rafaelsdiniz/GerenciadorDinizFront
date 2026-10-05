import { AfterViewInit, Component, ElementRef, EventEmitter, HostListener, Input, OnChanges, Output, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SocioService } from '../../../services/socio.service';
import { SocioRequestDTO } from '../../../models/socio-request.dto';
import { SocioResponseDTO } from '../../../models/socio-response.dto';
import { EmpresaResponseDTO } from '../../../models/empresa-response.dto';
import { IconComponent } from '../../../shared/icon.component';
import { ToastService } from '../../../shared/ui/toast.service';
import { DocumentoPipe, IniciaisPipe, AvatarCorPipe } from '../../../pipes/formatos.pipe';

@Component({
  selector: 'app-socio-form',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent, DocumentoPipe, IniciaisPipe, AvatarCorPipe],
  templateUrl: './socio-form.component.html',
  styleUrl: './socio-form.component.css'
})
export class SocioFormComponent implements OnChanges, AfterViewInit {
  private socioService = inject(SocioService);
  private toast = inject(ToastService);

  @Input() socio: SocioResponseDTO | null = null;
  @Input() modo: 'novo' | 'editar' | 'detalhes' = 'novo';
  @Input() empresas: EmpresaResponseDTO[] = [];
  /** Todos os sócios (opcional) — usado para mostrar a participação disponível na empresa. */
  @Input() socios: SocioResponseDTO[] = [];

  @Output() fechar = new EventEmitter<void>();
  @Output() salvo = new EventEmitter<void>();

  @ViewChild('primeiroCampo') primeiroCampo?: ElementRef<HTMLInputElement>;

  dto: SocioRequestDTO = this.dtoVazio();
  erros: Record<string, string> = {};
  erroGeral = '';
  salvando = false;

  ngOnChanges(): void {
    this.erros = {};
    this.erroGeral = '';
    this.dto = this.modo === 'editar' && this.socio ? this.fromSocio(this.socio) : this.dtoVazio();
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.primeiroCampo?.nativeElement.focus(), 60);
  }

  dtoVazio(): SocioRequestDTO {
    return { nome: '', cpf: '', idEmpresa: 0, participacao: null, administrador: false };
  }

  fromSocio(s: SocioResponseDTO): SocioRequestDTO {
    return {
      nome: s.nome,
      cpf: this.formatarCpf(s.cpf),
      idEmpresa: s.idEmpresa,
      participacao: s.participacao ?? null,
      administrador: s.administrador ?? false
    };
  }

  irParaEdicao(): void {
    this.modo = 'editar';
    if (this.socio) this.dto = this.fromSocio(this.socio);
    setTimeout(() => this.primeiroCampo?.nativeElement.focus(), 30);
  }

  getNomeEmpresa(idEmpresa: number): string {
    return this.empresas.find(e => e.id === idEmpresa)?.nomeFantasia ?? '—';
  }

  getCnpjEmpresa(idEmpresa: number): string | undefined {
    return this.empresas.find(e => e.id === idEmpresa)?.cnpj;
  }

  formatarCpf(cpf: string): string {
    if (!cpf) return '';
    const v = cpf.replace(/\D/g, '');
    return v.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  }

  mascaraCpf(event: Event): void {
    const input = event.target as HTMLInputElement;
    let v = input.value.replace(/\D/g, '').substring(0, 11);
    v = v.replace(/^(\d{3})(\d)/, '$1.$2');
    v = v.replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3');
    v = v.replace(/\.(\d{3})(\d)/, '.$1-$2');
    this.dto.cpf = v;
    input.value = v;
    this.limparErro('cpf');
  }

  /** Verifica dígitos verificadores (apenas aviso — não bloqueia o salvamento). */
  get cpfSuspeito(): boolean {
    const d = (this.dto.cpf ?? '').replace(/\D/g, '');
    if (d.length !== 11) return false;
    if (/^(\d)\1{10}$/.test(d)) return true;
    const calc = (n: number) => {
      let s = 0;
      for (let i = 0; i < n; i++) s += +d[i] * (n + 1 - i);
      const r = (s * 10) % 11;
      return r === 10 ? 0 : r;
    };
    return calc(9) !== +d[9] || calc(10) !== +d[10];
  }

  /** Participação já ocupada pelos outros sócios da empresa escolhida. */
  get participacaoOutros(): number | null {
    if (!this.dto.idEmpresa || !this.socios.length) return null;
    return this.socios
      .filter(s => s.idEmpresa === this.dto.idEmpresa && s.id !== this.socio?.id)
      .reduce((t, s) => t + (s.participacao ?? 0), 0);
  }

  get participacaoDisponivel(): number | null {
    const o = this.participacaoOutros;
    return o == null ? null : Math.max(0, Math.round((100 - o) * 100) / 100);
  }

  get excedeCapital(): boolean {
    const o = this.participacaoOutros;
    return o != null && this.dto.participacao != null && o + Number(this.dto.participacao) > 100.0001;
  }

  limparErro(campo: string): void {
    if (this.erros[campo]) delete this.erros[campo];
  }

  validar(): boolean {
    this.erros = {};
    if (!this.dto.nome.trim()) this.erros['nome'] = 'Informe o nome completo do sócio.';
    const cpf = this.dto.cpf.replace(/\D/g, '');
    if (!cpf) this.erros['cpf'] = 'Informe o CPF.';
    else if (cpf.length !== 11) this.erros['cpf'] = 'O CPF deve ter 11 dígitos.';
    if (!this.dto.idEmpresa || this.dto.idEmpresa === 0) this.erros['idEmpresa'] = 'Selecione a empresa.';
    const p = this.dto.participacao;
    if (p != null && (isNaN(Number(p)) || Number(p) < 0 || Number(p) > 100)) {
      this.erros['participacao'] = 'Informe um percentual entre 0 e 100.';
    }
    return Object.keys(this.erros).length === 0;
  }

  salvar(): void {
    if (this.salvando) return;
    if (!this.validar()) {
      setTimeout(() => (document.querySelector('.modal .is-invalid') as HTMLElement | null)?.focus());
      return;
    }
    this.salvando = true;
    this.erroGeral = '';

    const participacao = this.dto.participacao === null || (this.dto.participacao as unknown) === ''
      ? null : Number(this.dto.participacao);
    const dtoLimpo: SocioRequestDTO = {
      ...this.dto,
      nome: this.dto.nome.trim(),
      cpf: this.dto.cpf.replace(/\D/g, ''),
      participacao
    };

    const novo = this.modo === 'novo';
    const request = novo
      ? this.socioService.salvar(dtoLimpo)
      : this.socioService.atualizar(this.socio!.id!, dtoLimpo);

    request.subscribe({
      next: () => {
        this.salvando = false;
        this.toast.success(novo ? 'Sócio cadastrado' : 'Alterações salvas',
          `${dtoLimpo.nome} · ${this.getNomeEmpresa(dtoLimpo.idEmpresa)}`);
        this.salvo.emit();
      },
      error: (err) => {
        this.salvando = false;
        const msg = typeof err?.error === 'string' ? err.error : err?.error?.message;
        this.erroGeral = msg || 'Erro ao salvar sócio. Verifique os dados e tente novamente.';
        this.toast.error('Não foi possível salvar o sócio', msg || undefined);
      }
    });
  }

  tentarFechar(): void {
    if (!this.salvando) this.fechar.emit();
  }

  @HostListener('document:keydown.escape')
  onEsc(): void {
    this.tentarFechar();
  }
}
