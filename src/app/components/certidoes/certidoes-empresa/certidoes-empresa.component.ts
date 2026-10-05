import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CertidaoResponseDTO, TipoCertidao } from '../../../models/certidao.dto';
import { EmpresaResponseDTO } from '../../../models/empresa-response.dto';
import { CertidaoService } from '../../../services/certidao.service';
import { IconComponent } from '../../../shared/icon.component';
import { ToastService } from '../../../shared/ui/toast.service';
import { ConfirmService } from '../../../shared/ui/confirm.service';
import { PaginadorComponent, paginar } from '../../../shared/ui/paginador.component';
import { CertidaoTabelaComponent } from '../certidao-tabela/certidao-tabela.component';
import { CertidaoFormComponent } from '../certidao-form/certidao-form.component';
import { TIPOS_MATRIZ, Tom, mensagemErro, porUrgencia, prazoTexto, tomCertidao } from '../certidao.util';

interface Pilula { tipo: TipoCertidao; curto: string; icone: string; tom: Tom; texto: string; certidao: CertidaoResponseDTO | null; }

/**
 * Certidões de uma empresa (detalhe da empresa).
 * modo "completo": aba com lista, cadastro e edição · modo "resumo": cartão compacto da visão geral.
 */
@Component({
  selector: 'app-certidoes-empresa',
  standalone: true,
  imports: [RouterModule, IconComponent, PaginadorComponent, CertidaoTabelaComponent, CertidaoFormComponent],
  templateUrl: './certidoes-empresa.component.html',
  styleUrl: './certidoes-empresa.component.css'
})
export class CertidoesEmpresaComponent implements OnChanges {
  @Input({ required: true }) idEmpresa!: number;
  @Input() nomeEmpresa = '';
  @Input() isAdmin = false;
  @Input() modo: 'completo' | 'resumo' = 'completo';
  /** resumo: pedir para abrir a aba completa */
  @Output() verTodas = new EventEmitter<void>();

  certidoes: CertidaoResponseDTO[] = [];
  carregando = true;
  erro = false;
  pilulas: Pilula[] = [];
  cont = { validas: 0, vencendo: 0, vencidas: 0 };

  pagina = 1;
  porPagina = 10;

  formAberto = false;
  editando: CertidaoResponseDTO | null = null;
  formTipo: TipoCertidao | null = null;
  excluindoId: number | null = null;

  constructor(private service: CertidaoService, private toast: ToastService, private confirm: ConfirmService) {}

  ngOnChanges(ch: SimpleChanges): void {
    if (ch['idEmpresa'] && this.idEmpresa) this.carregar();
  }

  get empresasForm(): EmpresaResponseDTO[] {
    return [{ id: this.idEmpresa, nomeFantasia: this.nomeEmpresa } as EmpresaResponseDTO];
  }

  get itensPagina(): CertidaoResponseDTO[] {
    return paginar(this.certidoes, this.pagina, this.porPagina);
  }

  get alertas(): number { return this.cont.vencendo + this.cont.vencidas; }

  carregar(): void {
    this.carregando = true;
    this.erro = false;
    this.service.porEmpresa(this.idEmpresa).subscribe({
      next: (d) => { this.certidoes = d.slice().sort(porUrgencia); this.carregando = false; this.montar(); },
      error: () => { this.carregando = false; this.erro = true; }
    });
  }

  private montar(): void {
    const c = this.certidoes;
    this.cont = {
      validas: c.filter(x => x.statusValidade === 'VALIDA').length,
      vencendo: c.filter(x => x.statusValidade === 'VENCENDO').length,
      vencidas: c.filter(x => x.statusValidade === 'VENCIDA').length,
    };
    this.pilulas = TIPOS_MATRIZ.map(t => {
      const doTipo = c.filter(x => x.tipo === t.id).sort((a, b) => b.dataValidade.localeCompare(a.dataValidade));
      const v = doTipo[0] ?? null;
      return {
        tipo: t.id, curto: t.curto, icone: t.icone, certidao: v,
        tom: v ? tomCertidao(v) : 'neutral',
        texto: v ? prazoTexto(v.diasParaVencer) : 'Não cadastrada',
      };
    });
  }

  nova(tipo: TipoCertidao | null = null): void {
    this.editando = null;
    this.formTipo = tipo;
    this.formAberto = true;
  }

  editar(c: CertidaoResponseDTO): void {
    this.editando = c;
    this.formTipo = null;
    this.formAberto = true;
  }

  clicarPilula(p: Pilula): void {
    if (this.modo === 'resumo') { this.verTodas.emit(); return; }
    if (!this.isAdmin) return;
    p.certidao ? this.editar(p.certidao) : this.nova(p.tipo);
  }

  aoSalvar(c: CertidaoResponseDTO): void {
    const existe = this.certidoes.some(x => x.id === c.id);
    this.certidoes = (existe ? this.certidoes.map(x => x.id === c.id ? c : x) : [...this.certidoes, c]).sort(porUrgencia);
    this.formAberto = false;
    this.editando = null;
    this.montar();
  }

  async excluir(c: CertidaoResponseDTO): Promise<void> {
    const ok = await this.confirm.ask({
      titulo: 'Excluir certidão?',
      mensagem: `${c.tipoRotulo}${c.numero ? ' nº ' + c.numero : ''} deixará de ser acompanhada. O PDF continua no Drive.`,
      confirmar: 'Excluir',
      tom: 'danger'
    });
    if (!ok) return;
    this.excluindoId = c.id;
    this.service.excluir(c.id).subscribe({
      next: () => {
        this.excluindoId = null;
        this.certidoes = this.certidoes.filter(x => x.id !== c.id);
        this.montar();
        this.toast.success('Certidão excluída', c.tipoRotulo);
      },
      error: (err) => {
        this.excluindoId = null;
        this.toast.error('Não foi possível excluir', mensagemErro(err));
      }
    });
  }
}
