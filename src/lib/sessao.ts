// Sessão do painel: um cookie assinado que prova "alguém digitou a senha".
//
// Usa **Web Crypto**, não `node:crypto`, porque o `middleware.ts` roda no
// runtime Edge, onde os módulos do Node não existem. Web Crypto está nos dois
// (Edge e Node 18+), então o mesmo módulo serve o middleware e as rotas.
//
// Não há tabela de usuários: a credencial é uma só, compartilhada pela equipe
// (ver `AccountInfo`). O token não carrega identidade — carrega validade. Contas
// por pessoa são o recorte B5.

const enc = new TextEncoder()

async function chave(segredo: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', enc.encode(segredo), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ])
}

function base64url(bytes: ArrayBuffer): string {
  let bin = ''
  for (const b of new Uint8Array(bytes)) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function assinar(dado: string, segredo: string): Promise<string> {
  return base64url(await crypto.subtle.sign('HMAC', await chave(segredo), enc.encode(dado)))
}

/**
 * Compara em tempo constante.
 *
 * O Edge não tem `timingSafeEqual`. Assinar os dois lados com uma chave
 * efêmera e comparar as assinaturas resolve: o resultado só é igual quando as
 * entradas são iguais, e o tempo de comparação não depende de onde diverge.
 */
async function iguais(a: string, b: string): Promise<boolean> {
  const efemera = crypto.randomUUID()
  const [x, y] = await Promise.all([assinar(a, efemera), assinar(b, efemera)])
  return x === y
}

export const DURACAO_PADRAO_MS = 12 * 60 * 60 * 1000

/** Token no formato `<expiraEm>.<assinatura>`. */
export async function criarSessao(
  segredo: string,
  agora: number,
  duracaoMs: number = DURACAO_PADRAO_MS
): Promise<string> {
  const expiraEm = agora + duracaoMs
  return `${expiraEm}.${await assinar(String(expiraEm), segredo)}`
}

/** Token válido: assinatura confere E ainda não expirou. */
export async function sessaoValida(
  token: string | undefined | null,
  segredo: string,
  agora: number
): Promise<boolean> {
  if (!token) return false
  const corte = token.lastIndexOf('.')
  if (corte <= 0) return false

  const expiraEm = token.slice(0, corte)
  const assinatura = token.slice(corte + 1)

  // Assinatura primeiro: sem ela, `expiraEm` é texto que o cliente escolheu.
  if (!(await iguais(assinatura, await assinar(expiraEm, segredo)))) return false

  const prazo = Number(expiraEm)
  return Number.isFinite(prazo) && prazo > agora
}

/** A senha digitada confere com a configurada. */
export async function senhaConfere(digitada: string, esperada: string): Promise<boolean> {
  if (!esperada) return false
  return iguais(digitada, esperada)
}

export const COOKIE_SESSAO = 'artha_sessao'
