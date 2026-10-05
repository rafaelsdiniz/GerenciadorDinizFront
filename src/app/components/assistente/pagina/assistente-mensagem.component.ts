import { Component, EventEmitter, Input, OnDestroy, Output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../../../shared/icon.component';
import { AssistenteAcao } from '../../../services/assistente.service';
import { AssistenteConversaService, AssistenteMensagem } from '../../../services/assistente-conversa.service';
import { textoPlanoResposta } from '../assistente-markdown';

/** Uma mensagem da página do assistente: bolha do usuário ou resposta corrida da IA (com ações, selo e copiar). */
@Component({
  selector: 'app-assistente-mensagem',
  standalone: true,
  imports: [RouterLink, IconComponent],
  templateUrl: './assistente-mensagem.component.html',
  styleUrl: './assistente-mensagem.component.css'
})
export class AssistenteMensagemComponent implements OnDestroy {
  @Input({ required: true }) m!: AssistenteMensagem;
  @Input() enviando = false;
  @Output() repetir = new EventEmitter<string>();

  copiado = false;
  private timer?: ReturnType<typeof setTimeout>;

  constructor(private conversa: AssistenteConversaService) {}

  ngOnDestroy(): void {
    clearTimeout(this.timer);
  }

  irPara(ev: MouseEvent, a: AssistenteAcao): void {
    if (ev.ctrlKey || ev.metaKey || ev.shiftKey || ev.button !== 0) return; // nova aba: deixa o link agir
    ev.preventDefault();
    this.conversa.navegar(a);
  }

  async copiar(): Promise<void> {
    const texto = textoPlanoResposta(this.m.texto);
    let ok = false;
    try {
      await navigator.clipboard.writeText(texto);
      ok = true;
    } catch {
      // navegador sem Clipboard API (ou http): cópia via seleção
      try {
        const area = document.createElement('textarea');
        area.value = texto;
        area.setAttribute('readonly', '');
        area.style.cssText = 'position:fixed;top:-1000px;opacity:0';
        document.body.appendChild(area);
        area.select();
        ok = document.execCommand('copy');
        area.remove();
      } catch { ok = false; }
    }
    if (!ok) return;
    this.copiado = true;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.copiado = false, 1800);
  }
}
