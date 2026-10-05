import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration } from 'chart.js';
import { ArquivoResponseDTO } from '../../../models/arquivo-response.dto';
import { EmpresaResponseDTO } from '../../../models/empresa-response.dto';
import { PastaResponseDTO } from '../../../models/pasta-response.dto';
import { DashboardResponseDTO } from '../../../models/dashboard-response.dto';
import { LogAcessoResponseDTO } from '../../../models/log-acesso-response.dto';
import { ObrigacaoPendenteResponseDTO } from '../../../models/obrigacao-pendente-response.dto';
import { ArquivoService } from '../../../services/arquivo.service';
import { AuthService } from '../../../services/auth.service';
import { EmpresaService } from '../../../services/empresa.service';
import { PastaService } from '../../../services/pasta.service';
import { SocioService } from '../../../services/socio.service';
import { UsuarioService } from '../../../services/usuario.service';
import { DashboardService } from '../../../services/dashboard.service';
import { LogAcessoService } from '../../../services/log-acesso.service';
import { ObrigacaoPendenteService } from '../../../services/obrigacao-pendente.service';
import { StatusArquivo, StatusArquivoLabel } from '../../../models/enums/status-arquivo.enum';
import { CategoriaFiscal, CategoriaFiscalLabel } from '../../../models/enums/categoria-fiscal.enum';
import { AcaoLogLabel } from '../../../models/enums/acao-log.enum';
import { IconComponent } from '../../../shared/icon.component';
import { DecService } from '../../../services/dec.service';
import { CertidaoService } from '../../../services/certidao.service';
import { CertidaoResumoDTO } from '../../../models/certidao.dto';
import { ComunicacaoDecDTO, TipoDecLabel, UrgenciaDecLabel, decPrecisaAtencao, tomUrgenciaDec } from '../../../models/comunicacao-dec.dto';
import { BytesPipe, PrazoPipe, PrazoTomPipe, IniciaisPipe, AvatarCorPipe } from '../../../pipes/formatos.pipe';

interface DistItem {
  chave: string;
  label: string;
  total: number;
  percentual: number;
  cor: string;
}

interface ResumoEmpresa {
  id: number;
  nome: string;
  total: number;
  vencidos: number;
  pendentes: number;
  vencendo7: number;
  obrigVencidas: number;
}

/** Item unificado da agenda: obrigação ou arquivo com vencimento. */
interface Vencimento {
  tipo: 'obrigacao' | 'arquivo';
  id: number;
  nome: string;
  detalhe: string;
  dataVencimento: string;
  diasParaVencer: number;
}

/** Campos novos da API (competência, responsável) — opcionais para compatibilidade. */
type ObrigacaoComFluxo = ObrigacaoPendenteResponseDTO & {
  competencia?: string | null;
  responsavel?: string | null;
  nomeEmpresa?: string | null;
};

interface Slide {
  tom: 'danger' | 'primary' | 'success';
  icone: string;
  titulo: string;
  texto: string;
  cta: string;
  rota: string;
  queryParams?: Record<string, string | number>;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, BaseChartDirective, IconComponent,
    BytesPipe, PrazoPipe, PrazoTomPipe, IniciaisPipe, AvatarCorPipe],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit, OnDestroy {

  private readonly EMPRESA_KEY = 'dashboard.empresaSelecionada';
  private readonly BANNER_KEY = 'dashboard.bannerFechado';

  dataAtual = '';
  dataCurta = '';
  saudacao = '';
  nomeUsuario = '';
  isAdmin = false;
  idEmpresaUsuario: number | null = null;

  totalEmpresas = 0;
  totalArquivos = 0;
  totalPastas = 0;
  totalUsuarios = 0;
  totalSocios = 0;
  totalBytes = 0;
  totalVencidosGeral = 0;
  totalPendentesObrigGeral = 0;

  arquivos: ArquivoResponseDTO[] = [];
  empresas: EmpresaResponseDTO[] = [];
  pastas: PastaResponseDTO[] = [];
  logsRecentes: LogAcessoResponseDTO[] = [];
  obrigacoesGeral: ObrigacaoPendenteResponseDTO[] = [];
  resumoEmpresas: ResumoEmpresa[] = [];
  proximosVencimentos: Vencimento[] = [];

  carregando = true;
  carregandoObrig = true;

  idEmpresaSelecionada: number | null = null;
  metricas: DashboardResponseDTO | null = null;
  carregandoMetricas = false;
  distStatus: DistItem[] = [];
  distCategoria: DistItem[] = [];

  // banner (carrossel de alertas)
  slides: Slide[] = [];
  slideAtual = 0;
  bannerFechado = false;
  private timerSlide: ReturnType<typeof setInterval> | null = null;

  // gráfico: distribuição por status da empresa selecionada
  chartStatusData: ChartConfiguration<'doughnut'>['data'] | undefined;
  readonly chartStatusOptions: ChartConfiguration<'doughnut'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '72%',
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#0b1433',
        padding: 10,
        cornerRadius: 8,
        titleFont: { family: 'Inter', weight: 600 },
        bodyFont: { family: 'Inter' }
      }
    }
  };

  certidoesResumo: CertidaoResumoDTO | null = null;

  // DEC (somente leitura)
  decComunicacoes: ComunicacaoDecDTO[] = [];
  readonly tipoDecLabel = TipoDecLabel;
  readonly urgenciaDecLabel = UrgenciaDecLabel;
  readonly tomUrgenciaDec = tomUrgenciaDec;

  get decAtencao(): ComunicacaoDecDTO[] {
    return this.decComunicacoes.filter(decPrecisaAtencao);
  }

  get decRecentes(): ComunicacaoDecDTO[] {
    return this.decComunicacoes.slice(0, 5);
  }

  statusLabel = StatusArquivoLabel;
  categoriaLabel = CategoriaFiscalLabel;
  acaoLabel = AcaoLogLabel;

  /** Cores de status alinhadas aos tokens semânticos do styles.css */
  private coresStatus: Record<StatusArquivo, string> = {
    [StatusArquivo.PENDENTE]: '#e08a0b',
    [StatusArquivo.ENTREGUE]: '#1e9e57',
    [StatusArquivo.VENCIDO]: '#d92d4a',
    [StatusArquivo.ARQUIVADO]: '#8b94aa'
  };

  constructor(
    private arquivoService: ArquivoService,
    private empresaService: EmpresaService,
    private pastaService: PastaService,
    private usuarioService: UsuarioService,
    private socioService: SocioService,
    private authService: AuthService,
    private dashboardService: DashboardService,
    private logService: LogAcessoService,
    private obrigacaoPendenteService: ObrigacaoPendenteService,
    private decService: DecService,
    private certidaoService: CertidaoService,
    private router: Router
  ) {}

  ngOnInit(): void {
    const hoje = new Date();
    this.dataAtual = hoje.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
    this.dataCurta = hoje.toLocaleDateString('pt-BR');
    this.saudacao = this.calcularSaudacao();
    this.nomeUsuario = this.extrairNomeUsuario();
    this.isAdmin = this.authService.isAdmin();
    this.idEmpresaUsuario = this.authService.getEmpresaId();
    try { this.bannerFechado = sessionStorage.getItem(this.BANNER_KEY) === '1'; } catch {}
    this.carregarDados();
  }

  ngOnDestroy(): void {
    this.pararCarrossel();
  }

  private calcularSaudacao(): string {
    const h = new Date().getHours();
    if (h < 12) return 'Bom dia';
    if (h < 18) return 'Boa tarde';
    return 'Boa noite';
  }

  private extrairNomeUsuario(): string {
    const sub = this.authService.getPayload()?.sub ?? '';
    if (!sub) return '';
    return sub.split('@')[0]
      .split(/[.\-_]/)
      .filter(Boolean)
      .map(p => p[0].toUpperCase() + p.slice(1))
      .join(' ');
  }

  get primeiroNome(): string {
    return this.nomeUsuario.split(' ')[0];
  }

  /** Funcionário de cliente só enxerga dados da própria empresa. */
  private daEmpresa<T extends { idEmpresa: number }>(lista: T[]): T[] {
    return this.isAdmin || this.idEmpresaUsuario == null ? lista : lista.filter(x => x.idEmpresa === this.idEmpresaUsuario);
  }

  carregarDados(): void {
    this.carregando = true;
    this.carregandoObrig = true;

    this.empresaService.listar().subscribe({
      next: (data) => {
        this.empresas = data;
        this.totalEmpresas = data.length;
        if (this.idEmpresaSelecionada == null) {
          const salva = this.lerEmpresaSalva();
          const valida = salva != null && data.some(e => e.id === salva) ? salva : null;
          this.idEmpresaSelecionada = valida ?? this.idEmpresaUsuario ?? data[0]?.id ?? null;
        }
        if (this.idEmpresaSelecionada != null) this.carregarMetricas();
        this.atualizarResumoEmpresas();
      }
    });

    this.pastaService.listar().subscribe({
      next: (data) => { this.pastas = data; this.totalPastas = data.length; }
    });

    if (this.isAdmin) {
      this.usuarioService.listar().subscribe({ next: (data) => this.totalUsuarios = data.length });
      this.socioService.listar().subscribe({ next: (data) => this.totalSocios = data.length });
    }

    this.arquivoService.listar().subscribe({
      next: (data) => {
        this.arquivos = this.daEmpresa(data).filter(a => !a.excluidoEm);
        this.totalArquivos = this.arquivos.length;
        this.totalBytes = this.arquivos.reduce((acc, a) => acc + (a.tamanho || 0), 0);
        this.totalVencidosGeral = this.arquivos.filter(a => a.status === StatusArquivo.VENCIDO).length;
        this.atualizarDerivados();
        this.carregando = false;
      },
      error: () => { this.carregando = false; }
    });

    this.certidaoService.resumo(this.isAdmin ? null : this.idEmpresaUsuario).subscribe({
      next: (r) => { this.certidoesResumo = r; this.montarSlides(); },
      error: () => { this.certidoesResumo = null; }
    });

    this.decService.listar().subscribe({
      next: (d) => { this.decComunicacoes = d; this.montarSlides(); },
      error: () => { this.decComunicacoes = []; }
    });

    this.obrigacaoPendenteService.listar().subscribe({
      next: (data) => {
        this.obrigacoesGeral = this.daEmpresa(data);
        this.totalPendentesObrigGeral = this.obrigacoesGeral.filter(o => o.status !== 'ENTREGUE').length;
        this.atualizarDerivados();
        this.carregandoObrig = false;
      },
      error: () => { this.carregandoObrig = false; }
    });
  }

  private atualizarDerivados(): void {
    this.proximosVencimentos = this.calcularProximosVencimentos();
    this.atualizarResumoEmpresas();
    this.montarSlides();
  }

  // ================= INDICADORES =================

  /** Obrigações não entregues cujo prazo já passou (VENCIDA ou PENDENTE atrasada). */
  get obrigacoesAtrasadas(): ObrigacaoPendenteResponseDTO[] {
    return this.obrigacoesGeral.filter(o =>
      o.status === 'VENCIDA' || (o.status === 'PENDENTE' && o.diasParaVencer != null && o.diasParaVencer < 0));
  }

  get totalAcaoImediata(): number {
    return this.obrigacoesAtrasadas.length + this.totalVencidosGeral;
  }

  get maiorAtrasoDias(): number {
    const dias = [
      ...this.obrigacoesAtrasadas.map(o => o.diasParaVencer ?? 0),
      ...this.arquivos.filter(a => a.status === StatusArquivo.VENCIDO).map(a => a.diasParaVencer ?? 0)
    ].filter(d => d < 0);
    return dias.length ? -Math.min(...dias) : 0;
  }

  /** Obrigações em que o cliente precisa enviar documentos e que ainda estão em aberto. */
  get paraEnviar(): ObrigacaoComFluxo[] {
    return (this.obrigacoesGeral as ObrigacaoComFluxo[])
      .filter(o => o.responsavel === 'CLIENTE' && o.status !== 'ENTREGUE')
      .sort((a, b) => (a.diasParaVencer ?? 0) - (b.diasParaVencer ?? 0));
  }

  get vencendo7(): Vencimento[] {
    return this.proximosVencimentos.filter(v => v.diasParaVencer <= 7);
  }

  get empresasComAtencao(): number {
    return this.resumoEmpresas.filter(r => r.vencidos > 0 || r.obrigVencidas > 0).length;
  }

  get empresasEmDia(): number {
    return this.resumoEmpresas.length - this.empresasComAtencao;
  }

  get percentualEmDia(): number {
    return this.resumoEmpresas.length ? Math.round((this.empresasEmDia / this.resumoEmpresas.length) * 100) : 0;
  }

  get nomeEmpresaUsuario(): string {
    return this.empresas.find(e => e.id === this.idEmpresaUsuario)?.nomeFantasia ?? 'sua empresa';
  }

  // ================= DERIVAÇÕES =================

  private atualizarResumoEmpresas(): void {
    if (!this.empresas.length) return;
    this.resumoEmpresas = this.empresas.map(e => {
      const arqs = this.arquivos.filter(a => a.idEmpresa === e.id);
      const obr = this.obrigacoesGeral.filter(o => o.idEmpresa === e.id);
      return {
        id: e.id!,
        nome: e.nomeFantasia,
        total: arqs.length,
        vencidos: arqs.filter(a => a.status === StatusArquivo.VENCIDO).length,
        pendentes: arqs.filter(a => a.status === StatusArquivo.PENDENTE).length
          + obr.filter(o => o.status === 'PENDENTE' && (o.diasParaVencer ?? 0) >= 0).length,
        vencendo7: arqs.filter(a => a.diasParaVencer != null && a.diasParaVencer >= 0 && a.diasParaVencer <= 7
          && a.status !== StatusArquivo.ENTREGUE && a.status !== StatusArquivo.ARQUIVADO).length,
        obrigVencidas: obr.filter(o => o.status === 'VENCIDA' || (o.status === 'PENDENTE' && (o.diasParaVencer ?? 0) < 0)).length
      };
    }).sort((a, b) => (b.vencidos + b.obrigVencidas) - (a.vencidos + a.obrigVencidas) || b.pendentes - a.pendentes);
  }

  saudeEmpresa(r: ResumoEmpresa): 'danger' | 'warning' | 'success' {
    if (r.vencidos > 0 || r.obrigVencidas > 0) return 'danger';
    if (r.pendentes > 0 || r.vencendo7 > 0) return 'warning';
    return 'success';
  }

  rotuloSaude(r: ResumoEmpresa): string {
    return { danger: 'Com atraso', warning: 'Atenção', success: 'Em dia' }[this.saudeEmpresa(r)];
  }

  private calcularProximosVencimentos(): Vencimento[] {
    const nomeEmpresa = (id: number) => this.empresas.find(e => e.id === id)?.nomeFantasia ?? '';
    const obr: Vencimento[] = this.obrigacoesGeral
      .filter(o => o.status === 'PENDENTE' && o.diasParaVencer != null && o.diasParaVencer >= 0 && o.diasParaVencer <= 14)
      .map(o => ({
        tipo: 'obrigacao' as const,
        id: o.id,
        nome: o.nomeObrigacao || 'Obrigação',
        detalhe: this.isAdmin ? nomeEmpresa(o.idEmpresa) : 'Obrigação fiscal',
        dataVencimento: o.dataVencimento,
        diasParaVencer: o.diasParaVencer!
      }));
    const arq: Vencimento[] = this.arquivos
      .filter(a => a.dataVencimento && a.diasParaVencer != null && a.diasParaVencer >= 0 && a.diasParaVencer <= 14
        && a.status !== StatusArquivo.ENTREGUE && a.status !== StatusArquivo.ARQUIVADO)
      .map(a => ({
        tipo: 'arquivo' as const,
        id: a.id,
        nome: a.nomeOriginal,
        detalhe: a.descricao || (this.isAdmin ? nomeEmpresa(a.idEmpresa) : 'Arquivo'),
        dataVencimento: a.dataVencimento!,
        diasParaVencer: a.diasParaVencer!
      }));
    return [...obr, ...arq].sort((a, b) => a.diasParaVencer - b.diasParaVencer).slice(0, 8);
  }

  // ================= BANNER =================

  private montarSlides(): void {
    const s: Slide[] = [];
    const atrasadas = this.obrigacoesAtrasadas.length;
    if (atrasadas > 0) {
      s.push({
        tom: 'danger',
        icone: 'alert-triangle',
        titulo: `${atrasadas} ${atrasadas === 1 ? 'obrigação vencida precisa' : 'obrigações vencidas precisam'} de atenção`,
        texto: `A mais antiga venceu há ${this.maiorAtrasoDias} dias. Marque como entregue ou prorrogue o prazo para evitar multa e juros.`,
        cta: 'Resolver agora',
        rota: '/obrigacoes-pendentes'
      });
    }
    const dec = this.decAtencao.length;
    if (dec > 0) {
      const menor = Math.min(...this.decAtencao.map(c => c.diasRestantes ?? 99));
      s.push({
        tom: 'danger',
        icone: 'inbox',
        titulo: dec + (dec === 1 ? ' comunicação do DEC exige atenção' : ' comunicações do DEC exigem atenção'),
        texto: 'Chegaram na caixa da SEFAZ-TO e ainda estão sem ciência' + (menor <= 0 ? ' — a ciência tácita é hoje.' : ' — a primeira vira ciência tácita em ' + menor + (menor === 1 ? ' dia.' : ' dias.')),
        cta: 'Ver comunicações',
        rota: '/dec'
      });
    }
    const cert = this.certidoesResumo;
    if (cert && (cert.vencidas > 0 || cert.vencendo > 0)) {
      const partes = [];
      if (cert.vencidas) partes.push(cert.vencidas + (cert.vencidas === 1 ? ' vencida' : ' vencidas'));
      if (cert.vencendo) partes.push(cert.vencendo + ' vencendo em até 15 dias');
      s.push({
        tom: cert.vencidas ? 'danger' : 'primary',
        icone: 'shield-check',
        titulo: 'Certidões: ' + partes.join(' e '),
        texto: (this.isAdmin ? cert.empresasComAlerta + (cert.empresasComAlerta === 1 ? ' empresa precisa' : ' empresas precisam') + ' renovar certidões. ' : '')
          + 'Certidão vencida impede licitações, financiamentos e alguns contratos.',
        cta: 'Ver certidões',
        rota: '/certidoes',
        queryParams: { status: cert.vencidas ? 'vencida' : 'vencendo' }
      });
    }
    if (this.totalVencidosGeral > 0) {
      s.push({
        tom: 'primary',
        icone: 'file-clock',
        titulo: `${this.totalVencidosGeral} ${this.totalVencidosGeral === 1 ? 'arquivo está vencido' : 'arquivos estão vencidos'}`,
        texto: 'Documentos com data de validade expirada. Envie a versão atualizada ou arquive o que não é mais necessário.',
        cta: 'Ver arquivos',
        rota: '/arquivos'
      });
    }
    const prox = this.proximosVencimentos[0];
    if (prox) {
      s.push({
        tom: 'primary',
        icone: 'calendar-clock',
        titulo: `Próximo vencimento: ${prox.nome}`,
        texto: `${prox.diasParaVencer === 0 ? 'Vence hoje' : prox.diasParaVencer === 1 ? 'Vence amanhã' : 'Vence em ' + prox.diasParaVencer + ' dias'}`
          + `${prox.detalhe ? ' · ' + prox.detalhe : ''}. Há ${this.vencendo7.length} ${this.vencendo7.length === 1 ? 'item' : 'itens'} vencendo nos próximos 7 dias.`,
        cta: 'Abrir calendário',
        rota: '/calendario'
      });
    }
    if (!s.length) {
      s.push({
        tom: 'success',
        icone: 'shield-check',
        titulo: 'Tudo em dia por aqui',
        texto: 'Nenhuma obrigação vencida e nenhum documento expirado. Aproveite para adiantar os envios do mês.',
        cta: 'Enviar arquivo',
        rota: '/arquivos'
      });
    }
    this.slides = s;
    if (this.slideAtual >= s.length) this.slideAtual = 0;
  }

  get slide(): Slide | null {
    return this.slides[this.slideAtual] ?? null;
  }

  irSlide(i: number): void {
    if (!this.slides.length) return;
    this.slideAtual = (i + this.slides.length) % this.slides.length;
    this.iniciarCarrossel();
  }

  private iniciarCarrossel(): void {
    this.pararCarrossel();
    if (this.slides.length > 1) this.timerSlide = setInterval(() => this.irSlide(this.slideAtual + 1), 8000);
  }

  pararCarrossel(): void {
    if (this.timerSlide) { clearInterval(this.timerSlide); this.timerSlide = null; }
  }

  fecharBanner(): void {
    this.bannerFechado = true;
    this.pararCarrossel();
    try { sessionStorage.setItem(this.BANNER_KEY, '1'); } catch {}
  }

  abrirSlide(s: Slide): void {
    this.router.navigate([s.rota], s.queryParams ? { queryParams: s.queryParams } : {});
  }

  // ================= PAINEL POR EMPRESA =================

  carregarMetricas(): void {
    if (this.idEmpresaSelecionada == null) return;
    this.carregandoMetricas = true;
    this.metricas = null;
    this.salvarEmpresa(this.idEmpresaSelecionada);
    this.dashboardService.porEmpresa(this.idEmpresaSelecionada).subscribe({
      next: (data) => {
        this.metricas = data;
        this.distStatus = this.montarDistStatus(data);
        this.distCategoria = this.montarDistCategoria(data);
        this.chartStatusData = this.distStatus.length ? {
          labels: this.distStatus.map(d => d.label),
          datasets: [{
            data: this.distStatus.map(d => d.total),
            backgroundColor: this.distStatus.map(d => d.cor),
            hoverOffset: 4,
            borderWidth: 2,
            borderColor: '#ffffff'
          }]
        } : undefined;
        this.carregandoMetricas = false;
      },
      error: () => { this.carregandoMetricas = false; }
    });
  }

  /** Painel contábil da empresa, em painel lateral (aberto pela tabela da carteira). */
  painelAberto = false;

  verPainelEmpresa(id: number): void {
    this.idEmpresaSelecionada = id;
    this.carregarMetricas();
    this.painelAberto = true;
  }

  @HostListener('document:keydown.escape')
  fecharPainel(): void {
    this.painelAberto = false;
  }

  get totalDistStatus(): number {
    return this.distStatus.reduce((a, d) => a + d.total, 0);
  }

  private montarDistStatus(d: DashboardResponseDTO): DistItem[] {
    const total = Object.values(d.distribuicaoPorStatus).reduce((a, b) => a + (b ?? 0), 0);
    if (total === 0) return [];
    return Object.entries(d.distribuicaoPorStatus)
      .filter(([, v]) => (v ?? 0) > 0)
      .map(([k, v]) => ({
        chave: k,
        label: this.statusLabel[k as StatusArquivo],
        total: v as number,
        percentual: Math.round(((v as number) / total) * 100),
        cor: this.coresStatus[k as StatusArquivo]
      }));
  }

  private montarDistCategoria(d: DashboardResponseDTO): DistItem[] {
    const entries = Object.entries(d.distribuicaoPorCategoria).filter(([, v]) => (v ?? 0) > 0);
    const max = Math.max(...entries.map(([, v]) => v as number), 1);
    return entries
      .map(([k, v]) => ({
        chave: k,
        label: this.categoriaLabel[k as CategoriaFiscal],
        total: v as number,
        percentual: Math.round(((v as number) / max) * 100),
        cor: 'var(--primary)'
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
  }

  private salvarEmpresa(id: number): void {
    try { localStorage.setItem(this.EMPRESA_KEY, String(id)); } catch {}
  }

  private lerEmpresaSalva(): number | null {
    try {
      const v = localStorage.getItem(this.EMPRESA_KEY);
      return v ? Number(v) : null;
    } catch { return null; }
  }

  // ================= NAVEGAÇÃO / FORMATO =================

  navegarPara(rota: string): void {
    this.router.navigate([rota]);
  }

  abrirVencimento(v: Vencimento): void {
    if (v.tipo === 'arquivo') this.router.navigate(['/arquivos'], { queryParams: { id: v.id } });
    else this.router.navigate(['/obrigacoes-pendentes']);
  }

  enviarArquivo(): void {
    this.router.navigate(['/arquivos'], { queryParams: { upload: 1 } });
  }

  abrirMinhaEmpresa(): void {
    if (this.idEmpresaUsuario) this.router.navigate(['/empresas', this.idEmpresaUsuario]);
  }

  abrirArquivo(id: number): void {
    this.router.navigate(['/arquivos'], { queryParams: { id } });
  }

  formatarTaxa(taxa: number | null): string {
    if (taxa == null) return '—';
    return `${taxa.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
  }

  tomAcao(acao: string): string {
    const a = acao.toUpperCase();
    if (a.includes('EXCLU') || a.includes('DELET') || a.includes('REMOV')) return 'danger';
    if (a.includes('CRIA') || a.includes('UPLOAD') || a.includes('ENTREG')) return 'success';
    if (a.includes('ATUALIZ') || a.includes('EDIT') || a.includes('ALTER') || a.includes('MOV')) return 'primary';
    return 'neutral';
  }

  iconeAcao(acao: string): string {
    const a = acao.toUpperCase();
    if (a.includes('LOGIN') || a.includes('LOGOUT')) return 'log-out';
    if (a.includes('UPLOAD')) return 'upload';
    if (a.includes('DOWNLOAD')) return 'download';
    if (a.includes('EXCLU') || a.includes('DELET')) return 'trash';
    if (a.includes('RESTAUR')) return 'rotate-ccw';
    if (a.includes('CRIA')) return 'plus';
    return 'pencil';
  }
}
