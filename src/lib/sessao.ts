// Sessão do painel: um cookie assinado que prova "alguém digitou a senha".
//
// Usa **Web Crypto**, não `node:crypto`, porque o `middleware.ts` roda no
// runtime Edge, onde os módulos do Node não existem. Web Crypto está nos dois
// (Edge e Node 18+), então o mesmo módulo serve o middleware e as rotas.
//
// Não há tabela de usuários: a credencial principal é compartilhada pela equipe
// (ver `AccountInfo`), e `PAINEL_CONTAS` só acrescenta pares usuário/senha. O token não carrega identidade — carrega validade. Contas
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

export type Conta = { usuario: string; senha: string }

/**
 * Contas extras de `PAINEL_CONTAS`: `usuario:senha` separadas por `;`. Cada
 * par divide no PRIMEIRO `:`, então a senha pode conter `:`. Entrada vazia,
 * sem `:`, sem usuário ou sem senha é ignorada.
 *
 * Servem para dar acesso a alguém sem entregar a credencial principal. O
 * token continua assinado com `PAINEL_SENHA` e não carrega quem entrou: tirar
 * uma conta daqui impede logins novos, mas a sessão já aberta dura até expirar
 * (12h). Para derrubar todas na hora, troca-se `PAINEL_SENHA`.
 */
export function lerContas(texto: string | undefined): Conta[] {
  const contas: Conta[] = []
  for (const entrada of (texto ?? '').split(';')) {
    const corte = entrada.indexOf(':')
    if (corte < 0) continue
    const usuario = entrada.slice(0, corte).trim()
    const senha = entrada.slice(corte + 1).trim()
    if (usuario && senha) contas.push({ usuario, senha })
  }
  return contas
}

/**
 * A credencial confere com alguma das contas. Compara contra TODAS, usuário e
 * senha, sem parar na primeira: o tempo de resposta não pode revelar qual
 * usuário existe.
 */
export async function credencialConfere(usuario: string, senha: string, contas: Conta[]): Promise<boolean> {
  const resultados = await Promise.all(
    contas.map(async (c) => {
      const [okUsuario, okSenha] = await Promise.all([
        senhaConfere(usuario, c.usuario),
        senhaConfere(senha, c.senha),
      ])
      return okUsuario && okSenha
    })
  )
  return resultados.some(Boolean)
}

export const COOKIE_SESSAO = 'artha_sessao'
