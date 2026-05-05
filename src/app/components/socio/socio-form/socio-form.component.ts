import { Component, Input, Output, EventEmitter, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SocioService } from '../../../services/socio.service';
import { SocioRequestDTO } from '../../../models/socio-request.dto';
import { SocioResponseDTO } from '../../../models/socio-response.dto';
import { EmpresaResponseDTO } from '../../../models/empresa-response.dto';

@Component({
  selector: 'app-socio-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './socio-form.component.html',
  styleUrl: './socio-form.component.css'
})
export class SocioFormComponent implements OnChanges {

  @Input() socio: SocioResponseDTO | null = null;
  @Input() modo: 'novo' | 'editar' | 'detalhes' = 'novo';
  @Input() empresas: EmpresaResponseDTO[] = [];

  @Output() fechar = new EventEmitter<void>();
  @Output() salvo = new EventEmitter<void>();

  dto: SocioRequestDTO = this.dtoVazio();
  erros: Record<string, string> = {};
  erroGeral = '';
  salvando = false;

  constructor(private socioService: SocioService) {}

  ngOnChanges(): void {
    this.erros = {};
    this.erroGeral = '';

    if (this.modo === 'editar' && this.socio) {
      this.dto = this.fromSocio(this.socio);
    } else {
      this.dto = this.dtoVazio();
    }
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
    if (this.socio) {
      this.dto = this.fromSocio(this.socio);
    }
  }

  getNomeEmpresa(idEmpresa: number): string {
    return this.empresas.find(e => e.id === idEmpresa)?.nomeFantasia ?? '—';
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
  }

  validar(): boolean {
    this.erros = {};
    if (!this.dto.nome.trim()) this.erros['nome'] = 'Nome é obrigatório.';
    if (!this.dto.cpf.trim()) this.erros['cpf'] = 'CPF é obrigatório.';
    if (!this.dto.idEmpresa || this.dto.idEmpresa === 0) this.erros['idEmpresa'] = 'Empresa é obrigatória.';
    return Object.keys(this.erros).length === 0;
  }

  salvar(): void {
    if (!this.validar()) return;
    this.salvando = true;
    this.erroGeral = '';

    const dtoLimpo: SocioRequestDTO = {
      ...this.dto,
      cpf: this.dto.cpf.replace(/\D/g, '')
    };

    const request = this.modo === 'novo'
      ? this.socioService.salvar(dtoLimpo)
      : this.socioService.atualizar(this.socio!.id!, dtoLimpo);

    request.subscribe({
      next: () => {
        this.salvando = false;
        this.salvo.emit();
      },
      error: () => {
        this.salvando = false;
        this.erroGeral = 'Erro ao salvar sócio. Verifique os dados e tente novamente.';
      }
    });
  }
}