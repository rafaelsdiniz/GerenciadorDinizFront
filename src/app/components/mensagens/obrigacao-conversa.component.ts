import { Component, ElementRef, Input, OnChanges, OnDestroy, SimpleChanges, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { MensagemDTO } from '../../models/mensagem.dto';
import { MensagemService } from '../../services/mensagem.service';
import { IconComponent } from '../../shared/icon.component';
import { ToastService } from '../../shared/ui/toast.service';
import { AvatarCorPipe, IniciaisPipe } from '../../pipes/formatos.pipe';
import { dataHoraCompleta, rotuloDia, tempoRelativo } from './mensagem.util';

interface ItemConversa {
  m: MensagemDTO;
  /** rótulo do dia quando muda em relação à mensagem anterior */
  dia: string | null;
  /** primeira das mensagens que chegaram sem ter sido lidas (divisor "Novas mensagens") */
  primeiraNova: boolean;
  /** mensagem seguida do mesmo autor (esconde cabeçalho repetido) */
  continua: boolean;
}

const POLL_MS = 20000;
const MAX = 2000;

/**
 * Conversa da obrigação entre escritório e cliente (usada dentro do drawer de detalhes).
 * Enter envia · Shift+Enter quebra linha · atualiza sozinha a cada 20s enquanto aberta.
 */
@Component({
  selector: 'app-obrigacao-conversa',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent, IniciaisPipe, AvatarCorPipe],
  templateUrl: './obrigacao-conversa.component.html',
  styleUrl: './obrigacao-conversa.component.css'
})
export class ObrigacaoConversaComponent implements OnChanges, OnDestroy {
  @Input({ required: true }) idObrigacao!: number;
  @Input() isAdmin = false;

  @ViewChild('lista') lista?: ElementRef<HTMLElement>;
  @ViewChild('campo') campo?: ElementRef<HTMLTextAreaElement>;

  readonly max = MAX;
  mensagens: MensagemDTO[] = [];
  itens: ItemConversa[] = [];
  carregando = false;
  erro = '';
  texto = '';
  enviando = false;

  /** ids das mensagens que chegaram não lidas ao abrir */
  private novas = new Set<number>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private req?: Subscription;
  /** relógio usado nos tempos relativos (renovado a cada atualização) */
  private agora = new Date();

  constructor(private service: MensagemService, private toast: ToastService, private host: ElementRef<HTMLElement>) {}

  get vazioTexto(): string {
    return `Nenhuma mensagem ainda — tire dúvidas sobre esta obrigação com ${this.isAdmin ? 'o cliente' : 'o escritório'}.`;
  }

  get placeholder(): string {
    return this.isAdmin ? 'Escreva para o cliente…' : 'Escreva para o escritório…';
  }

  get restante(): number { return MAX - this.texto.length; }
  get podeEnviar(): boolean { return !this.enviando && !!this.texto.trim() && this.texto.trim().length <= MAX; }

  ngOnChanges(ch: SimpleChanges): void {
    if (ch['idObrigacao'] && this.idObrigacao != null) {
      const trocou = !ch['idObrigacao'].firstChange && ch['idObrigacao'].previousValue !== this.idObrigacao;
      if (ch['idObrigacao'].firstChange || trocou) {
        this.mensagens = [];
        this.itens = [];
        this.texto = trocou ? '' : this.texto;
        this.carregar(false);
        this.iniciarPolling();
      }
    }
  }

  ngOnDestroy(): void {
    this.pararPolling();
    this.req?.unsubscribe();
  }

  /** silencioso = atualização periódica (sem spinner nem toast). */
  carregar(silencioso: boolean): void {
    const id = this.idObrigacao;
    if (id == null) return;
    if (!silencioso) {
      this.carregando = true;
      this.erro = '';
      // não lidas desta conversa antes de abrir (o backend marca como lidas ao listar)
      let pendentes = 0;
      const sub = this.service.naoLidas$.subscribe(n => pendentes = n.porObrigacao?.[id] ?? 0);
      sub.unsubscribe();
      this.novas.clear();
      this.req?.unsubscribe();
      this.req = this.service.conversa(id).subscribe({
        next: (lista) => {
          if (id !== this.idObrigacao) return;
          if (pendentes > 0) {
            lista.filter(m => !m.minha && m.doEscritorio !== this.isAdmin)
              .slice(-pendentes)
              .forEach(m => this.novas.add(m.id));
          }
          this.aplicar(lista, true);
          // chegou mensagem nova: traz a conversa para a vista dentro do drawer
          if (this.novas.size) setTimeout(() => this.host.nativeElement.scrollIntoView({ block: 'end', behavior: 'smooth' }), 150);
          this.carregando = false;
        },
        error: (err) => {
          if (id !== this.idObrigacao) return;
          this.carregando = false;
          this.erro = err?.status === 404 ? 'Conversa indisponível para esta obrigação.' : 'Não foi possível carregar a conversa.';
        }
      });
      return;
    }
    if (this.carregando || this.enviando) return;
    this.service.conversa(id).subscribe({
      next: (lista) => { if (id === this.idObrigacao) this.aplicar(lista, false); },
      error: () => {}
    });
  }

  private aplicar(lista: MensagemDTO[], rolar: boolean): void {
    const antes = this.mensagens;
    const mudou = lista.length !== antes.length
      || lista.some((m, i) => m.id !== antes[i]?.id || m.lidaPeloDestinatario !== antes[i]?.lidaPeloDestinatario);
    this.agora = new Date();
    if (!mudou && !rolar) { this.montar(); return; }
    const chegouNova = lista.length > antes.length;
    const perto = this.pertoDoFim();
    this.mensagens = lista;
    this.montar();
    if (rolar || (chegouNova && perto)) this.rolarParaFim();
  }

  private montar(): void {
    let diaAnterior = '';
    let novaMarcada = false;
    this.itens = this.mensagens.map((m, i) => {
      const dia = rotuloDia(m.dataCriacao, this.agora);
      const anterior = this.mensagens[i - 1];
      const nova = this.novas.has(m.id);
      const item: ItemConversa = {
        m,
        dia: dia !== diaAnterior ? dia : null,
        primeiraNova: nova && !novaMarcada,
        continua: !!anterior && dia === diaAnterior && anterior.idAutor === m.idAutor && !nova
      };
      if (nova) novaMarcada = true;
      diaAnterior = dia;
      return item;
    });
  }

  enviar(): void {
    const texto = this.texto.trim();
    if (!texto || this.enviando) return;
    if (texto.length > MAX) {
      this.toast.warning('Mensagem muito longa', `O limite é de ${MAX} caracteres.`);
      return;
    }
    const id = this.idObrigacao;
    this.enviando = true;
    this.service.enviar(id, { texto }).subscribe({
      next: (m) => {
        this.enviando = false;
        if (id !== this.idObrigacao) return;
        this.texto = '';
        this.novas.clear();
        this.mensagens = [...this.mensagens.filter(x => x.id !== m.id), m];
        this.agora = new Date();
        this.montar();
        this.rolarParaFim();
        setTimeout(() => this.campo?.nativeElement.focus());
      },
      error: (err) => {
        this.enviando = false;
        this.toast.error('Mensagem não enviada', err?.error?.mensagem || 'Verifique sua conexão e tente novamente.');
      }
    });
  }

  /** Enter envia; Shift+Enter quebra a linha. */
  aoTeclar(e: KeyboardEvent): void {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      this.enviar();
    }
  }

  // ------------------------------------------------------------ exibição
  tempo(iso: string): string { return tempoRelativo(iso, this.agora); }
  dataHora(iso: string): string { return dataHoraCompleta(iso); }
  papel(m: MensagemDTO): string { return m.doEscritorio ? 'Escritório' : 'Cliente'; }

  // ------------------------------------------------------------- suporte
  private iniciarPolling(): void {
    this.pararPolling();
    this.timer = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      this.carregar(true);
    }, POLL_MS);
  }

  private pararPolling(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private pertoDoFim(): boolean {
    const el = this.lista?.nativeElement;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }

  private rolarParaFim(): void {
    setTimeout(() => {
      const el = this.lista?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }
}
