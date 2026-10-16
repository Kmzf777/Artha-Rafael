import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// `server-only` estoura fora do bundle do servidor do Next; aqui é só um marcador.
vi.mock('server-only', () => ({}))

import { marcarComoLidaNaMeta, MetaError } from './client'

describe('marcarComoLidaNaMeta', () => {
  const fetchFalso = vi.fn()

  beforeEach(() => {
    vi.stubEnv('WHATSAPP_ACCESS_TOKEN', 'token-de-teste')
    vi.stubEnv('WHATSAPP_PHONE_NUMBER_ID', '100200300')
    vi.stubEnv('GRAPH_API_VERSION', 'v21.0')
    vi.stubGlobal('fetch', fetchFalso)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    fetchFalso.mockReset()
  })

  it('manda o recibo de leitura do wamid ao endpoint de mensagens do número', async () => {
    fetchFalso.mockResolvedValue(new Response('{"success":true}', { status: 200 }))

    await marcarComoLidaNaMeta('wamid.ULTIMA')

    expect(fetchFalso).toHaveBeenCalledTimes(1)
    const [url, init] = fetchFalso.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://graph.facebook.com/v21.0/100200300/messages')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual({
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: 'wamid.ULTIMA',
    })
  })

  it('recusa da Meta (mensagem com mais de 30 dias) vira MetaError', async () => {
    fetchFalso.mockResolvedValue(
      new Response(JSON.stringify({ error: { code: 100, message: 'Invalid parameter' } }), {
        status: 400,
      })
    )

    await expect(marcarComoLidaNaMeta('wamid.VELHA')).rejects.toBeInstanceOf(MetaError)
  })
})
