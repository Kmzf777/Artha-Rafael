// Cliente HTTP do painel. Erro do servidor vira Error com a mensagem que a
// rota mandou — a tela precisa dela para mostrar "janela fechada".
export async function api<T>(caminho: string, init?: RequestInit): Promise<T> {
  const resp = await fetch(caminho, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  const json = await resp.json().catch(() => ({}))
  if (!resp.ok) {
    const corpo = json as { mensagem?: string; erro?: string; erros?: string[] }
    throw new Error(corpo.mensagem ?? corpo.erros?.join(' ') ?? corpo.erro ?? `HTTP ${resp.status}`)
  }
  return json as T
}
