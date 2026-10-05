import { Component, EventEmitter, HostListener, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ObrigacaoPendenteResponseDTO } from '../../../models/obrigacao-pendente-response.dto';
import { PastaResponseDTO } from '../../../models/pasta-response.dto';
import { ArquivoResponseDTO } from '../../../models/arquivo-response.dto';
import { ArquivoService } from '../../../services/arquivo.service';
import { PastaService } from '../../../services/pasta.service';
import { AuthService } from '../../../services/auth.service';
import { IconComponent } from '../../../shared/icon.component';
import { BytesPipe } from '../../../pipes/formatos.pipe';
import { visualTipo, VisualTipo } from '../../explorer/tipo-arquivo.util';
import { caminhoPasta, isCliente, mensagemErro, rotuloAnexar, sugerirCategoria, sugerirPasta } from '../obrigacao.util';

const MAX_BYTES = 50 * 1024 * 1024;

/**
 * Modal "Anexar guia" / "Enviar documento": envia um arquivo vinculado à obrigação.
 * O backend vincula o arquivo e marca a obrigação como ENTREGUE na data de hoje.
 */
@Component({
  selector: 'app-obrigacao-anexar',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent, BytesPipe],
  templateUrl: './obrigacao-anexar.component.html',
  styleUrl: './obrigacao-anexar.component.css'
})
export class ObrigacaoAnexarComponent implements OnInit {
  @Input({ required: true }) obrigacao!: ObrigacaoPendenteResponseDTO;
  @Input() empresa = '';
  @Output() fechar = new EventEmitter<void>();
  @Output() enviado = new EventEmitter<ArquivoResponseDTO>();

  pastas: { id: number; caminho: string }[] = [];
  carregandoPastas = true;
  idPasta: number | null = null;
  descricao = '';
  arquivo: File | null = null;
  visual: VisualTipo | null = null;
  arrastando = false;
  enviando = false;
  erro = '';
  erroArquivo = '';

  constructor(
    private arquivoService: ArquivoService,
    private pastaService: PastaService,
    private auth: AuthService
  ) {}

  get titulo(): string { return rotuloAnexar(this.obrigacao); }
  get cliente(): boolean { return isCliente(this.obrigacao); }

  ngOnInit(): void {
    this.pastaService.buscarPorEmpresa(this.obrigacao.idEmpresa).subscribe({
      next: (lista) => {
        this.montarPastas(lista);
        this.carregandoPastas = false;
      },
      error: (err) => {
        this.carregandoPastas = false;
        this.erro = 'Não foi possível carregar as pastas da empresa. ' + mensagemErro(err, '');
      }
    });
  }

  private montarPastas(lista: PastaResponseDTO[]): void {
    this.pastas = lista
      .map(f => ({ id: f.id, caminho: caminhoPasta(f, lista) }))
      .sort((a, b) => a.caminho.localeCompare(b.caminho, 'pt-BR'));
    this.idPasta = sugerirPasta(this.obrigacao, lista)?.id ?? null;
  }

  // ------------------------------------------------------------- arquivo
  onDragOver(e: DragEvent): void {
    e.preventDefault();
    if (!this.enviando) this.arrastando = true;
  }

  onDragLeave(e: DragEvent): void {
    e.preventDefault();
    this.arrastando = false;
  }

  onDrop(e: DragEvent): void {
    e.preventDefault();
    this.arrastando = false;
    if (this.enviando) return;
    const f = e.dataTransfer?.files?.[0];
    if (f) this.selecionar(f);
  }

  onInput(e: Event): void {
    const input = e.target as HTMLInputElement;
    const f = input.files?.[0];
    if (f) this.selecionar(f);
    input.value = '';
  }

  private selecionar(f: File): void {
    this.erro = '';
    if (f.size > MAX_BYTES) {
      this.erroArquivo = 'O arquivo excede o limite de 50 MB.';
      return;
    }
    this.erroArquivo = '';
    this.arquivo = f;
    this.visual = visualTipo(f.name);
  }

  remover(): void {
    if (this.enviando) return;
    this.arquivo = null;
    this.visual = null;
  }

  // --------------------------------------------------------------- envio
  get podeEnviar(): boolean {
    return !!this.arquivo && !!this.idPasta && !this.enviando && !this.carregandoPastas;
  }

  enviar(): void {
    if (!this.arquivo) { this.erroArquivo = 'Selecione um arquivo.'; return; }
    if (!this.idPasta) { this.erro = 'Selecione a pasta de destino.'; return; }
    const idUsuario = this.auth.getUsuarioId();
    if (idUsuario == null) { this.erro = 'Sessão expirada. Entre novamente.'; return; }

    this.enviando = true;
    this.erro = '';
    this.arquivoService.upload({
      arquivo: this.arquivo,
      idEmpresa: this.obrigacao.idEmpresa,
      idUsuario,
      idPasta: this.idPasta,
      descricao: this.descricao.trim() || null,
      idObrigacaoPendente: this.obrigacao.id,
      categoriaFiscal: sugerirCategoria(this.obrigacao),
      dataVencimento: this.cliente ? null : this.obrigacao.dataVencimento
    }).subscribe({
      next: (a) => {
        this.enviando = false;
        this.enviado.emit(a);
      },
      error: (err) => {
        this.enviando = false;
        this.erro = err?.status === 413
          ? 'O arquivo é grande demais para o servidor.'
          : mensagemErro(err, 'Não foi possível enviar o arquivo.');
      }
    });
  }

  tentarFechar(): void {
    if (!this.enviando) this.fechar.emit();
  }

  @HostListener('document:keydown.escape')
  onEsc(): void {
    this.tentarFechar();
  }
}
