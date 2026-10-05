import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { IconComponent } from '../../../shared/icon.component';
import { AssistenteConversaService, AssistenteMensagem } from '../../../services/assistente-conversa.service';
import { AssistenteMensagemComponent } from './assistente-mensagem.component';

/** Altura máxima da caixa de texto (~6 linhas). */
const ALTURA_MAX_CAMPO = 156;

const ICONES_SUGESTAO = ['calendar-clock', 'list-checks', 'inbox', 'shield-check', 'file-text', 'bar-chart'];

/** Página dedicada de conversa com o Assistente Diniz (tela cheia, estilo ChatGPT). */
@Component({
  selector: 'app-assistente-pagina',
  standalone: true,
  imports: [FormsModule, IconComponent, AssistenteMensagemComponent],
  templateUrl: './assistente-pagina.component.html',
  styleUrl: './assistente-pagina.component.css'
})
export class AssistentePaginaComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('rolagem') rolagem?: ElementRef<HTMLElement>;
  @ViewChild('campo') campo?: ElementRef<HTMLTextAreaElement>;

  readonly max: number;
  readonly icones = ICONES_SUGESTAO;

  texto = '';
  /** usuário rolou para cima: mostra o botão "ir para o fim" */
  longeDoFim = false;

  private subs: Subscription[] = [];
  private destruido = false;

  constructor(readonly conversa: AssistenteConversaService, private cdr: ChangeDetectorRef) {
    this.max = conversa.max;
  }

  ngOnInit(): void {
    this.conversa.carregarStatus();
    this.subs.push(this.conversa.mudou$.subscribe(() => this.depois(() => this.irParaFim(true))));
  }

  ngAfterViewInit(): void {
    this.depois(() => {
      this.irParaFim(false);
      // só foca no desktop: no celular abriria o teclado por cima das sugestões
      if (matchMedia?.('(pointer: fine)').matches) this.campo?.nativeElement.focus();
    });
  }

  ngOnDestroy(): void {
    this.destruido = true;
    this.subs.forEach(s => s.unsubscribe());
  }

  get mensagens(): AssistenteMensagem[] { return this.conversa.mensagens(); }
  get enviando(): boolean { return this.conversa.enviando(); }

  get saudacao(): string {
    const h = new Date().getHours();
    return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
  }

  get podeEnviar(): boolean {
    const t = this.texto.trim();
    return !this.enviando && t.length > 0 && t.length <= this.max;
  }

  // ------------------------------------------------------------------ ações

  enviar(): void {
    if (!this.conversa.enviar(this.texto)) return;
    this.texto = '';
    this.depois(() => this.ajustarAltura());
  }

  usarSugestao(s: string): void {
    this.texto = s;
    this.enviar();
  }

  repetir(pergunta: string): void {
    this.conversa.enviar(pergunta, true);
  }

  novaConversa(): void {
    this.conversa.limpar();
    this.texto = '';
    this.depois(() => { this.ajustarAltura(); this.campo?.nativeElement.focus(); });
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
    el.style.height = Math.min(el.scrollHeight, ALTURA_MAX_CAMPO) + 'px';
    el.style.overflowY = el.scrollHeight > ALTURA_MAX_CAMPO ? 'auto' : 'hidden';
  }

  aoRolar(): void {
    const el = this.rolagem?.nativeElement;
    if (!el) return;
    const longe = el.scrollHeight - el.scrollTop - el.clientHeight > 160;
    if (longe !== this.longeDoFim) this.longeDoFim = longe;
  }

  irParaFim(suave: boolean): void {
    const el = this.rolagem?.nativeElement;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: suave ? 'smooth' : 'auto' });
    this.longeDoFim = false;
  }

  trackId(_: number, m: AssistenteMensagem): number { return m.id; }

  private depois(fn: () => void): void {
    setTimeout(() => {
      if (this.destruido) return;
      this.cdr.detectChanges();
      fn();
    });
  }
}
