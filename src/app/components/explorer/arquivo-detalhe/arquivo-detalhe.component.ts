import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { SafePipe } from '../../../pipes/safe.pipe';
import { AvatarCorPipe, BytesPipe, IniciaisPipe, PrazoPipe, PrazoTomPipe } from '../../../pipes/formatos.pipe';
import { IconComponent } from '../../../shared/icon.component';
import { ToastService } from '../../../shared/ui/toast.service';
import { ArquivoService } from '../../../services/arquivo.service';
import { ObrigacaoPendenteService } from '../../../services/obrigacao-pendente.service';
import { ArquivoResponseDTO } from '../../../models/arquivo-response.dto';
import { StatusArquivo, StatusArquivoLabel } from '../../../models/enums/status-arquivo.enum';
import { CategoriaFiscalLabel } from '../../../models/enums/categoria-fiscal.enum';
import { EXT_IMAGEM, extensao, mostraPrazo, tomStatus, visualTipo, VisualTipo } from '../tipo-arquivo.util';
import { DadosLeituraComponent } from '../../ia/dados-leitura/dados-leitura.component';

/**
 * Detalhes de um arquivo com pré-visualização (imagem/PDF) e edição rápida (admin).
 * `modo="drawer"`: painel lateral sobreposto (com fundo escurecido).
 * `modo="painel"`: coluna embutida na página (painel "ⓘ" estilo Drive).
 */
@Component({
  selector: 'app-arquivo-detalhe',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, SafePipe, IconComponent, BytesPipe, PrazoPipe, PrazoTomPipe, IniciaisPipe, AvatarCorPipe, DadosLeituraComponent],
  templateUrl: './arquivo-detalhe.component.html',
  styleUrl: './arquivo-detalhe.component.css'
})
export class ArquivoDetalheComponent implements OnChanges, OnDestroy {
  private arquivoService = inject(ArquivoService);
  private obrigacaoService = inject(ObrigacaoPendenteService);
  private toast = inject(ToastService);

  @Input({ required: true }) arquivo!: ArquivoResponseDTO;
  @Input() modo: 'drawer' | 'painel' = 'drawer';
  @Input() isAdmin = false;
  @Input() caminho = '';
  @Input() nomeEmpresa = '';

  @Output() fechar = new EventEmitter<void>();
  @Output() baixar = new EventEmitter<ArquivoResponseDTO>();
  @Output() mover = new EventEmitter<ArquivoResponseDTO>();
  @Output() excluir = new EventEmitter<ArquivoResponseDTO>();
  @Output() irParaPasta = new EventEmitter<ArquivoResponseDTO>();
  @Output() atualizado = new EventEmitter<ArquivoResponseDTO>();
  /** Painel embutido → abrir a visualização grande (drawer). */
  @Output() expandir = new EventEmitter<ArquivoResponseDTO>();

  readonly statusLabel = StatusArquivoLabel;
  readonly categoriaLabel = CategoriaFiscalLabel;
  readonly statusOpcoes = Object.values(StatusArquivo);

  previewUrl: string | null = null;
  previewTipo: 'imagem' | 'pdf' | 'outro' = 'outro';
  previewErro = false;
  editStatus: StatusArquivo | '' = '';
  editVencimento = '';
  salvando = false;
  v: VisualTipo = visualTipo('');
  /** Nome da obrigação vinculada (carregado sob demanda). */
  obrigacaoNome: string | null = null;
  obrigacaoCompetencia: string | null = null;

  get emPainel(): boolean { return this.modo === 'painel'; }

  ngOnChanges(ch: SimpleChanges): void {
    const mudou = ch['arquivo'];
    if (!mudou) return;
    const anterior = mudou.previousValue as ArquivoResponseDTO | undefined;
    this.v = visualTipo(this.arquivo.nomeOriginal, this.arquivo.tipoArquivo);
    this.editStatus = this.arquivo.status ?? '';
    this.editVencimento = this.arquivo.dataVencimento ?? '';
    if (anterior?.id !== this.arquivo.id) this.carregarPreview();
    if (anterior?.idObrigacaoPendente !== this.arquivo.idObrigacaoPendente || anterior?.id !== this.arquivo.id) this.carregarObrigacao();
  }

  ngOnDestroy(): void { this.liberar(); }

  private carregarObrigacao(): void {
    this.obrigacaoNome = null;
    this.obrigacaoCompetencia = null;
    const id = this.arquivo.idObrigacaoPendente;
    if (id == null) return;
    const idArquivo = this.arquivo.id;
    this.obrigacaoService.buscarPorId(id).subscribe({
      next: (o) => {
        if (this.arquivo.id !== idArquivo) return;
        this.obrigacaoNome = o.nomeObrigacao || 'Obrigação';
        this.obrigacaoCompetencia = o.competencia ?? null;
      },
      error: () => { if (this.arquivo.id === idArquivo) this.obrigacaoNome = `Obrigação nº ${id}`; }
    });
  }

  private carregarPreview(): void {
    this.liberar();
    this.previewErro = false;
    const a = this.arquivo;
    const ext = extensao(a.nomeOriginal, a.tipoArquivo);
    const isImg = EXT_IMAGEM.includes(ext);
    const isPdf = ext === 'pdf';
    this.previewTipo = isImg ? 'imagem' : isPdf ? 'pdf' : 'outro';
    if (this.previewTipo === 'outro') return;

    this.arquivoService.download(a.id).subscribe({
      next: (blob) => {
        if (this.arquivo.id !== a.id) return;
        let mimeType = blob.type;
        if (isPdf) mimeType = 'application/pdf';
        else if (ext === 'png') mimeType = 'image/png';
        else if (ext === 'jpg' || ext === 'jpeg') mimeType = 'image/jpeg';
        else if (ext === 'gif') mimeType = 'image/gif';
        else if (ext === 'svg') mimeType = 'image/svg+xml';
        else if (ext === 'webp') mimeType = 'image/webp';
        this.previewUrl = window.URL.createObjectURL(new Blob([blob], { type: mimeType }));
      },
      error: () => { if (this.arquivo.id === a.id) this.previewErro = true; }
    });
  }

  private liberar(): void {
    if (this.previewUrl) {
      window.URL.revokeObjectURL(this.previewUrl);
      this.previewUrl = null;
    }
  }

  abrirNovaAba(): void {
    if (this.previewUrl) window.open(this.previewUrl, '_blank', 'noopener');
  }

  get prazoValor(): number | string | null { return this.arquivo.diasParaVencer ?? this.arquivo.dataVencimento; }

  get mostrarPrazo(): boolean { return mostraPrazo(this.arquivo); }

  tomStatus(s: string | null | undefined): string { return tomStatus(s); }

  get alterado(): boolean {
    const a = this.arquivo;
    return (!!this.editStatus && this.editStatus !== a.status)
      || (!!this.editVencimento && this.editVencimento !== (a.dataVencimento ?? ''));
  }

  salvar(): void {
    const a = this.arquivo;
    if (!this.alterado || this.salvando) return;
    let obs: Observable<ArquivoResponseDTO> | null = null;
    if (this.editStatus && this.editStatus !== a.status) obs = this.arquivoService.atualizarStatus(a.id, this.editStatus);
    if (this.editVencimento && this.editVencimento !== (a.dataVencimento ?? '')) {
      const venc = this.editVencimento;
      obs = obs
        ? obs.pipe(switchMap(() => this.arquivoService.atualizarVencimento(a.id, venc)))
        : this.arquivoService.atualizarVencimento(a.id, venc);
    }
    if (!obs) return;
    this.salvando = true;
    obs.subscribe({
      next: (novo) => {
        this.salvando = false;
        this.atualizado.emit(novo);
        this.toast.success('Alterações salvas', `"${novo.nomeOriginal}"`);
      },
      error: (err) => {
        this.salvando = false;
        this.toast.error('Erro ao salvar alterações', err?.error?.mensagem ?? err?.error?.message ?? 'Tente novamente em instantes.');
      }
    });
  }
}
