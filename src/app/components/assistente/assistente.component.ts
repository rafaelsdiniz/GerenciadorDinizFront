import { ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { Subscription, filter } from 'rxjs';
import { IconComponent } from '../../shared/icon.component';
import { AssistenteAcao, AssistenteStatus } from '../../services/assistente.service';
import { AssistenteConversaService, AssistenteMensagem } from '../../services/assistente-conversa.service';

// mantido para quem importava daqui
export { renderizarMarkdownLeve } from './assistente-markdown';

/** Rota da página dedicada: nela o botão flutuante some (a conversa é a mesma). */
export const ROTA_PAGINA_ASSISTENTE = '/assistente';

@Component({
  selector: 'app-assistente',
  standalone: true,
  imports: [FormsModule, RouterLink, IconComponent],
  templateUrl: './assistente.component.html',
  styleUrl: './assistente.component.css'
})
export class AssistenteComponent implements OnInit, OnDestroy {
  @ViewChild('lista') lista?: ElementRef<HTMLElement>;
  @ViewChild('campo') campo?: ElementRef<HTMLTextAreaElement>;
  @ViewChild('fab') fab?: ElementRef<HTMLButtonElement>;

  readonly max: number;

  aberto = false;
  pulsar = false;
  naoLida = false;
  /** na tela Arquivos (mobile) o botão sobe para não cobrir o botão "+" do Drive */
  acimaFab = false;
  /** na página /assistente o widget fica escondido */
  naPagina = false;

  texto = '';

  private subs: Subscription[] = [];
  private destruido = false;

  constructor(
    private conversa: AssistenteConversaService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {
    this.max = conversa.max;
  }

  ngOnInit(): void {
    this.conversa.sincronizarUsuario();
    try { this.pulsar = localStorage.getItem('assistente-diniz:visto') !== '1'; } catch { this.pulsar = true; }
    this.aoNavegar(this.router.url);
    this.subs.push(
      this.router.events.pipe(filter(e => e instanceof NavigationEnd))
        .subscribe(e => this.aoNavegar((e as NavigationEnd).urlAfterRedirects)),
      this.conversa.mudou$.subscribe(() => { if (this.aberto) this.rolarDepois(); }),
      this.conversa.resposta$.subscribe(() => { if (!this.aberto && !this.naPagina) this.naoLida = true; })
    );
  }

  ngOnDestroy(): void {
    this.destruido = true;
    this.subs.forEach(s => s.unsubscribe());
  }

  private aoNavegar(url: string): void {
    this.acimaFab = url.startsWith('/arquivos');
    this.naPagina = url.split(/[?#]/)[0] === ROTA_PAGINA_ASSISTENTE;
    if (this.naPagina) { this.aberto = false; this.naoLida = false; }
  }

  // ------------------------------------------------------------------ estado (compartilhado)

  get status(): AssistenteStatus | null { return this.conversa.status(); }
  get carregandoStatus(): boolean { return this.conversa.carregandoStatus(); }
  get mensagens(): AssistenteMensagem[] { return this.conversa.mensagens(); }
  get enviando(): boolean { return this.conversa.enviando(); }
  get ia(): boolean { return this.conversa.ia(); }
  get nome(): string { return this.conversa.nome(); }
  get sugestoes(): string[] { return this.conversa.sugestoes(); }

  get podeEnviar(): boolean {
    const t = this.texto.trim();
    return !this.enviando && t.length > 0 && t.length <= this.max;
  }

  // ------------------------------------------------------------------ painel

  abrir(): void {
    this.aberto = true;
    this.naoLida = false;
    if (this.pulsar) {
      this.pulsar = false;
      try { localStorage.setItem('assistente-diniz:visto', '1'); } catch { /* sem storage */ }
    }
    this.conversa.carregarStatus();
    this.depoisDeRenderizar(() => { this.rolarParaFim(); this.campo?.nativeElement.focus(); });
  }

  minimizar(): void {
    this.aberto = false;
    this.depoisDeRenderizar(() => this.fab?.nativeElement.focus());
  }

  fechar(): void {
    this.minimizar();
  }

  limpar(): void {
    this.conversa.limpar();
    this.campo?.nativeElement.focus();
  }

  // ------------------------------------------------------------------ conversa

  usarSugestao(s: string): void {
    this.texto = s;
    this.enviar();
  }

  aoTeclar(ev: KeyboardEvent): void {
    if (ev.key === 'Enter' && !ev.shiftKey && !ev.isComposing) {
      ev.preventDefault();
      this.enviar();
    }
  }

  ajustarAltura(): void {
    const el = this.campo?.nativeElement;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 132) + 'px';
  }

  enviar(repetir?: string): void {
    if (repetir) {
      this.conversa.enviar(repetir, true);
      return;
    }
    if (this.conversa.enviar(this.texto)) {
      this.texto = '';
      this.depoisDeRenderizar(() => this.ajustarAltura());
    }
  }

  /** Navega pela ação sugerida e minimiza o painel. */
  irPara(ev: MouseEvent, a: AssistenteAcao): void {
    if (ev.ctrlKey || ev.metaKey || ev.shiftKey || ev.button !== 0) return; // nova aba: deixa o link agir
    ev.preventDefault();
    this.conversa.navegar(a);
    this.minimizar();
  }

  aoTeclarPainel(ev: KeyboardEvent): void {
    if (ev.key === 'Escape') {
      ev.stopPropagation();
      this.fechar();
    }
  }

  // ------------------------------------------------------------------ apoio

  private rolarDepois(): void {
    this.depoisDeRenderizar(() => this.rolarParaFim());
  }

  private rolarParaFim(): void {
    const el = this.lista?.nativeElement;
    if (el) el.scrollTop = el.scrollHeight;
  }

  private depoisDeRenderizar(fn: () => void): void {
    setTimeout(() => {
      if (this.destruido) return;
      this.cdr.detectChanges();
      fn();
    });
  }

  trackId(_: number, m: AssistenteMensagem): number { return m.id; }
}
