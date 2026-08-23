import { describe, expect, it } from 'vitest'
import { COOKIE_SESSAO, criarSessao, senhaConfere, sessaoValida } from './sessao'

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

describe('COOKIE_SESSAO', () => {
  it('tem nome estável — middleware e rota precisam concordar', () => {
    expect(COOKIE_SESSAO).toBe('artha_sessao')
  })
})
