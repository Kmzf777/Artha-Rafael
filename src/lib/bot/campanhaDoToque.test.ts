import { describe, it, expect } from 'vitest'
import { campanhaDoToque, type MensagemToque } from './campanhaDoToque'

function saida(message_id: string, campanha_id: string | null): MensagemToque {
  return { direction: 'outbound', message_id, reply_to_message_id: null, campanha_id }
}

function toque(message_id: string, reply_to_message_id: string | null = null): MensagemToque {
  return { direction: 'inbound', message_id, reply_to_message_id, campanha_id: null }
}

describe('campanhaDoToque', () => {
  it('o context.id manda, mesmo com campanha mais recente', () => {
    const h = [saida('w1', 'A'), saida('w2', 'B'), toque('in1', 'w1')]
    expect(campanhaDoToque(h, 'in1')).toBe('A')
  })

  it('sem context.id, usa a campanha mais recente antes do toque', () => {
    const h = [saida('w1', 'A'), saida('w2', 'B'), saida('bot1', null), toque('in1')]
    expect(campanhaDoToque(h, 'in1')).toBe('B')
  })

  it('context.id que não é de campanha cai na mais recente', () => {
    const h = [saida('w1', 'A'), saida('bot1', null), toque('in1', 'bot1')]
    expect(campanhaDoToque(h, 'in1')).toBe('A')
    expect(campanhaDoToque([saida('w1', 'A'), toque('in1', 'fora')], 'in1')).toBe('A')
  })

  it('ignora campanha enviada depois do toque', () => {
    const h = [saida('w1', 'A'), toque('in1'), saida('w2', 'B')]
    expect(campanhaDoToque(h, 'in1')).toBe('A')
  })

  it('sem campanha nenhuma devolve null', () => {
    expect(campanhaDoToque([saida('bot1', null), toque('in1')], 'in1')).toBeNull()
    expect(campanhaDoToque([], 'in1')).toBeNull()
  })

  it('toque fora do histórico usa a campanha mais recente do histórico', () => {
    expect(campanhaDoToque([saida('w1', 'A'), saida('w2', 'B')], 'in1')).toBe('B')
  })
})
