import { Component, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { IconComponent } from '../../shared/icon.component';
import { ToastService } from '../../shared/ui/toast.service';
import { AuthService } from '../../services/auth.service';
import { IaExemplosComponent } from '../ia/ia-exemplos/ia-exemplos.component';

type Perfil = 'escritorio' | 'cliente';

interface Passo { titulo: string; texto: string; link: string; icone: string; aviso?: string; }
interface Recurso { titulo: string; texto: string; icone: string; tom: string; }

/** Senha comum a todos os usuários de demonstração. */
const SENHA_DEMO = '123456';

@Component({
  selector: 'app-como-usar',
  standalone: true,
  imports: [RouterLink, IconComponent, IaExemplosComponent],
  templateUrl: './como-usar.component.html',
  styleUrl: './como-usar.component.css'
})
export class ComoUsarComponent implements OnInit {

  readonly senha = SENHA_DEMO;
  logado = false;
  perfilAtual: Perfil | null = null;
  aba: Perfil = 'escritorio';

  readonly valores = [
    { icone: 'calendar-clock', tom: 'danger', titulo: 'Prazos sob controle',
      texto: 'Vencimentos por competência, com alertas antes e depois do prazo.' },
    { icone: 'handshake', tom: 'accent', titulo: 'Escritório e cliente no mesmo lugar',
      texto: 'Guias, documentos e confirmações trocados no sistema, não por e-mail ou WhatsApp.' },
    { icone: 'inbox', tom: 'info', titulo: 'Comunicações da SEFAZ automáticas',
      texto: 'Avisos do DEC chegam sozinhos, com a contagem até a ciência tácita.' },
    { icone: 'sparkles', tom: 'success', titulo: 'Inteligência artificial no dia a dia',
      texto: 'A IA lê guias e documentos (valor, vencimento, CNPJ) e o Assistente responde sobre a sua conta.' }
  ];

  readonly perfis = [
    {
      id: 'escritorio' as Perfil, nome: 'Escritório', papel: 'Administrador · Diniz Assessoria',
      icone: 'briefcase', email: 'rafael@diniz.com.br',
      pode: [
        'Vê todas as empresas clientes e seus prazos',
        'Anexa guias às obrigações e prorroga vencimentos',
        'Cadastra empresas, obrigações recorrentes e usuários',
        'Acompanha comunicações DEC e a auditoria'
      ]
    },
    {
      id: 'cliente' as Perfil, nome: 'Cliente', papel: 'Funcionário · Padaria Pão Quente',
      icone: 'building', email: 'maria@paoquente.com.br',
      pode: [
        'Vê somente os dados da própria empresa',
        'Envia os documentos que o escritório solicita',
        'Baixa as guias e confirma o pagamento',
        'Organiza os arquivos da empresa'
      ]
    }
  ];

  readonly outroCliente = 'carlos@topecas.com.br';

  readonly roteiros: Record<Perfil, Passo[]> = {
    escritorio: [
      { titulo: 'Painel', link: '/dashboard', icone: 'dashboard',
        texto: 'Mostra o que exige atenção hoje: obrigações vencidas, prazos da semana e documentos aguardando os clientes.' },
      { titulo: 'Leitura de guia com IA', link: '/obrigacoes-pendentes', icone: 'sparkles',
        texto: 'Em Pendências, clique em "Anexar guia" numa obrigação do escritório e escolha um PDF de guia: a IA lê tipo, valor, vencimento, competência e CNPJ, preenche o formulário e avisa divergências. Há guias de exemplo para baixar na seção abaixo.' },
      { titulo: 'Pendências', link: '/obrigacoes-pendentes', icone: 'list-checks',
        texto: 'Clique no indicador "Vencidas" para filtrar. Numa linha, prorrogue o vencimento (ícone de calendário) ou use "Anexar guia": a obrigação passa a Entregue.' },
      { titulo: 'Calendário', link: '/calendario', icone: 'calendar',
        texto: 'Vencimentos do mês de todas as empresas, coloridos por situação. Alterne entre Mês e Lista.' },
      { titulo: 'Empresas', link: '/empresas', icone: 'building',
        texto: 'Abra uma empresa: visão geral, dados cadastrais, sócios, checklist e a aba DEC com as comunicações daquele CNPJ.' },
      { titulo: 'Comunicações DEC', link: '/dec', icone: 'inbox',
        texto: 'Mensagens do Domicílio Eletrônico do Contribuinte (SEFAZ-TO) importadas do DEC Monitor, com o prazo restante até a ciência tácita.' },
      { titulo: 'Arquivos', link: '/arquivos', icone: 'folder',
        texto: 'Pastas por empresa, no estilo Drive: envie (ou arraste) arquivos, mova, renomeie e alterne entre lista e grade.' },
      { titulo: 'Fechamento mensal', link: '/fechamento', icone: 'layers',
        texto: 'Kanban do fechamento de cada empresa no mês: arraste os cards entre as etapas e defina o responsável.' },
      { titulo: 'Certidões', link: '/certidoes', icone: 'shield-check',
        texto: 'Validade das certidões negativas de cada cliente. Use a visão "Matriz" para ver a carteira inteira de uma vez.' },
      { titulo: 'Relatórios', link: '/relatorios', icone: 'bar-chart',
        texto: 'Relatório mensal da empresa, da carteira e de pendências: imprima, salve em PDF ou exporte CSV.' },
      { titulo: 'Assistente Diniz', link: '/dashboard', icone: 'sparkles',
        texto: 'Clique no botão flutuante no canto inferior direito e pergunte, por exemplo: "Quais empresas estão com obrigações vencidas?".' },
      { titulo: 'Auditoria', link: '/logs', icone: 'activity',
        texto: 'Confira o registro das ações que você acabou de fazer: quem fez, o quê e quando.' }
    ],
    cliente: [
      { titulo: 'Painel', link: '/dashboard', icone: 'dashboard',
        texto: 'O bloco "O que você precisa enviar" lista os documentos pedidos pelo escritório e os próximos prazos da empresa.' },
      { titulo: 'Pendências', link: '/obrigacoes-pendentes', icone: 'list-checks',
        texto: 'Aparecem apenas as obrigações da Padaria Pão Quente, com competência, vencimento e situação.' },
      { titulo: 'Enviar documento', link: '/obrigacoes-pendentes', icone: 'upload',
        texto: 'Use o filtro "A enviar", escolha um item (ex.: extrato bancário) e envie o arquivo. Ele vai para a pasta sugerida e o item fica entregue.' },
      { titulo: 'Confirmar pagamento de guia', link: '/obrigacoes-pendentes', icone: 'banknote',
        texto: 'Clique numa guia entregue pelo escritório (ex.: DAS) para ver os detalhes e baixar o PDF. Em "Confirmar pagamento", informe a data e anexe o comprovante.' },
      { titulo: 'Conversar com o escritório', link: '/obrigacoes-pendentes', icone: 'message-circle',
        texto: 'Abra uma obrigação e use a "Conversa" no painel lateral para tirar dúvidas. Mensagens novas aparecem no sino.' },
      { titulo: 'Assistente Diniz', link: '/dashboard', icone: 'sparkles',
        texto: 'No botão flutuante, pergunte: "O que eu preciso enviar este mês?" ou "Quais guias vencem esta semana?".' },
      { titulo: 'Arquivos', link: '/arquivos', icone: 'folder',
        texto: 'As pastas da sua empresa. Arquivos de outras empresas não aparecem aqui nem na busca.' },
      { titulo: 'Minha conta', link: '/conta', icone: 'user', aviso: 'Não troque a senha da conta de demonstração: outros avaliadores usam o mesmo acesso.',
        texto: 'Seus dados de usuário e a troca de senha.' }
    ]
  };

  readonly recursos: Recurso[] = [
    { icone: 'dashboard', tom: '', titulo: 'Painel', texto: 'Indicadores do dia com atalho para resolver cada item.' },
    { icone: 'list-checks', tom: 'warning', titulo: 'Pendências e competência', texto: 'Cada obrigação tem mês de referência, vencimento e situação.' },
    { icone: 'repeat', tom: '', titulo: 'Obrigações recorrentes', texto: 'DAS, FGTS, INSS, ICMS... geram as pendências do mês automaticamente.' },
    { icone: 'calendar', tom: 'info', titulo: 'Calendário fiscal', texto: 'Vencimentos por dia, em visão mensal ou lista.' },
    { icone: 'folder', tom: 'accent', titulo: 'Arquivos estilo Drive', texto: 'Pastas por empresa: enviar, mover, renomear, buscar.' },
    { icone: 'banknote', tom: 'success', titulo: 'Pagamento de guias', texto: 'O escritório anexa a guia; o cliente confirma a data e envia o comprovante.' },
    { icone: 'inbox', tom: 'info', titulo: 'Comunicações DEC', texto: 'Integração com o DEC Monitor e contagem até a ciência tácita.' },
    { icone: 'bell', tom: 'warning', titulo: 'Notificações', texto: 'O sino no topo avisa vencimentos próximos e comunicações novas.' },
    { icone: 'shield-check', tom: 'success', titulo: 'Isolamento por empresa', texto: 'LGPD: cada cliente acessa só os dados da própria empresa.' },
    { icone: 'activity', tom: 'neutral', titulo: 'Auditoria', texto: 'Acessos, envios, downloads e exclusões ficam registrados.' },
    { icone: 'trash', tom: 'danger', titulo: 'Lixeira', texto: 'Itens excluídos podem ser restaurados.' },
    { icone: 'sparkles', tom: 'success', titulo: 'Leitura inteligente (IA)', texto: 'Lê guias e documentos em PDF e confere com a obrigação.' },
    { icone: 'sparkles', tom: '', titulo: 'Assistente Diniz', texto: 'Chat com IA que responde com os dados da sua conta.' },
    { icone: 'shield-check', tom: 'warning', titulo: 'Certidões', texto: 'Validade das CNDs com alerta antes de vencer.' },
    { icone: 'layers', tom: 'info', titulo: 'Fechamento mensal', texto: 'Kanban das etapas de cada empresa no mês.' },
    { icone: 'message-circle', tom: 'accent', titulo: 'Conversas', texto: 'Mensagens dentro de cada obrigação, com histórico.' },
    { icone: 'bar-chart', tom: '', titulo: 'Relatórios', texto: 'Mensal, carteira e pendências, em PDF ou CSV.' },
    { icone: 'camera', tom: 'neutral', titulo: 'No celular', texto: 'Tire foto do documento e instale como aplicativo.' },
    { icone: 'command', tom: 'neutral', titulo: 'Atalhos de teclado', texto: '' }
  ];

  readonly tecnologias = [
    { icone: 'layers', titulo: 'Front-end', texto: 'Angular 20' },
    { icone: 'zap', titulo: 'API REST', texto: 'Quarkus 3 · Java 21' },
    { icone: 'hard-drive', titulo: 'Banco de dados', texto: 'PostgreSQL (Neon)' },
    { icone: 'lock', titulo: 'Segurança', texto: 'JWT com perfis Escritório e Cliente' },
    { icone: 'link', titulo: 'Integração', texto: 'REST com o DEC Monitor (Next.js), somente leitura' },
    { icone: 'sparkles', titulo: 'Inteligência artificial', texto: 'DeepSeek (LLM) + extração de texto de PDF (PDFBox)' },
    { icone: 'upload-cloud', titulo: 'Publicação', texto: 'Nuvem gratuita: Vercel + Render' }
  ];

  constructor(private auth: AuthService, private toast: ToastService, private router: Router) {}

  ngOnInit(): void {
    this.logado = this.auth.isLogado();
    if (this.logado) {
      this.perfilAtual = this.auth.isAdmin() ? 'escritorio' : 'cliente';
      this.aba = this.perfilAtual;
    }
  }

  get nomePerfilAtual(): string {
    return this.perfilAtual === 'escritorio' ? 'Escritório' : 'Cliente';
  }

  get nomeAba(): string {
    return this.aba === 'escritorio' ? 'Escritório' : 'Cliente';
  }

  async copiar(texto: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(texto);
    } catch {
      // contexto sem Clipboard API (http, navegador antigo)
      const ta = document.createElement('textarea');
      ta.value = texto;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch { /* sem suporte */ }
      ta.remove();
    }
    this.toast.success('Copiado', texto);
  }

  /** Sai da sessão atual e volta ao login para entrar com o outro perfil. */
  trocarPerfil(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
