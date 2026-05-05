import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { SafePipe } from '../../pipes/safe.pipe';
import { ArquivoService } from '../../services/arquivo.service';
import { PastaService } from '../../services/pasta.service';
import { EmpresaService } from '../../services/empresa.service';
import { AuthService } from '../../services/auth.service';
import { ArquivoResponseDTO } from '../../models/arquivo-response.dto';
import { PastaResponseDTO } from '../../models/pasta-response.dto';
import { EmpresaResponseDTO } from '../../models/empresa-response.dto';
import { PastaRequestDTO } from '../../models/pasta-request.dto';
import { StatusArquivo, StatusArquivoLabel } from '../../models/enums/status-arquivo.enum';
import { ArquivoFormComponent } from '../arquivo/arquivo-form/arquivo-form.component';

type Crumb = { id: number | null; nome: string };

@Component({
  selector: 'app-explorer',
  standalone: true,
  imports: [CommonModule, FormsModule, ArquivoFormComponent, SafePipe],
  templateUrl: './explorer.component.html',
  styleUrl: './explorer.component.css'
})
export class ExplorerComponent implements OnInit {

  empresas: EmpresaResponseDTO[] = [];
  pastas: PastaResponseDTO[] = [];
  arquivos: ArquivoResponseDTO[] = [];

  idEmpresaSelecionada: number | null = null;
  pastaAtualId: number | null = null;
  breadcrumb: Crumb[] = [];

  termoBusca = '';

  carregando = false;
  isAdmin = false;

  statusLabel = StatusArquivoLabel;

  arquivoArrastadoId: number | null = null;
  dropTargetId: number | 'parent' | null = null;

  painelUploadAberto = false;

  criandoPasta = false;
  nomeNovaPasta = '';

  arquivoParaDeletar: ArquivoResponseDTO | null = null;
  pastaParaDeletar: PastaResponseDTO | null = null;
  deletando = false;

  menuAbertoId: string | null = null;
  menuPosicao = { top: 0, left: 0 };

  // ================= AÇÕES EM MASSA =================
  arquivosSelecionados = new Set<number>();
  baixandoEmMassa = false;

  // ================= PREVIEW DE ARQUIVOS =================
  previewAberto = false;
  arquivoPreview: ArquivoResponseDTO | null = null;
  previewUrl: string | null = null;
  previewTipo: 'imagem' | 'pdf' | 'outro' = 'outro';
  previewErro = false;

  toastVisivel = false;
  toastMensagem = '';
  toastErro = false;

  constructor(
    private arquivoService: ArquivoService,
    private pastaService: PastaService,
    private empresaService: EmpresaService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.isAdmin = this.authService.isAdmin();
    this.carregando = true;

    this.empresaService.listar().subscribe({
      next: (empresas) => {
        this.empresas = empresas;

        if (!this.isAdmin) {
          this.idEmpresaSelecionada = this.authService.getEmpresaId();
        } else if (empresas.length > 0) {
          this.idEmpresaSelecionada = empresas[0].id!;
        }
        this.carregarDadosEmpresa();
      },
      error: () => { this.carregando = false; }
    });
  }

  carregarDadosEmpresa(): void {
    if (!this.idEmpresaSelecionada) {
      this.pastas = [];
      this.arquivos = [];
      this.carregando = false;
      return;
    }

    this.carregando = true;
    this.pastaAtualId = null;
    this.breadcrumb = [];

    let pastasOk = false;
    let arquivosOk = false;
    const done = () => { if (pastasOk && arquivosOk) this.carregando = false; };

    this.pastaService.buscarPorEmpresa(this.idEmpresaSelecionada).subscribe({
      next: (p) => { this.pastas = p; pastasOk = true; done(); },
      error: () => { pastasOk = true; done(); }
    });

    this.arquivoService.buscarPorEmpresa(this.idEmpresaSelecionada).subscribe({
      next: (a) => { this.arquivos = a.filter(x => !x.excluidoEm); arquivosOk = true; done(); },
      error: () => { arquivosOk = true; done(); }
    });
  }

  onEmpresaChange(): void {
    this.carregarDadosEmpresa();
  }

  // ======= navegação =======

  pastasAtuais(): PastaResponseDTO[] {
    const termo = this.termoBusca.trim().toLowerCase();
    const lista = this.pastas.filter(p => (p.idPastaPai ?? null) === this.pastaAtualId);
    if (!termo) return lista;
    return lista.filter(p =>
      p.nome.toLowerCase().includes(termo) ||
      (p.descricao?.toLowerCase().includes(termo) ?? false)
    );
  }

  arquivosAtuais(): ArquivoResponseDTO[] {
    const termo = this.termoBusca.trim().toLowerCase();
    const lista = this.arquivos.filter(a => a.idPasta === this.pastaAtualId);
    if (!termo) return lista;
    return lista.filter(a =>
      a.nomeOriginal.toLowerCase().includes(termo) ||
      (a.descricao?.toLowerCase().includes(termo) ?? false)
    );
  }

  entrarPasta(pasta: PastaResponseDTO): void {
    this.pastaAtualId = pasta.id!;
    this.rebuildBreadcrumb();
    this.menuAbertoId = null;
  }

  irParaCrumb(crumb: Crumb, indice: number): void {
    this.pastaAtualId = crumb.id;
    this.breadcrumb = this.breadcrumb.slice(0, indice);
  }

  voltarInicio(): void {
    this.pastaAtualId = null;
    this.breadcrumb = [];
  }

  private rebuildBreadcrumb(): void {
    const crumbs: Crumb[] = [];
    let atual: PastaResponseDTO | undefined = this.pastas.find(p => p.id === this.pastaAtualId);
    while (atual) {
      crumbs.unshift({ id: atual.id!, nome: atual.nome });
      atual = atual.idPastaPai ? this.pastas.find(p => p.id === atual!.idPastaPai) : undefined;
    }
    this.breadcrumb = crumbs;
  }

  pastaPaiId(): number | null {
    if (this.pastaAtualId == null) return null;
    const atual = this.pastas.find(p => p.id === this.pastaAtualId);
    return atual?.idPastaPai ?? null;
  }

  // ======= drag & drop =======

  onDragStartArquivo(event: DragEvent, arquivo: ArquivoResponseDTO): void {
    this.arquivoArrastadoId = arquivo.id!;
    event.dataTransfer?.setData('text/plain', String(arquivo.id));
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  onDragEndArquivo(): void {
    this.arquivoArrastadoId = null;
    this.dropTargetId = null;
  }

  onDragOverPasta(event: DragEvent, idPasta: number): void {
    if (this.arquivoArrastadoId == null) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    this.dropTargetId = idPasta;
  }

  onDragLeavePasta(idPasta: number): void {
    if (this.dropTargetId === idPasta) this.dropTargetId = null;
  }

  onDropPasta(event: DragEvent, pasta: PastaResponseDTO): void {
    event.preventDefault();
    const id = this.arquivoArrastadoId;
    this.arquivoArrastadoId = null;
    this.dropTargetId = null;
    if (id == null) return;
    this.moverArquivo(id, pasta.id!);
  }

  onDragOverCrumb(event: DragEvent, crumbId: number | null): void {
    if (this.arquivoArrastadoId == null) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    this.dropTargetId = crumbId == null ? 'parent' : crumbId;
  }

  onDropCrumb(event: DragEvent, crumbId: number | null): void {
    event.preventDefault();
    const id = this.arquivoArrastadoId;
    this.arquivoArrastadoId = null;
    this.dropTargetId = null;
    if (id == null || crumbId == null) return;
    this.moverArquivo(id, crumbId);
  }

  private moverArquivo(idArquivo: number, idPasta: number): void {
    const arquivo = this.arquivos.find(a => a.id === idArquivo);
    if (!arquivo) return;
    if (arquivo.idPasta === idPasta) return;

    const pastaDestino = this.pastas.find(p => p.id === idPasta);
    if (!pastaDestino) return;

    if (pastaDestino.idEmpresa !== arquivo.idEmpresa) {
      this.mostrarToast('A pasta de destino é de outra empresa.', true);
      return;
    }

    this.arquivoService.moverParaPasta(idArquivo, idPasta).subscribe({
      next: (atualizado) => {
        const i = this.arquivos.findIndex(a => a.id === idArquivo);
        if (i !== -1) this.arquivos[i] = atualizado;
        this.mostrarToast(`"${arquivo.nomeOriginal}" movido para "${pastaDestino.nome}".`);
      },
      error: (err) => {
        const msg = err?.error?.mensagem ?? err?.error?.message ?? 'Erro ao mover arquivo.';
        this.mostrarToast(msg, true);
      }
    });
  }

  // ======= criar pasta =======

  abrirNovaPasta(): void {
    this.criandoPasta = true;
    this.nomeNovaPasta = '';
  }

  cancelarNovaPasta(): void {
    this.criandoPasta = false;
    this.nomeNovaPasta = '';
  }

  confirmarNovaPasta(): void {
    const nome = this.nomeNovaPasta.trim();
    if (!nome || !this.idEmpresaSelecionada) return;

    const dto: PastaRequestDTO = {
      nome: nome,
      descricao: undefined,
      idEmpresa: this.idEmpresaSelecionada,
      idPastaPai: this.pastaAtualId ?? undefined
    };

    this.pastaService.salvar(dto).subscribe({
      next: (nova) => {
        this.pastas = [...this.pastas, nova];
        this.criandoPasta = false;
        this.nomeNovaPasta = '';
        this.mostrarToast(`Pasta "${nova.nome}" criada.`);
      },
      error: (err) => {
        const msg = err?.error?.mensagem ?? err?.error?.message ?? 'Erro ao criar pasta.';
        this.mostrarToast(msg, true);
      }
    });
  }

  // ======= upload =======

  abrirUpload(): void {
    this.painelUploadAberto = true;
  }

  fecharUpload(): void {
    this.painelUploadAberto = false;
  }

  onArquivoSalvo(): void {
    this.fecharUpload();
    this.carregarDadosEmpresa();
    this.mostrarToast('Arquivo enviado.');
  }

  // ======= ações ======

  download(arquivo: ArquivoResponseDTO): void {
    this.menuAbertoId = null;
    this.arquivoService.download(arquivo.id!).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = arquivo.nomeOriginal;
        a.click();
        window.URL.revokeObjectURL(url);
      }
    });
  }

  confirmarDeletarArquivo(arquivo: ArquivoResponseDTO): void {
    this.arquivoParaDeletar = arquivo;
    this.menuAbertoId = null;
  }

  confirmarDeletarPasta(pasta: PastaResponseDTO): void {
    this.pastaParaDeletar = pasta;
    this.menuAbertoId = null;
  }

  cancelarDelete(): void {
    this.arquivoParaDeletar = null;
    this.pastaParaDeletar = null;
  }

  deletar(): void {
    if (this.arquivoParaDeletar) {
      this.deletando = true;
      const id = this.arquivoParaDeletar.id!;
      const nome = this.arquivoParaDeletar.nomeOriginal;
      this.arquivoService.deletar(id).subscribe({
        next: () => {
          this.deletando = false;
          this.arquivoParaDeletar = null;
          this.arquivos = this.arquivos.filter(a => a.id !== id);
          this.mostrarToast(`"${nome}" movido para a lixeira.`);
        },
        error: () => { this.deletando = false; this.mostrarToast('Erro ao excluir.', true); }
      });
    } else if (this.pastaParaDeletar) {
      this.deletando = true;
      const id = this.pastaParaDeletar.id!;
      const nome = this.pastaParaDeletar.nome;
      this.pastaService.deletar(id).subscribe({
        next: () => {
          this.deletando = false;
          this.pastaParaDeletar = null;
          this.pastas = this.pastas.filter(p => p.id !== id);
          this.mostrarToast(`Pasta "${nome}" excluída.`);
        },
        error: (err) => {
          this.deletando = false;
          const msg = err?.error?.mensagem ?? err?.error?.message ?? 'Erro ao excluir pasta.';
          this.mostrarToast(msg, true);
        }
      });
    }
  }

  // ======= menu contextual =======

  toggleMenu(key: string, event: MouseEvent): void {
    event.stopPropagation();
    if (this.menuAbertoId === key) {
      this.menuAbertoId = null;
      return;
    }
    const btn = event.currentTarget as HTMLElement;
    const rect = btn.getBoundingClientRect();
    this.menuPosicao = {
      top: rect.bottom + 4,
      left: Math.min(rect.left, window.innerWidth - 200)
    };
    this.menuAbertoId = key;
  }

  @HostListener('document:click')
  fecharMenus(): void {
    this.menuAbertoId = null;
  }

  // ======= preview de arquivos ======

  abrirPreview(arquivo: ArquivoResponseDTO): void {
    const ext = arquivo.nomeOriginal.split('.').pop()?.toLowerCase();
    const isImg = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext || '');
    const isPdf = ext === 'pdf';

    if (!isImg && !isPdf) {
      this.download(arquivo);
      return;
    }

    this.arquivoPreview = arquivo;
    this.previewTipo = isImg ? 'imagem' : 'pdf';
    this.previewErro = false;
    this.previewAberto = true;

    this.arquivoService.download(arquivo.id!).subscribe({
      next: (blob) => {
        let mimeType = blob.type;
        if (isPdf) mimeType = 'application/pdf';
        else if (ext === 'png') mimeType = 'image/png';
        else if (ext === 'jpg' || ext === 'jpeg') mimeType = 'image/jpeg';
        else if (ext === 'gif') mimeType = 'image/gif';
        else if (ext === 'svg') mimeType = 'image/svg+xml';
        else if (ext === 'webp') mimeType = 'image/webp';
        
        const typedBlob = new Blob([blob], { type: mimeType });
        this.previewUrl = window.URL.createObjectURL(typedBlob);
      },
      error: () => {
        this.previewErro = true;
        this.mostrarToast('Erro ao carregar visualização.', true);
      }
    });
  }

  fecharPreview(): void {
    this.previewAberto = false;
    this.arquivoPreview = null;
    this.previewErro = false;
    if (this.previewUrl) {
      window.URL.revokeObjectURL(this.previewUrl);
      this.previewUrl = null;
    }
  }

  downloadPreview(): void {
    if (this.arquivoPreview) {
      this.download(this.arquivoPreview);
    }
  }

  // ======= ações em massa ======

  toggleSelecao(id: number, event: Event): void {
    event.stopPropagation();
    if (this.arquivosSelecionados.has(id)) {
      this.arquivosSelecionados.delete(id);
    } else {
      this.arquivosSelecionados.add(id);
    }
  }

  isSelecionado(id: number): boolean {
    return this.arquivosSelecionados.has(id);
  }

  toggleSelecionarTodos(): void {
    const atuais = this.arquivosAtuais();
    if (this.todosSelecionados()) {
      this.arquivosSelecionados.clear();
    } else {
      atuais.forEach(a => this.arquivosSelecionados.add(a.id!));
    }
  }

  todosSelecionados(): boolean {
    const atuais = this.arquivosAtuais();
    if (atuais.length === 0) return false;
    return atuais.every(a => this.arquivosSelecionados.has(a.id!));
  }

  baixarSelecionados(): void {
    if (this.arquivosSelecionados.size === 0) return;
    this.baixandoEmMassa = true;
    this.mostrarToast('Preparando download, aguarde...');

    const zip = new JSZip();
    let processados = 0;
    const total = this.arquivosSelecionados.size;

    this.arquivosSelecionados.forEach(id => {
      const arq = this.arquivos.find(a => a.id === id);
      if (arq) {
        this.arquivoService.download(arq.id!).subscribe({
          next: (blob) => {
            zip.file(arq.nomeOriginal, blob);
            processados++;
            if (processados === total) this.gerarZip(zip);
          },
          error: () => {
            processados++;
            if (processados === total) this.gerarZip(zip);
          }
        });
      } else {
        processados++;
        if (processados === total) this.gerarZip(zip);
      }
    });
  }

  private gerarZip(zip: JSZip): void {
    zip.generateAsync({ type: 'blob' }).then(content => {
      saveAs(content, 'Arquivos_Selecionados.zip');
      this.baixandoEmMassa = false;
      this.arquivosSelecionados.clear();
      this.mostrarToast('Download concluído!');
    });
  }

  confirmarExcluirSelecionados(): void {
    if (this.arquivosSelecionados.size === 0) return;
    if (confirm(`Tem certeza que deseja mover ${this.arquivosSelecionados.size} arquivos para a lixeira?`)) {
      let processados = 0;
      const total = this.arquivosSelecionados.size;
      this.deletando = true;

      this.arquivosSelecionados.forEach(id => {
        this.arquivoService.deletar(id).subscribe({
          next: () => {
            processados++;
            if (processados === total) this.finalizarExclusaoMassa();
          },
          error: () => {
            processados++;
            if (processados === total) this.finalizarExclusaoMassa();
          }
        });
      });
    }
  }

  private finalizarExclusaoMassa(): void {
    this.deletando = false;
    this.arquivosSelecionados.clear();
    this.carregarDadosEmpresa();
    this.mostrarToast('Arquivos movidos para a lixeira.');
  }

  // ======= helpers ======

  iconeArquivo(arquivo: ArquivoResponseDTO): string {
    const t = arquivo.tipoArquivo;
    if (t === 'PDF') return 'pdf';
    if (t === 'XML') return 'xml';
    if (t === 'XLS' || t === 'XLSX' || t === 'CSV') return 'xls';
    if (t === 'DOC' || t === 'DOCX' || t === 'TXT') return 'doc';
    if (t === 'JPG' || t === 'JPEG' || t === 'PNG') return 'img';
    return 'file';
  }

  corIconeArquivo(arquivo: ArquivoResponseDTO): string {
    switch (this.iconeArquivo(arquivo)) {
      case 'pdf': return '#e53935';
      case 'xml': return '#1e88e5';
      case 'xls': return '#2e7d32';
      case 'doc': return '#1565c0';
      case 'img': return '#8e24aa';
      default: return '#757575';
    }
  }

  formatarTamanho(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  classeStatusBadge(status: StatusArquivo | null): string {
    if (!status) return 'badge';
    return `badge badge-${status.toLowerCase()}`;
  }

  private mostrarToast(mensagem: string, erro = false): void {
    this.toastMensagem = mensagem;
    this.toastErro = erro;
    this.toastVisivel = true;
    setTimeout(() => { this.toastVisivel = false; }, 3000);
  }
}
