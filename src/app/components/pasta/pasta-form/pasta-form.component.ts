import { AfterViewInit, Component, ElementRef, EventEmitter, HostListener, Input, OnChanges, Output, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PastaService } from '../../../services/pasta.service';
import { PastaRequestDTO } from '../../../models/pasta-request.dto';
import { PastaResponseDTO } from '../../../models/pasta-response.dto';
import { EmpresaResponseDTO } from '../../../models/empresa-response.dto';
import { IconComponent } from '../../../shared/icon.component';
import { ToastService } from '../../../shared/ui/toast.service';

@Component({
  selector: 'app-pasta-form',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './pasta-form.component.html',
  styleUrl: './pasta-form.component.css'
})
export class PastaFormComponent implements OnChanges, AfterViewInit {
  private pastaService = inject(PastaService);
  private toast = inject(ToastService);

  @Input() pasta: PastaResponseDTO | null = null;
  @Input() modo: 'novo' | 'editar' | 'detalhes' = 'novo';
  @Input() empresas: EmpresaResponseDTO[] = [];
  @Input() pastas: PastaResponseDTO[] = [];

  @Output() fechar = new EventEmitter<void>();
  @Output() salvo = new EventEmitter<void>();

  @ViewChild('primeiroCampo') primeiroCampo?: ElementRef<HTMLInputElement>;

  dto: PastaRequestDTO = this.dtoVazio();
  erros: Record<string, string> = {};
  erroGeral = '';
  salvando = false;

  /** Pastas que podem ser pai: mesma empresa e diferente da própria pasta. */
  get pastasDisponiveis(): PastaResponseDTO[] {
    return this.pastas.filter(p => p.id !== this.pasta?.id && (!this.dto.idEmpresa || p.idEmpresa === this.dto.idEmpresa));
  }

  ngOnChanges(): void {
    this.erros = {};
    this.erroGeral = '';
    this.dto = this.modo === 'editar' && this.pasta ? this.fromPasta(this.pasta) : this.dtoVazio();
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.primeiroCampo?.nativeElement.focus(), 60);
  }

  dtoVazio(): PastaRequestDTO {
    return { nome: '', descricao: '', idEmpresa: 0, idPastaPai: null };
  }

  private fromPasta(p: PastaResponseDTO): PastaRequestDTO {
    return { nome: p.nome, descricao: p.descricao, idEmpresa: p.idEmpresa, idPastaPai: p.idPastaPai ?? null };
  }

  irParaEdicao(): void {
    this.modo = 'editar';
    if (this.pasta) this.dto = this.fromPasta(this.pasta);
    setTimeout(() => this.primeiroCampo?.nativeElement.focus(), 30);
  }

  onEmpresaChange(): void {
    delete this.erros['idEmpresa'];
    if (this.dto.idPastaPai && !this.pastasDisponiveis.some(p => p.id === this.dto.idPastaPai)) this.dto.idPastaPai = null;
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
    if (!this.dto.nome.trim()) this.erros['nome'] = 'Informe o nome da pasta.';
    if (!this.dto.idEmpresa || this.dto.idEmpresa === 0) this.erros['idEmpresa'] = 'Selecione a empresa.';
    return Object.keys(this.erros).length === 0;
  }

  salvar(): void {
    if (this.salvando || !this.validar()) return;
    this.salvando = true;
    this.erroGeral = '';

    const novo = this.modo === 'novo';
    const request = novo
      ? this.pastaService.salvar(this.dto)
      : this.pastaService.atualizar(this.pasta!.id!, this.dto);

    request.subscribe({
      next: () => {
        this.salvando = false;
        this.toast.success(novo ? 'Pasta criada' : 'Pasta atualizada', this.dto.nome);
        this.salvo.emit();
      },
      error: () => {
        this.salvando = false;
        this.erroGeral = 'Erro ao salvar pasta. Verifique os dados e tente novamente.';
        this.toast.error('Não foi possível salvar a pasta');
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
