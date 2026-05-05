import { Component, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { forkJoin } from 'rxjs';

import { EmpresaService } from '../../../services/empresa.service';
import { SocioService } from '../../../services/socio.service';
import { ArquivoService } from '../../../services/arquivo.service';
import { ObrigacaoPendenteService } from '../../../services/obrigacao-pendente.service';
import { AuthService } from '../../../services/auth.service';

import { EmpresaResponseDTO } from '../../../models/empresa-response.dto';
import { SocioResponseDTO } from '../../../models/socio-response.dto';
import { ArquivoResponseDTO } from '../../../models/arquivo-response.dto';
import { ObrigacaoPendenteResponseDTO } from '../../../models/obrigacao-pendente-response.dto';
import { CategoriaFiscal } from '../../../models/enums/categoria-fiscal.enum';
import { StatusObrigacao } from '../../../models/enums/status-obrigacao.enum';
import { StatusArquivo } from '../../../models/enums/status-arquivo.enum';
import { SituacaoCadastralLabel } from '../../../models/enums/situacao-cadastral.enum';
import { NaturezaJuridicaLabel } from '../../../models/enums/natureza-juridica.enum';
import { RegimeTributarioLabel } from '../../../models/enums/regime-tributario.enum';

export interface ChecklistItem {
  titulo: string;
  descricao: string;
  ok: boolean;
  dica?: string;
  detalhe?: string;
}

type AbaId = 'visao' | 'dados' | 'socios' | 'checklist';

interface Aba {
  id: AbaId;
  label: string;
  icone: string;
}

@Component({
  selector: 'app-empresa-detail',
  standalone: true,
  imports: [CommonModule, RouterModule],
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
    { id: 'dados', label: 'Dados cadastrais', icone: 'file' },
    { id: 'socios', label: 'Sócios', icone: 'user' },
    { id: 'checklist', label: 'Checklist', icone: 'check' }
  ];

  situacaoLabel = SituacaoCadastralLabel;
  naturezaLabel = NaturezaJuridicaLabel;
  regimeLabel = RegimeTributarioLabel;

  copiado: string | null = null;
  toastVisivel = false;
  toastMensagem = '';

  scrolled = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private empresaService: EmpresaService,
    private socioService: SocioService,
    private arquivoService: ArquivoService,
    private obrigacaoService: ObrigacaoPendenteService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!id) {
      this.erro = 'ID da empresa inválido.';
      this.carregando = false;
      return;
    }

    // funcionário só pode ver a própria empresa
    if (!this.authService.isAdmin()) {
      const minhaEmpresa = this.authService.getEmpresaId();
      if (minhaEmpresa !== id) {
        this.router.navigate(['/empresas', minhaEmpresa]);
        return;
      }
    }

    this.carregar(id);
  }

  @HostListener('window:scroll')
  onScroll(): void {
    this.scrolled = window.scrollY > 80;
  }

  carregar(id: number): void {
    this.carregando = true;
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
      }
    });
  }

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

    const totalParticipacao = this.socios.reduce(
      (acc, s) => acc + (s.participacao ?? 0), 0
    );

    const temAdmin = this.socios.some(s => s.administrador === true);

    return [
      {
        titulo: 'Contrato Social',
        descricao: 'Documento de constituição da empresa arquivado no sistema.',
        ok: temCategoria(CategoriaFiscal.CONTRATO_SOCIAL),
        dica: 'Faça upload do contrato social pela tela de Arquivos e marque a categoria "Contrato Social".'
      },
      {
        titulo: 'Certidões negativas',
        descricao: 'Ao menos uma CND (federal, estadual ou trabalhista) arquivada.',
        ok: temCategoria(CategoriaFiscal.CERTIDAO),
        dica: 'Emita a CND mais recente e faça upload na categoria "Certidão".'
      },
      {
        titulo: `Balancete de ${this.nomeMes(mes)}/${ano}`,
        descricao: 'Balancete contábil do mês corrente.',
        ok: balanceteAtual,
        dica: 'O balancete do mês atual ainda não foi enviado. Faça upload na categoria "Balancete".'
      },
      {
        titulo: 'Obrigações do mês',
        descricao: 'Todas as obrigações com vencimento neste mês já entregues.',
        ok: totalObrigacoesMes > 0 && obrigacoesEntregues === totalObrigacoesMes,
        detalhe: totalObrigacoesMes === 0
          ? 'Sem obrigações cadastradas neste mês'
          : `${obrigacoesEntregues} de ${totalObrigacoesMes} entregues`,
        dica: 'Abra o calendário de obrigações para ver o que falta entregar.'
      },
      {
        titulo: 'Inscrição Estadual',
        descricao: 'IE cadastrada nos dados fiscais.',
        ok: !!this.empresa.inscricaoEstadual && this.empresa.inscricaoEstadual.trim().length > 0,
        dica: 'Edite os dados da empresa e informe a Inscrição Estadual.'
      },
      {
        titulo: 'Inscrição Municipal',
        descricao: 'IM cadastrada nos dados fiscais.',
        ok: !!this.empresa.inscricaoMunicipal && this.empresa.inscricaoMunicipal.trim().length > 0,
        dica: 'Edite os dados da empresa e informe a Inscrição Municipal.'
      },
      {
        titulo: 'Regime tributário',
        descricao: 'Regime (Simples, Lucro Presumido, Lucro Real) informado.',
        ok: !!this.empresa.regimeTributario,
        dica: 'Defina o regime tributário nos dados fiscais da empresa.'
      },
      {
        titulo: 'Endereço completo',
        descricao: 'Rua, número, bairro, cidade e CEP preenchidos.',
        ok: !!this.empresa.endereco
          && !!this.empresa.endereco.logradouro
          && !!this.empresa.endereco.numero
          && !!this.empresa.endereco.bairro
          && !!this.empresa.endereco.cidade
          && !!this.empresa.endereco.cep,
        dica: 'Complete o endereço da empresa nos dados cadastrais.'
      },
      {
        titulo: 'Sócios cadastrados',
        descricao: 'Pelo menos um sócio registrado.',
        ok: this.socios.length > 0,
        detalhe: `${this.socios.length} sócio(s)`,
        dica: 'Cadastre os sócios da empresa na aba Sócios.'
      },
      {
        titulo: 'Administrador definido',
        descricao: 'Ao menos um sócio marcado como administrador.',
        ok: temAdmin,
        dica: 'Na edição do sócio, marque "Administrador" para pelo menos um deles.'
      },
      {
        titulo: 'Participação = 100%',
        descricao: 'Soma das participações dos sócios deve fechar em 100%.',
        ok: Math.abs(totalParticipacao - 100) < 0.01,
        detalhe: `Atual: ${totalParticipacao.toFixed(2)}%`,
        dica: 'Ajuste a porcentagem de cada sócio até a soma totalizar 100%.'
      }
    ];
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
    const pendentes = this.obrigacoes
      .filter(o => o.status === StatusObrigacao.PENDENTE && !!o.dataVencimento)
      .filter(o => new Date(o.dataVencimento + 'T00:00:00') >= hoje)
      .sort((a, b) => a.dataVencimento.localeCompare(b.dataVencimento));
    return pendentes[0] ?? null;
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

  // ============ helpers ============

  private isMesmoMes(dataISO: string, ano: number, mes: number): boolean {
    const d = new Date(dataISO + 'T00:00:00');
    return d.getFullYear() === ano && d.getMonth() + 1 === mes;
  }

  nomeMes(mes: number): string {
    return ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][mes - 1];
  }

  formatarCnpj(cnpj: string | null | undefined): string {
    if (!cnpj) return '';
    const v = cnpj.replace(/\D/g, '');
    return v.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  }

  formatarCpf(cpf: string | null | undefined): string {
    if (!cpf) return '';
    const v = cpf.replace(/\D/g, '');
    return v.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  }

  formatarTelefone(tel: string | null | undefined): string {
    if (!tel) return '';
    const v = tel.replace(/\D/g, '');
    if (v.length === 11) return v.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
    if (v.length === 10) return v.replace(/^(\d{2})(\d{4})(\d{4})$/, '($1) $2-$3');
    return v;
  }

  formatarCep(cep: string | null | undefined): string {
    if (!cep) return '';
    const v = cep.replace(/\D/g, '');
    return v.replace(/^(\d{5})(\d{3})$/, '$1-$2');
  }

  formatarData(iso: string | null | undefined): string {
    if (!iso) return '—';
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('pt-BR');
  }

  situacaoClasse(): string {
    const s = this.empresa?.situacaoCadastral;
    if (s === 'ATIVA') return 'badge-situacao badge-ativa';
    if (s === 'BAIXADA' || s === 'NULA') return 'badge-situacao badge-inativa';
    return 'badge-situacao badge-alerta';
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
    return partes.join(', ');
  }

  // ============ ações ============

  copiar(valor: string | null | undefined, chave: string): void {
    if (!valor) return;
    navigator.clipboard.writeText(valor).then(() => {
      this.copiado = chave;
      this.mostrarToast('Copiado para a área de transferência.');
      setTimeout(() => {
        if (this.copiado === chave) this.copiado = null;
      }, 1500);
    });
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

  voltar(): void {
    if (this.authService.isAdmin()) {
      this.router.navigate(['/empresas']);
    } else {
      this.router.navigate(['/dashboard']);
    }
  }

  mudarAba(aba: AbaId): void {
    this.abaAtual = aba;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  private mostrarToast(msg: string): void {
    this.toastMensagem = msg;
    this.toastVisivel = true;
    setTimeout(() => { this.toastVisivel = false; }, 2000);
  }
}
