import { describe, expect, it } from 'vitest'
import {
  COOKIE_SESSAO,
  credencialConfere,
  criarSessao,
  emailDaConta,
  lerContas,
  senhaConfere,
  sessaoValida,
} from './sessao'

const SEGREDO = 'segredo-de-teste'
const AGORA = 1_787_400_000_000

describe('criarSessao / sessaoValida', () => {
  it('aceita o token que acabou de emitir', async () => {
    const token = await criarSessao(SEGREDO, AGORA)
    expect(await sessaoValida(token, SEGREDO, AGORA)).toBe(true)
  })

  it('recusa depois de expirar', async () => {
    const token = await criarSessao(SEGREDO, AGORA, 1000)
    expect(await sessaoValida(token, SEGREDO, AGORA + 999)).toBe(true)
    expect(await sessaoValida(token, SEGREDO, AGORA + 1001)).toBe(false)
  })

  it('recusa token assinado com outro segredo', async () => {
    const token = await criarSessao('outro', AGORA)
    expect(await sessaoValida(token, SEGREDO, AGORA)).toBe(false)
  })

  it('recusa validade esticada pelo cliente', async () => {
    // O ataque óbvio: pegar o token, trocar o prazo por um bem maior e manter a
    // assinatura. A assinatura cobre o prazo, então não cola.
    const token = await criarSessao(SEGREDO, AGORA)
    const assinatura = token.slice(token.lastIndexOf('.') + 1)
    const forjado = `${AGORA + 999_999_999}.${assinatura}`
    expect(await sessaoValida(forjado, SEGREDO, AGORA)).toBe(false)
  })

  it('recusa lixo sem estourar', async () => {
    for (const t of [undefined, null, '', 'abc', '.', '123.', `${AGORA}.`]) {
      expect(await sessaoValida(t, SEGREDO, AGORA)).toBe(false)
    }
  })
})

describe('senhaConfere', () => {
  it('aceita a senha certa e recusa a errada', async () => {
    expect(await senhaConfere('correta', 'correta')).toBe(true)
    expect(await senhaConfere('errada', 'correta')).toBe(false)
    expect(await senhaConfere('correta ', 'correta')).toBe(false)
  })

  it('recusa quando não há senha configurada', async () => {
    // Sem senha no ambiente, NADA entra — nem string vazia. O painel aberto é
    // decisão do middleware, não desta função.
    expect(await senhaConfere('', '')).toBe(false)
    expect(await senhaConfere('qualquer', '')).toBe(false)
  })
})

describe('lerContas', () => {
  it('sem PAINEL_CONTAS não há conta extra', () => {
    expect(lerContas(undefined)).toEqual([])
    expect(lerContas('')).toEqual([])
  })

  it('separa as contas por ponto e vírgula e cada par no primeiro dois-pontos', () => {
    expect(lerContas('rafael:abc123;outro:x:y:z')).toEqual([
      { usuario: 'rafael', senha: 'abc123' },
      { usuario: 'outro', senha: 'x:y:z' },
    ])
  })

  it('apara espaços nas pontas e ignora entrada vazia ou malformada', () => {
    expect(lerContas(' rafael : abc ;; semdoispontos; :semusuario; semsenha: ;;')).toEqual([
      { usuario: 'rafael', senha: 'abc' },
    ])
  })
})

describe('credencialConfere', () => {
  const CONTAS = [
    { usuario: 'equipe', senha: 'principal' },
    { usuario: 'rafael', senha: 'abc:123' },
  ]

  it('aceita qualquer conta da lista', async () => {
    expect(await credencialConfere('equipe', 'principal', CONTAS)).toBe(true)
    expect(await credencialConfere('rafael', 'abc:123', CONTAS)).toBe(true)
  })

  it('recusa usuário de uma conta com a senha de outra', async () => {
    expect(await credencialConfere('rafael', 'principal', CONTAS)).toBe(false)
    expect(await credencialConfere('equipe', 'abc:123', CONTAS)).toBe(false)
  })

  it('recusa usuário inexistente, senha errada e lista vazia', async () => {
    expect(await credencialConfere('ninguem', 'principal', CONTAS)).toBe(false)
    expect(await credencialConfere('rafael', 'errada', CONTAS)).toBe(false)
    expect(await credencialConfere('', '', [])).toBe(false)
  })
})

describe('emailDaConta', () => {
  it('usuário sem arroba vira e-mail no TLD reservado .invalid', () => {
    expect(emailDaConta('rafael')).toBe('rafael@painel.invalid')
  })

  it('usuário com arroba é usado como e-mail', () => {
    expect(emailDaConta('rafael@artha.ia.br')).toBe('rafael@artha.ia.br')
  })

  it('normaliza maiúsculas e espaços nas pontas', () => {
    expect(emailDaConta('  Rafael ')).toBe('rafael@painel.invalid')
    expect(emailDaConta(' Rafael@Artha.IA.br ')).toBe('rafael@artha.ia.br')
  })

  it('usuário vazio não vira e-mail', () => {
    expect(emailDaConta('')).toBe('')
    expect(emailDaConta('   ')).toBe('')
  })
})

describe('COOKIE_SESSAO', () => {
  it('tem nome estável — middleware e rota precisam concordar', () => {
    expect(COOKIE_SESSAO).toBe('artha_sessao')
  })
})
