import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../../../shared/icon.component';
import { ToastService } from '../../../shared/ui/toast.service';
import { IaService } from '../../../services/ia.service';
import { ArquivoResponseDTO } from '../../../models/arquivo-response.dto';
import {
  TipoDocumentoLabel, copiarTexto, formatarCnpj, formatarLinhaDigitavel, legivelPorIa
} from '../../../models/documento-analisado.dto';

/**
 * Dados extraídos pela leitura inteligente de um arquivo armazenado (valor, linha digitável,
 * competência, tipo) + botão "Ler com IA" para arquivos ainda não lidos.
 * `compacto`: uma linha (lista de anexos da obrigação). Padrão: bloco completo (detalhes do arquivo).
 */
@Component({
  selector: 'app-dados-leitura',
  standalone: true,
  imports: [CommonModule, IconComponent],
  templateUrl: './dados-leitura.component.html',
  styleUrl: './dados-leitura.component.css'
})
export class DadosLeituraComponent {
  private ia = inject(IaService);
  private toast = inject(ToastService);

  @Input({ required: true }) arquivo!: ArquivoResponseDTO;
  @Input() compacto = false;
  /** O arquivo físico não existe (ex.: dado de demonstração): esconde o "Ler com IA". */
  @Input() semConteudo = false;
  /** Arquivo atualizado com os dados lidos. */
  @Output() atualizado = new EventEmitter<ArquivoResponseDTO>();

  lendo = false;
  copiado = false;

  get analisado(): boolean { return !!this.arquivo?.analisadoEm; }
  get legivel(): boolean {
    return legivelPorIa(this.arquivo?.nomeOriginal) && this.arquivo?.possuiConteudo !== false && !this.semConteudo;
  }
  get tipo(): string | null {
    const t = this.arquivo?.tipoDocumento;
    return t && t !== 'OUTRO' ? TipoDocumentoLabel[t] : null;
  }
  get linha(): string { return formatarLinhaDigitavel(this.arquivo?.linhaDigitavel); }
  get cnpj(): string { return formatarCnpj(this.arquivo?.cnpjDocumento); }
  get porIa(): boolean { return this.arquivo?.fonteLeitura === 'IA'; }
  /** Enviado há pouco: a leitura automática (em segundo plano) ainda deve estar rodando. */
  get lendoAuto(): boolean {
    const c = this.arquivo?.dataCriacao;
    return !this.analisado && this.legivel && !!c && Date.now() - new Date(c).getTime() < 60_000;
  }
  get semDados(): boolean {
    const a = this.arquivo;
    return this.analisado && a.valor == null && !a.linhaDigitavel && !a.competenciaDocumento && !this.tipo;
  }

  ler(ev?: Event): void {
    ev?.stopPropagation();
    if (this.lendo) return;
    this.lendo = true;
    this.ia.analisarArquivo(this.arquivo.id).subscribe({
      next: ({ analise, arquivo }) => {
        this.lendo = false;
        this.atualizado.emit(arquivo);
        if (!analise.textoLegivel) {
          this.toast.warning('Documento sem texto', 'É uma imagem ou PDF escaneado — não foi possível ler automaticamente.');
          return;
        }
        const partes = [
          analise.tipoDocumento !== 'OUTRO' ? analise.tipoDocumentoRotulo : null,
          analise.valor != null ? analise.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : null,
          analise.competencia ? `competência ${analise.competencia}` : null
        ].filter(Boolean);
        const graves = analise.alertas.filter(a => a.nivel === 'danger');
        if (graves.length) this.toast.warning('Leitura concluída com divergências', graves[0].mensagem);
        else this.toast.success(analise.fonte === 'IA' ? 'Documento lido pela IA' : 'Documento lido', partes.join(' · ') || 'Dados gravados no arquivo.');
      },
      error: (err) => {
        this.lendo = false;
        this.toast.error('Não foi possível ler o documento', err?.error?.mensagem ?? err?.error?.message ?? 'Tente novamente em instantes.');
      }
    });
  }

  async copiar(ev?: Event): Promise<void> {
    ev?.stopPropagation();
    const l = this.arquivo?.linhaDigitavel;
    if (!l) return;
    if (await copiarTexto(l)) {
      this.copiado = true;
      this.toast.success('Linha digitável copiada', 'Cole no app do banco para pagar.');
      setTimeout(() => (this.copiado = false), 2500);
    } else {
      this.toast.error('Não foi possível copiar', 'Selecione o número e copie manualmente.');
    }
  }
}
