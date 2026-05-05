import { Component, Input, Output, EventEmitter, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PastaService } from '../../../services/pasta.service';
import { PastaRequestDTO } from '../../../models/pasta-request.dto';
import { PastaResponseDTO } from '../../../models/pasta-response.dto';
import { EmpresaResponseDTO } from '../../../models/empresa-response.dto';

@Component({
  selector: 'app-pasta-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './pasta-form.component.html',
  styleUrl: './pasta-form.component.css'
})
export class PastaFormComponent implements OnChanges {

  @Input() pasta: PastaResponseDTO | null = null;
  @Input() modo: 'novo' | 'editar' | 'detalhes' = 'novo';
  @Input() empresas: EmpresaResponseDTO[] = [];
  @Input() pastas: PastaResponseDTO[] = [];

  @Output() fechar = new EventEmitter<void>();
  @Output() salvo = new EventEmitter<void>();

  dto: PastaRequestDTO = this.dtoVazio();
  erros: Record<string, string> = {};
  erroGeral = '';
  salvando = false;

  constructor(private pastaService: PastaService) {}

  get pastasDisponiveis(): PastaResponseDTO[] {
    // Exclui a própria pasta para não ser pai de si mesma
    return this.pastas.filter(p => p.id !== this.pasta?.id);
  }

  ngOnChanges(): void {
    this.erros = {};
    this.erroGeral = '';

    if (this.modo === 'editar' && this.pasta) {
      this.dto = {
        nome: this.pasta.nome,
        descricao: this.pasta.descricao,
        idEmpresa: this.pasta.idEmpresa,
        idPastaPai: this.pasta.idPastaPai ?? null
      };
    } else {
      this.dto = this.dtoVazio();
    }
  }

  dtoVazio(): PastaRequestDTO {
    return { nome: '', descricao: '', idEmpresa: 0, idPastaPai: null };
  }

  irParaEdicao(): void {
    this.modo = 'editar';
    if (this.pasta) {
      this.dto = {
        nome: this.pasta.nome,
        descricao: this.pasta.descricao,
        idEmpresa: this.pasta.idEmpresa,
        idPastaPai: this.pasta.idPastaPai ?? null
      };
    }
  }

  getNomeEmpresa(idEmpresa: number): string {
    return this.empresas.find(e => e.id === idEmpresa)?.nomeFantasia ?? '—';
  }

  getNomePasta(idPastaPai?: number | null): string {
    if (!idPastaPai) return '—';
    return this.pastas.find(p => p.id === idPastaPai)?.nome ?? '—';
  }

  validar(): boolean {
    this.erros = {};
    if (!this.dto.nome.trim()) this.erros['nome'] = 'Nome é obrigatório.';
    if (!this.dto.idEmpresa || this.dto.idEmpresa === 0) this.erros['idEmpresa'] = 'Empresa é obrigatória.';
    return Object.keys(this.erros).length === 0;
  }

  salvar(): void {
    if (!this.validar()) return;
    this.salvando = true;
    this.erroGeral = '';

    const request = this.modo === 'novo'
      ? this.pastaService.salvar(this.dto)
      : this.pastaService.atualizar(this.pasta!.id!, this.dto);

    request.subscribe({
      next: () => {
        this.salvando = false;
        this.salvo.emit();
      },
      error: () => {
        this.salvando = false;
        this.erroGeral = 'Erro ao salvar pasta. Verifique os dados e tente novamente.';
      }
    });
  }
}