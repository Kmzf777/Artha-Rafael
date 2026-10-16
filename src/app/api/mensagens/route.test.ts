import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// O que é externo (Graph da Meta, Postgres) vira dublê; a rota e a regra de
// qual inbound marcar (`ultimaInboundComWamid`) rodam de verdade.
vi.mock('server-only', () => ({}))
vi.mock('@/server/meta/client', async (original) => ({
  ...(await original<typeof import('@/server/meta/client')>()),
  enviarTexto: vi.fn(),
  marcarComoLidaNaMeta: vi.fn(),
}))
vi.mock('@/server/repo/leads', () => ({ buscarLeadPorTelefone: vi.fn() }))
vi.mock('@/server/repo/mensagens', () => ({
  inserirMensagem: vi.fn(),
  janelaAberta: vi.fn(),
  marcarCardLido: vi.fn(),
  mensagensDoCard: vi.fn(),
}))

import { enviarTexto, marcarComoLidaNaMeta, MetaError } from '@/server/meta/client'
import { buscarLeadPorTelefone } from '@/server/repo/leads'
import {
  inserirMensagem,
  janelaAberta,
  marcarCardLido,
  mensagensDoCard,
} from '@/server/repo/mensagens'
import { POST } from './route'

const KEY = '11999990000::100200300'

function pedido() {
  return new Request('http://localhost/api/mensagens', {
    method: 'POST',
    body: JSON.stringify({ key: KEY, telefone: '11999990000', texto: 'Oi, aqui é da Artha' }),
  })
}

// Só os campos que a rota lê importam para a regra; o resto da forma de fio
// não participa da decisão de qual mensagem marcar.
const linha = (direction: 'inbound' | 'outbound', message_id: string | null, created_at: string) =>
  ({ direction, message_id, created_at }) as Awaited<ReturnType<typeof mensagensDoCard>>[number]

describe('POST /api/mensagens — leitura pela equipe', () => {
  beforeEach(() => {
    vi.mocked(janelaAberta).mockResolvedValue(true)
    vi.mocked(enviarTexto).mockResolvedValue({
      messages: [{ id: 'wamid.ENVIADA' }],
      contacts: [{ wa_id: '5511999990000' }],
    })
    vi.mocked(buscarLeadPorTelefone).mockResolvedValue(null)
    vi.mocked(inserirMensagem).mockResolvedValue()
    vi.mocked(marcarCardLido).mockResolvedValue()
    vi.mocked(marcarComoLidaNaMeta).mockResolvedValue()
    vi.mocked(mensagensDoCard).mockResolvedValue([
      linha('inbound', 'wamid.ANTIGA', '2026-10-16T10:00:00.000Z'),
      linha('inbound', 'wamid.ULTIMA', '2026-10-16T11:00:00.000Z'),
      linha('outbound', 'wamid.NOSSA', '2026-10-16T12:00:00.000Z'),
    ])
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  it('depois do envio aceito, grava a leitura do card e manda o visto azul da última inbound', async () => {
    const resp = await POST(pedido())

    expect(resp.status).toBe(200)
    expect(marcarCardLido).toHaveBeenCalledWith(KEY)
    expect(marcarComoLidaNaMeta).toHaveBeenCalledTimes(1)
    expect(marcarComoLidaNaMeta).toHaveBeenCalledWith('wamid.ULTIMA')
    // "Depois do envio ser aceito": o recibo nunca sai antes da mensagem.
    expect(vi.mocked(enviarTexto).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(marcarComoLidaNaMeta).mock.invocationCallOrder[0]
    )
  })

  it('recibo recusado pela Meta não derruba o envio', async () => {
    vi.mocked(marcarComoLidaNaMeta).mockRejectedValue(new MetaError(100, 'mensagem com mais de 30 dias'))

    const resp = await POST(pedido())

    expect(resp.status).toBe(200)
    expect(await resp.json()).toEqual({ ok: true, message_id: 'wamid.ENVIADA' })
    expect(console.error).toHaveBeenCalled()
  })

  it('falha ao gravar a leitura não derruba o envio nem impede o visto azul', async () => {
    vi.mocked(marcarCardLido).mockRejectedValue(new Error('marcarCardLido: banco fora'))

    const resp = await POST(pedido())

    expect(resp.status).toBe(200)
    expect(marcarComoLidaNaMeta).toHaveBeenCalledWith('wamid.ULTIMA')
  })

  it('sem inbound com wamid, não chama a Meta', async () => {
    vi.mocked(mensagensDoCard).mockResolvedValue([
      linha('inbound', null, '2026-10-16T10:00:00.000Z'),
      linha('outbound', 'wamid.NOSSA', '2026-10-16T12:00:00.000Z'),
    ])

    const resp = await POST(pedido())

    expect(resp.status).toBe(200)
    expect(marcarComoLidaNaMeta).not.toHaveBeenCalled()
  })

  it('envio recusado pela Meta não marca nada como lido', async () => {
    vi.mocked(enviarTexto).mockRejectedValue(new MetaError(131047, 'janela fechada'))

    const resp = await POST(pedido())

    expect(resp.status).toBe(502)
    expect(marcarCardLido).not.toHaveBeenCalled()
    expect(marcarComoLidaNaMeta).not.toHaveBeenCalled()
  })
})
