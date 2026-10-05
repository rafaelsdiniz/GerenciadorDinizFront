import { Component, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { forkJoin } from 'rxjs';

import { EmpresaService } from '../../../services/empresa.service';
import { SocioService } from '../../../services/socio.service';
import { ArquivoService } from '../../../services/arquivo.service';
import { ObrigacaoPendenteService } from '../../../services/obrigacao-pendente.service';
import { AuthService } from '../../../services/auth.service';
import { DecService } from '../../../services/dec.service';

import { EmpresaResponseDTO } from '../../../models/empresa-response.dto';
import { SocioResponseDTO } from '../../../models/socio-response.dto';
import { ArquivoResponseDTO } from '../../../models/arquivo-response.dto';
import { ObrigacaoPendenteResponseDTO } from '../../../models/obrigacao-pendente-response.dto';
import { CategoriaFiscal } from '../../../models/enums/categoria-fiscal.enum';
import { StatusObrigacao } from '../../../models/enums/status-obrigacao.enum';
import { ResponsavelObrigacao } from '../../../models/enums/responsavel-obrigacao.enum';
import { StatusArquivo } from '../../../models/enums/status-arquivo.enum';
import { SituacaoCadastral, SituacaoCadastralLabel } from '../../../models/enums/situacao-cadastral.enum';
import { NaturezaJuridicaLabel } from '../../../models/enums/natureza-juridica.enum';
import { RegimeTributarioLabel } from '../../../models/enums/regime-tributario.enum';
import { ComunicacaoDecDTO, decPrecisaAtencao } from '../../../models/comunicacao-dec.dto';

import { IconComponent } from '../../../shared/icon.component';
import { ToastService } from '../../../shared/ui/toast.service';
import { ConfirmService } from '../../../shared/ui/confirm.service';
import { AvatarCorPipe, DocumentoPipe, IniciaisPipe, PrazoPipe, PrazoTomPipe, TelefonePipe } from '../../../pipes/formatos.pipe';
import { EmpresaFormComponent } from '../empresa-form/empresa-form.component';
import { PaginadorComponent, paginar } from '../../../shared/ui/paginador.component';
import { DecTabelaComponent } from '../../dec/dec-tabela/dec-tabela.component';
import { DecDetalheComponent } from '../../dec/dec-detalhe/dec-detalhe.component';
import { CertidoesEmpresaComponent } from '../../certidoes/certidoes-empresa/certidoes-empresa.component';
import { decMenorTacita, decOrdenar, decSemCiencia } from '../../dec/dec.util';

export type AcaoChecklist = 'arquivos' | 'editar' | 'socios' | 'calendario';

export interface ChecklistItem {
  titulo: string;
  descricao: string;
  ok: boolean;
  dica?: string;
  detalhe?: string;
  acao?: AcaoChecklist;
}

/** Item da lista "Próximos vencimentos" (obrigação ou arquivo com validade). */
export interface Vencimento {
  tipo: 'obrigacao' | 'arquivo';
  id: number;
  titulo: string;
  data: string;
  vencido: boolean;
  /** obrigação: competência (MM/yyyy), anexos e se o cliente é quem envia */
  competencia?: string | null;
  arquivos?: number;
  cliente?: boolean;
}

type AbaId = 'visao' | 'dados' | 'socios' | 'dec' | 'certidoes' | 'checklist';

interface Aba {
  id: AbaId;
  label: string;
  icone: string;
}

@Component({
  selector: 'app-empresa-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, IconComponent, EmpresaFormComponent, PaginadorComponent, DecTabelaComponent, DecDetalheComponent, CertidoesEmpresaComponent,
    DocumentoPipe, TelefonePipe, IniciaisPipe, AvatarCorPipe, PrazoPipe, PrazoTomPipe],
  templateUrl: './empresa-detail.component.html',
  styleUrl: './empresa-detail.component.css'
})
export class EmpresaDetailComponent implements OnInit {

  empresa: EmpresaResponseDTO | null = null;
  socios: SocioResponseDTO[] = [];
  arquivos: ArquivoResponseDTO[] = [];
  obrigacoes: ObrigacaoPendenteResponseDTO[] = [];

  checklist: ChecklistItem[] = [];
  carregando = true;
  erro = '';

  abaAtual: AbaId = 'visao';
  abas: Aba[] = [
    { id: 'visao', label: 'Visão geral', icone: 'home' },
    { id: 'dados', label: 'Dados cadastrais', icone: 'id-card' },
    { id: 'socios', label: 'Sócios', icone: 'users' },
    { id: 'dec', label: 'DEC', icone: 'mail' },
    { id: 'certidoes', label: 'Certidões', icone: 'shield-check' },
    { id: 'checklist', label: 'Checklist', icone: 'list-checks' }
  ];
  filtroChecklist: 'todos' | 'pendentes' | 'ok' = 'todos';

  situacaoLabel = SituacaoCadastralLabel;
  naturezaLabel = NaturezaJuridicaLabel;
  regimeLabel = RegimeTributarioLabel;

  copiado: string | null = null;
  menuAberto = false;
  formAberto = false;
  isAdmin = false;
  idRota = 0;

  /** comunicações do DEC desta empresa (somente leitura) */
  dec: ComunicacaoDecDTO[] = [];
  decCarregando = false;
  decErro = '';
  decDetalhe: ComunicacaoDecDTO | null = null;
  decPagina = 1;
  decPorPagina = 10;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private empresaService: EmpresaService,
    private socioService: SocioService,
    private arquivoService: ArquivoService,
    private obrigacaoService: ObrigacaoPendenteService,
    private authService: AuthService,
    private decService: DecService,
    private toast: ToastService,
    private confirm: ConfirmService
  ) {}

  ngOnInit(): void {
    this.isAdmin = this.authService.isAdmin();
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.idRota = id;
    if (!id) {
      this.erro = 'ID da empresa inválido.';
      this.carregando = false;
      return;
    }

    // funcionário só pode ver a própria empresa
    if (!this.isAdmin) {
      const minhaEmpresa = this.authService.getEmpresaId();
      if (minhaEmpresa !== id) {
        this.router.navigate(['/empresas', minhaEmpresa]);
        return;
      }
    }

    this.carregar(id);
    this.carregarDec(id);
  }

  carregar(id: number): void {
    this.carregando = true;
    this.erro = '';
    forkJoin({
      empresa: this.empresaService.buscarPorId(id),
      socios: this.socioService.buscarPorEmpresa(id),
      arquivos: this.arquivoService.buscarPorEmpresa(id),
      obrigacoes: this.obrigacaoService.buscarPorEmpresa(id)
    }).subscribe({
      next: ({ empresa, socios, arquivos, obrigacoes }) => {
        this.empresa = empresa;
        this.socios = socios;
        this.arquivos = arquivos.filter(a => !a.excluidoEm);
        this.obrigacoes = obrigacoes;
        this.checklist = this.montarChecklist();
        this.carregando = false;
      },
      error: (e) => {
        this.erro = e?.error?.mensagem ?? e?.error?.message ?? 'Erro ao carregar empresa.';
        this.carregando = false;
        this.toast.error('Erro ao carregar empresa', this.erro);
      }
    });
  }

  // ============ DEC ============

  carregarDec(id = this.idRota): void {
    if (!id) return;
    this.decCarregando = true;
    this.decErro = '';
    this.decService.porEmpresa(id).subscribe({
      next: (lista) => {
        this.dec = decOrdenar(lista ?? []);
        this.decCarregando = false;
      },
      error: (e) => {
        this.dec = [];
        this.decCarregando = false;
        this.decErro = e?.error?.mensagem ?? 'Não foi possível carregar as comunicações do DEC.';
      }
    });
  }

  get decQtdSemCiencia(): number { return this.dec.filter(decSemCiencia).length; }
  get decAtencao(): ComunicacaoDecDTO[] { return this.dec.filter(decPrecisaAtencao); }
  get decTacitaDias(): number | null { return decMenorTacita(this.decAtencao); }
  get decPaginaItens(): ComunicacaoDecDTO[] { return paginar(this.dec, this.decPagina, this.decPorPagina); }

  // ============ checklist ============

  private montarChecklist(): ChecklistItem[] {
    if (!this.empresa) return [];

    const temCategoria = (cat: CategoriaFiscal) =>
      this.arquivos.some(a => a.categoriaFiscal === cat);

    const hoje = new Date();
    const ano = hoje.getFullYear();
    const mes = hoje.getMonth() + 1;

    const obrigacoesDoMes = this.obrigacoes.filter(o => {
      if (!o.dataVencimento) return false;
      const d = new Date(o.dataVencimento + 'T00:00:00');
      return d.getFullYear() === ano && d.getMonth() + 1 === mes;
    });
    const obrigacoesEntregues = obrigacoesDoMes.filter(o => o.status === StatusObrigacao.ENTREGUE).length;
    const totalObrigacoesMes = obrigacoesDoMes.length;

    const balanceteAtual = this.arquivos.some(a =>
      a.categoriaFiscal === CategoriaFiscal.BALANCETE &&
      !!a.dataVencimento &&
      this.isMesmoMes(a.dataVencimento, ano, mes)
    );

    const totalParticipacao = this.totalParticipacao;
    const temAdmin = this.socios.some(s => s.administrador === true);
    const e = this.empresa;

    return [
      {
        titulo: 'Contrato Social',
        descricao: 'Documento de constituição da empresa arquivado no sistema.',
        ok: temCategoria(CategoriaFiscal.CONTRATO_SOCIAL),
        dica: 'Faça upload do contrato social pela tela de Arquivos e marque a categoria "Contrato Social".',
        acao: 'arquivos'
      },
      {
        titulo: 'Certidões negativas',
        descricao: 'Ao menos uma CND (federal, estadual ou trabalhista) arquivada.',
        ok: temCategoria(CategoriaFiscal.CERTIDAO),
        dica: 'Emita a CND mais recente e faça upload na categoria "Certidão".',
        acao: 'arquivos'
      },
      {
        titulo: `Balancete de ${this.nomeMes(mes)}/${ano}`,
        descricao: 'Balancete contábil do mês corrente.',
        ok: balanceteAtual,
        dica: 'O balancete do mês atual ainda não foi enviado. Faça upload na categoria "Balancete".',
        acao: 'arquivos'
      },
      {
        titulo: 'Obrigações do mês',
        descricao: 'Todas as obrigações com vencimento neste mês já entregues.',
        ok: totalObrigacoesMes > 0 && obrigacoesEntregues === totalObrigacoesMes,
        detalhe: totalObrigacoesMes === 0
          ? 'Sem obrigações cadastradas neste mês'
          : `${obrigacoesEntregues} de ${totalObrigacoesMes} entregues`,
        dica: 'Abra o calendário de obrigações para ver o que falta entregar.',
        acao: 'calendario'
      },
      {
        titulo: 'Inscrição Estadual',
        descricao: 'IE cadastrada nos dados fiscais.',
        ok: !!e.inscricaoEstadual && e.inscricaoEstadual.trim().length > 0,
        dica: 'Edite os dados da empresa e informe a Inscrição Estadual.',
        acao: 'editar'
      },
      {
        titulo: 'Inscrição Municipal',
        descricao: 'IM cadastrada nos dados fiscais.',
        ok: !!e.inscricaoMunicipal && e.inscricaoMunicipal.trim().length > 0,
        dica: 'Edite os dados da empresa e informe a Inscrição Municipal.',
        acao: 'editar'
      },
      {
        titulo: 'Regime tributário',
        descricao: 'Regime (Simples, Lucro Presumido, Lucro Real) informado.',
        ok: !!e.regimeTributario,
        dica: 'Defina o regime tributário nos dados fiscais da empresa.',
        acao: 'editar'
      },
      {
        titulo: 'Endereço completo',
        descricao: 'Rua, número, bairro, cidade e CEP preenchidos.',
        ok: !!e.endereco
          && !!e.endereco.logradouro
          && !!e.endereco.numero
          && !!e.endereco.bairro
          && !!e.endereco.cidade
          && !!e.endereco.cep,
        dica: 'Complete o endereço da empresa nos dados cadastrais.',
        acao: 'editar'
      },
      {
        titulo: 'Sócios cadastrados',
        descricao: 'Pelo menos um sócio registrado.',
        ok: this.socios.length > 0,
        detalhe: `${this.socios.length} sócio(s)`,
        dica: 'Cadastre os sócios da empresa na aba Sócios.',
        acao: 'socios'
      },
      {
        titulo: 'Administrador definido',
        descricao: 'Ao menos um sócio marcado como administrador.',
        ok: temAdmin,
        dica: 'Na edição do sócio, marque "Administrador" para pelo menos um deles.',
        acao: 'socios'
      },
      {
        titulo: 'Participação = 100%',
        descricao: 'Soma das participações dos sócios deve fechar em 100%.',
        ok: Math.abs(totalParticipacao - 100) < 0.01,
        detalhe: `Atual: ${totalParticipacao.toFixed(2).replace('.', ',')}%`,
        dica: 'Ajuste a porcentagem de cada sócio até a soma totalizar 100%.',
        acao: 'socios'
      }
    ];
  }

  /** Itens visíveis no checklist: pendentes primeiro (ação antes de conferência). */
  get checklistVisivel(): ChecklistItem[] {
    const lista = this.filtroChecklist === 'pendentes' ? this.checklist.filter(i => !i.ok)
      : this.filtroChecklist === 'ok' ? this.checklist.filter(i => i.ok)
      : this.checklist;
    return [...lista].sort((a, b) => Number(a.ok) - Number(b.ok));
  }

  rotuloAcao(a: AcaoChecklist | undefined): string | null {
    switch (a) {
      case 'arquivos': return 'Enviar arquivo';
      case 'calendario': return 'Abrir calendário';
      case 'socios': return this.isAdmin ? 'Gerenciar sócios' : 'Ver sócios';
      case 'editar': return this.isAdmin ? 'Editar dados' : null;
      default: return null;
    }
  }

  executarAcao(a: AcaoChecklist | undefined): void {
    switch (a) {
      case 'arquivos': this.verArquivos(); break;
      case 'calendario': this.verCalendario(); break;
      case 'socios': this.isAdmin ? this.gerenciarSocios() : this.mudarAba('socios'); break;
      case 'editar': this.abrirEdicao(); break;
    }
  }

  // ============ stats ============

  get statsArquivosAtivos(): number {
    return this.arquivos.length;
  }

  get statsArquivosVencidos(): number {
    return this.arquivos.filter(a => a.status === StatusArquivo.VENCIDO).length;
  }

  get statsObrigacoesVencidas(): number {
    return this.obrigacoes.filter(o => o.status === StatusObrigacao.VENCIDA).length;
  }

  get statsObrigacoesPendentes(): number {
    return this.obrigacoes.filter(o => o.status === StatusObrigacao.PENDENTE).length;
  }

  get proximaObrigacao(): ObrigacaoPendenteResponseDTO | null {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const pendentes = this.obrigacoes
      .filter(o => o.status === StatusObrigacao.PENDENTE && !!o.dataVencimento)
      .filter(o => new Date(o.dataVencimento + 'T00:00:00') >= hoje)
      .sort((a, b) => a.dataVencimento.localeCompare(b.dataVencimento));
    return pendentes[0] ?? null;
  }

  /** Obrigações em aberto + arquivos com validade, atrasados primeiro, por data. */
  get proximosVencimentos(): Vencimento[] {
    const d = new Date();
    const hoje = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const obr: Vencimento[] = this.obrigacoes
      .filter(o => o.status !== StatusObrigacao.ENTREGUE && !!o.dataVencimento)
      .map(o => ({
        tipo: 'obrigacao' as const, id: o.id, titulo: o.nomeObrigacao || 'Obrigação',
        data: o.dataVencimento, vencido: o.status === StatusObrigacao.VENCIDA || o.dataVencimento < hoje,
        competencia: o.competencia, arquivos: o.totalArquivos ?? 0, cliente: o.responsavel === ResponsavelObrigacao.CLIENTE
      }));
    const arq: Vencimento[] = this.arquivos
      .filter(a => !!a.dataVencimento && (a.status === StatusArquivo.PENDENTE || a.status === StatusArquivo.VENCIDO))
      .map(a => ({
        tipo: 'arquivo' as const, id: a.id, titulo: a.nomeOriginal || a.nome,
        data: a.dataVencimento!, vencido: a.status === StatusArquivo.VENCIDO || a.dataVencimento! < hoje
      }));
    return [...obr, ...arq].sort((a, b) => a.data.localeCompare(b.data)).slice(0, 6);
  }

  get itensChecklistOk(): number {
    return this.checklist.filter(i => i.ok).length;
  }

  get itensChecklistFaltando(): ChecklistItem[] {
    return this.checklist.filter(i => !i.ok);
  }

  get percentualChecklist(): number {
    if (this.checklist.length === 0) return 0;
    return Math.round((this.itensChecklistOk / this.checklist.length) * 100);
  }

  get tomChecklist(): 'success' | 'warning' | 'danger' {
    const p = this.percentualChecklist;
    return p >= 100 ? 'success' : p >= 60 ? 'warning' : 'danger';
  }

  get totalParticipacao(): number {
    return this.socios.reduce((acc, s) => acc + (s.participacao ?? 0), 0);
  }

  get sociosOrdenados(): SocioResponseDTO[] {
    return [...this.socios].sort((a, b) =>
      Number(!!b.administrador) - Number(!!a.administrador) || (b.participacao ?? 0) - (a.participacao ?? 0));
  }

  // ============ helpers ============

  private isMesmoMes(dataISO: string, ano: number, mes: number): boolean {
    const d = new Date(dataISO + 'T00:00:00');
    return d.getFullYear() === ano && d.getMonth() + 1 === mes;
  }

  nomeMes(mes: number): string {
    return ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'][mes - 1];
  }

  private readonly docPipe = new DocumentoPipe();
  private readonly telPipe = new TelefonePipe();
  doc(v: string | null | undefined): string { return this.docPipe.transform(v); }
  tel(v: string | null | undefined): string { return this.telPipe.transform(v); }

  formatarCep(cep: string | null | undefined): string {
    if (!cep) return '';
    return cep.replace(/\D/g, '').replace(/^(\d{5})(\d{3})$/, '$1-$2');
  }

  situacaoTom(): string {
    const s = this.empresa?.situacaoCadastral;
    if (s === SituacaoCadastral.ATIVA) return 'badge-success';
    if (s === SituacaoCadastral.BAIXADA) return 'badge-neutral';
    if (s === SituacaoCadastral.NULA) return 'badge-danger';
    return 'badge-warning';
  }

  cnaesSecundariosLista(): string[] {
    if (!this.empresa?.cnaesSecundarios) return [];
    return this.empresa.cnaesSecundarios.split(',').map(c => c.trim()).filter(c => c);
  }

  enderecoCompleto(): string {
    const e = this.empresa?.endereco;
    if (!e) return '—';
    const partes = [
      e.logradouro,
      e.numero,
      e.complemento,
      e.bairro,
      e.cidade && e.uf ? `${e.cidade}/${e.uf}` : (e.cidade || e.uf)
    ].filter(p => !!p);
    return partes.length ? partes.join(', ') : '—';
  }

  // ============ ações ============

  copiar(valor: string | null | undefined, chave: string, rotulo = 'Copiado'): void {
    if (!valor) return;
    navigator.clipboard.writeText(valor).then(
      () => {
        this.copiado = chave;
        this.toast.success(`${rotulo} copiado`, valor);
        setTimeout(() => { if (this.copiado === chave) this.copiado = null; }, 1500);
      },
      () => this.toast.error('Não foi possível copiar', 'O navegador bloqueou o acesso à área de transferência.')
    );
  }

  verArquivos(): void {
    this.router.navigate(['/arquivos']);
  }

  verCalendario(): void {
    this.router.navigate(['/calendario']);
  }

  verObrigacoes(): void {
    this.router.navigate(['/obrigacoes-pendentes']);
  }

  gerenciarSocios(): void {
    this.router.navigate(['/socios']);
  }

  abrirVencimento(v: Vencimento): void {
    if (v.tipo === 'arquivo') this.router.navigate(['/arquivos'], { queryParams: { id: v.id } });
    else this.verObrigacoes();
  }

  voltar(): void {
    if (this.isAdmin) {
      this.router.navigate(['/empresas']);
    } else {
      this.router.navigate(['/dashboard']);
    }
  }

  mudarAba(aba: AbaId): void {
    this.abaAtual = aba;
    this.menuAberto = false;
  }

  // menu "mais ações"
  toggleMenu(e: MouseEvent): void {
    e.stopPropagation();
    this.menuAberto = !this.menuAberto;
  }

  @HostListener('document:click')
  fecharMenu(): void { this.menuAberto = false; }

  @HostListener('document:keydown.escape')
  onEsc(): void { this.menuAberto = false; }

  abrirEdicao(): void {
    if (!this.isAdmin) return;
    this.menuAberto = false;
    this.formAberto = true;
  }

  onSalvo(res: EmpresaResponseDTO): void {
    this.formAberto = false;
    if (res?.id) {
      this.empresa = res;
      this.checklist = this.montarChecklist();
    } else if (this.empresa) {
      this.carregar(this.empresa.id);
    }
  }

  async excluir(): Promise<void> {
    if (!this.empresa || !this.isAdmin) return;
    this.menuAberto = false;
    const nome = this.empresa.nomeFantasia;
    const ok = await this.confirm.ask({
      titulo: 'Excluir empresa?',
      mensagem: `"${nome}" será removida do sistema. Esta ação não pode ser desfeita.`,
      confirmar: 'Excluir',
      tom: 'danger'
    });
    if (!ok) return;
    this.empresaService.deletar(this.empresa.id).subscribe({
      next: () => {
        this.toast.success('Empresa excluída', nome);
        this.router.navigate(['/empresas']);
      },
      error: (err) => this.toast.error('Não foi possível excluir',
        err?.error?.mensagem ?? err?.error?.message ?? 'Verifique se há arquivos ou usuários vinculados.')
    });
  }
}
