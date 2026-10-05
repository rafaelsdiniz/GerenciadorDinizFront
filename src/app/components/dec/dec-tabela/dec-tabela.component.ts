import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  ComunicacaoDecDTO, StatusDecLabel, TipoDecLabel, UrgenciaDecLabel, tomStatusDec, tomUrgenciaDec
} from '../../../models/comunicacao-dec.dto';
import { IconComponent } from '../../../shared/icon.component';
import { AvatarCorPipe, DocumentoPipe, IniciaisPipe } from '../../../pipes/formatos.pipe';
import {
  decChegouHa, decDia, decDiasDesde, decDiasTacita, decMes, decNomeEmpresa, decParamsCadastro, decRelativo, decTomTacita
} from '../dec.util';

interface LinhaDec {
  c: ComunicacaoDecDTO;
  empresa: string;
  dia: string;
  mes: string;
  chegou: string;
  nova: boolean;
  diasTacita: number | null;
  tomTacita: string;
  relTacita: string;
  tomUrgencia: string;
  tomStatus: string;
}

/** Tabela de comunicações do DEC (página DEC e aba DEC da empresa). Recebe a página já fatiada. */
@Component({
  selector: 'app-dec-tabela',
  standalone: true,
  imports: [CommonModule, IconComponent, AvatarCorPipe, IniciaisPipe, DocumentoPipe],
  templateUrl: './dec-tabela.component.html',
  styleUrl: './dec-tabela.component.css'
})
export class DecTabelaComponent {
  linhas: LinhaDec[] = [];

  @Input() set itens(v: ComunicacaoDecDTO[] | null) {
    this.linhas = (v ?? []).map(c => {
      const diasTacita = decDiasTacita(c);
      const desde = decDiasDesde(c.disponibilizadaEm);
      return {
        c, diasTacita,
        empresa: decNomeEmpresa(c),
        dia: decDia(c.disponibilizadaEm),
        mes: decMes(c.disponibilizadaEm),
        chegou: decChegouHa(c.disponibilizadaEm),
        nova: desde != null && desde <= 2,
        tomTacita: decTomTacita(diasTacita),
        relTacita: decRelativo(diasTacita),
        tomUrgencia: tomUrgenciaDec(c.urgencia),
        tomStatus: tomStatusDec(c.status)
      };
    });
  }
  /** Coluna Empresa (oculta para o cliente e na aba da empresa). */
  @Input() mostrarEmpresa = true;
  @Input() compacta = false;
  @Input() selecionadoId: number | null = null;
  /** Habilita ordenação por cabeçalho (null = sem ordenação clicável). */
  @Input() ordem: 'urgencia' | 'data' | null = null;
  /** ADMIN: atalho "Cadastrar no Gerenciador" para CNPJ sem empresa */
  @Input() podeCadastrar = false;

  @Output() abrir = new EventEmitter<ComunicacaoDecDTO>();
  @Output() ordenar = new EventEmitter<'urgencia' | 'data'>();

  readonly tipoLabel = TipoDecLabel;
  readonly statusLabel = StatusDecLabel;
  readonly urgenciaLabel = UrgenciaDecLabel;

  constructor(private router: Router) {}

  cadastrar(c: ComunicacaoDecDTO): void {
    this.router.navigate(['/empresas'], { queryParams: decParamsCadastro(c) });
  }

  tituloUrgencia(l: LinhaDec): string {
    return l.c.motivo || `Urgência ${this.urgenciaLabel[l.c.urgencia] ?? l.c.urgencia}`;
  }
}
