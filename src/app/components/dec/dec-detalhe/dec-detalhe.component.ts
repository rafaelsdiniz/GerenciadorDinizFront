import { Component, EventEmitter, HostListener, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  ComunicacaoDecDTO, StatusDecLabel, TipoDecLabel, UrgenciaDecLabel, tomStatusDec, tomUrgenciaDec
} from '../../../models/comunicacao-dec.dto';
import { IconComponent } from '../../../shared/icon.component';
import { DocumentoPipe, PrazoPipe, PrazoTomPipe } from '../../../pipes/formatos.pipe';
import { decDiasTacita, decParamsCadastro, decRelativo, decTomTacita } from '../dec.util';

/** Drawer "Detalhes da comunicação" do DEC — somente leitura. */
@Component({
  selector: 'app-dec-detalhe',
  standalone: true,
  imports: [CommonModule, IconComponent, DocumentoPipe, PrazoPipe, PrazoTomPipe],
  templateUrl: './dec-detalhe.component.html',
  styleUrl: './dec-detalhe.component.css'
})
export class DecDetalheComponent {
  @Input({ required: true }) comunicacao!: ComunicacaoDecDTO;
  /** ADMIN: mostra "Cadastrar no Gerenciador" quando o CNPJ não tem empresa */
  @Input() podeCadastrar = false;
  @Output() fechar = new EventEmitter<void>();

  constructor(private router: Router) {}

  cadastrar(): void {
    this.router.navigate(['/empresas'], { queryParams: decParamsCadastro(this.c) });
  }

  readonly tipoLabel = TipoDecLabel;
  readonly statusLabel = StatusDecLabel;
  readonly urgenciaLabel = UrgenciaDecLabel;

  get c(): ComunicacaoDecDTO { return this.comunicacao; }
  get tomUrgencia(): string { return tomUrgenciaDec(this.c.urgencia); }
  get tomStatus(): string { return tomStatusDec(this.c.status); }
  get diasTacita(): number | null { return decDiasTacita(this.c); }
  get tomTacita(): string { return decTomTacita(this.diasTacita); }
  get relTacita(): string { return decRelativo(this.diasTacita); }

  /** Alerta do motivo no mesmo tom da urgência (neutro = alerta simples). */
  get classeAlerta(): string {
    const t = this.tomUrgencia;
    return t === 'neutral' ? 'alert' : `alert alert-${t}`;
  }

  get iconeUrgencia(): string {
    const t = this.tomUrgencia;
    return t === 'danger' || t === 'warning' ? 'alert-triangle' : t === 'success' ? 'check-circle' : 'info';
  }

  @HostListener('document:keydown.escape')
  onEsc(): void { this.fechar.emit(); }
}
