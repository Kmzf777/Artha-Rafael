// Sem gate de sessão: não há autenticação nesta fase. O login é uma tela que
// navega para o painel.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
