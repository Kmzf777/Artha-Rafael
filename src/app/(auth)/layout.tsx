// Casca das telas de autenticação.
//
// A ÚNICA inversão de polaridade da tela vive aqui, e ela carrega conteúdo: o
// painel `--ink` é o `hero-band-dark` do DESIGN.md — a proposta do sistema e as
// três superfícies que o cliente vai ver a seguir. O DESIGN.md é categórico em
// dizer que a troca de polaridade É a pista de profundidade; aqui ela separa
// "o que é este sistema" (superfície institucional, imutável) de "quem é você"
// (superfície de ação, clara). Sem conteúdo, seria decoração — e aí não valeria.
//
// Os tokens fazem a inversão sozinhos nos dois temas: no claro o painel é preto
// com texto branco; no escuro `--ink` já é branco e `--on-ink` já é preto, então
// o painel continua sendo o oposto exato da página.

import Image from 'next/image'

const DESTAQUES = [
  { titulo: 'Reativação', nota: 'Régua por tempo sem acesso' },
  { titulo: 'Conversas', nota: 'Janela de 24h à vista' },
  { titulo: 'Disparos', nota: 'Template aprovado e fila' },
] as const

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-canvas lg:grid lg:grid-cols-2">
      <section className="flex flex-col gap-8 bg-ink p-8 text-on-ink lg:justify-between">
        {/* Logotipo no mesmo tratamento da Sidebar, com "System" em texto.
            Aqui em polaridade invertida, porque a superfície é a invertida:
            `logo-on-ink` faz a marca virar silhueta clara sobre o painel. */}
        <p className="reveal-rise flex items-center gap-2 t-display-md">
          <Image
            src="/logo-artha.png"
            alt="Artha"
            width={125}
            height={40}
            priority
            className="logo-on-ink h-10 w-auto"
          />
          <span className="text-mute">System</span>
        </p>

        <div className="reveal-rise max-w-lg" style={{ animationDelay: '60ms' }}>
          <p className="t-display-xl">A base inativa volta a conversar.</p>
          <p className="mt-4 t-body-lg opacity-75">
            Atendimento, segmentação e reativação por WhatsApp em um só lugar, com a API
            oficial da Meta e o histórico de cada pessoa à vista.
          </p>
        </div>

        <ul
          className="reveal-rise hidden max-w-lg grid-cols-3 gap-4 border-t border-on-ink/20 pt-6 lg:grid"
          style={{ animationDelay: '120ms' }}
        >
          {DESTAQUES.map((destaque) => (
            <li key={destaque.titulo}>
              <p className="t-body-md-strong">{destaque.titulo}</p>
              <p className="mt-1 t-caption opacity-70">{destaque.nota}</p>
            </li>
          ))}
        </ul>
      </section>

      <main className="flex flex-1 flex-col items-center justify-center gap-6 bg-canvas p-8">
        {children}
        <p className="t-caption text-body">
          Artha · planejamento e educação financeira · Uberlândia, MG
        </p>
      </main>
    </div>
  )
}
