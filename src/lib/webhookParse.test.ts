// src/lib/webhookParse.test.ts
import { describe, expect, it } from 'vitest'
import { parseWebhook } from './webhookParse'

const ENTRADA_TEXTO = {
  object: 'whatsapp_business_account',
  entry: [
    {
      id: '1440374588143232',
      changes: [
        {
          field: 'messages',
          value: {
            messaging_product: 'whatsapp',
            metadata: { display_phone_number: '553492114080', phone_number_id: '1305873789266362' },
            contacts: [{ profile: { name: 'Rafael Recidive' }, wa_id: '553488861441' }],
            messages: [
              {
                from: '553488861441',
                id: 'wamid.ABC',
                timestamp: '1787200000',
                type: 'text',
                text: { body: 'Quero saber mais' },
              },
            ],
          },
        },
      ],
    },
  ],
}

const ENTRADA_STATUS = {
  object: 'whatsapp_business_account',
  entry: [
    {
      id: '1440374588143232',
      changes: [
        {
          field: 'messages',
          value: {
            messaging_product: 'whatsapp',
            metadata: { display_phone_number: '553492114080', phone_number_id: '1305873789266362' },
            statuses: [
              { id: 'wamid.ABC', status: 'read', timestamp: '1787200100', recipient_id: '553488861441' },
            ],
          },
        },
      ],
    },
  ],
}

describe('parseWebhook — mensagens de entrada', () => {
  it('extrai a mensagem de texto com telefone normalizado', () => {
    const r = parseWebhook(ENTRADA_TEXTO)
    expect(r.mensagens).toHaveLength(1)
    const m = r.mensagens[0]
    expect(m.message_id).toBe('wamid.ABC')
    // O `from` vem com 12 dígitos; gravamos os 11 canônicos. Ver spec §2.1.
    expect(m.phone).toBe('34988861441')
    expect(m.phone_id).toBe('1305873789266362')
    expect(m.contact_name).toBe('Rafael Recidive')
    expect(m.message_type).toBe('text')
    expect(m.content).toBe('Quero saber mais')
    expect(m.created_at).toBe(new Date(1787200000 * 1000).toISOString())
    expect(m.media_id).toBeNull()
  })

  it('não devolve status quando o payload é de mensagem', () => {
    expect(parseWebhook(ENTRADA_TEXTO).statuses).toHaveLength(0)
  })
})

describe('parseWebhook — callbacks de status', () => {
  it('extrai o status casado por wamid', () => {
    const r = parseWebhook(ENTRADA_STATUS)
    expect(r.mensagens).toHaveLength(0)
    expect(r.statuses).toEqual([{ message_id: 'wamid.ABC', status: 'lido' }])
  })
})

describe('parseWebhook — botão, mídia e ruído', () => {
  it('lê o texto do botão como conteúdo', () => {
    const payload = structuredClone(ENTRADA_TEXTO)
    payload.entry[0].changes[0].value.messages[0] = {
      from: '553488861441',
      id: 'wamid.BTN',
      timestamp: '1787200000',
      type: 'button',
      button: { text: 'Quero voltar', payload: 'REATIVAR' },
    } as never
    const m = parseWebhook(payload).mensagens[0]
    expect(m.message_type).toBe('button')
    expect(m.content).toBe('Quero voltar')
  })

  it('registra media_id e mime na imagem, sem baixar nada', () => {
    const payload = structuredClone(ENTRADA_TEXTO)
    payload.entry[0].changes[0].value.messages[0] = {
      from: '553488861441',
      id: 'wamid.IMG',
      timestamp: '1787200000',
      type: 'image',
      image: { id: '999', mime_type: 'image/jpeg', caption: 'meu extrato' },
    } as never
    const m = parseWebhook(payload).mensagens[0]
    expect(m.media_id).toBe('999')
    expect(m.media_mime_type).toBe('image/jpeg')
    expect(m.content).toBe('meu extrato')
  })

  it('devolve vazio para payload sem entry, sem estourar', () => {
    expect(parseWebhook({})).toEqual({ mensagens: [], statuses: [] })
    expect(parseWebhook(null)).toEqual({ mensagens: [], statuses: [] })
  })
})

describe('id do botão', () => {
  function envelope(mensagem: Record<string, unknown>) {
    return {
      entry: [
        {
          changes: [
            {
              value: {
                metadata: { phone_number_id: '111' },
                contacts: [{ wa_id: '5534988861441', profile: { name: 'Rafael' } }],
                messages: [mensagem],
              },
            },
          ],
        },
      ],
    }
  }

  it('mensagem interativa guarda o id no button_id e o título no content', () => {
    const { mensagens } = parseWebhook(
      envelope({
        id: 'wamid.1',
        from: '5534988861441',
        timestamp: '1755000000',
        type: 'interactive',
        interactive: {
          type: 'button_reply',
          button_reply: { id: 'p1:artha', title: 'Minhas finanças' },
        },
      })
    )
    expect(mensagens[0].button_id).toBe('p1:artha')
    expect(mensagens[0].content).toBe('Minhas finanças')
  })

  it('botão de template guarda o payload no button_id', () => {
    const { mensagens } = parseWebhook(
      envelope({
        id: 'wamid.2',
        from: '5534988861441',
        timestamp: '1755000000',
        type: 'button',
        button: { payload: 'quero_voltar', text: 'Quero voltar' },
      })
    )
    expect(mensagens[0].button_id).toBe('quero_voltar')
    expect(mensagens[0].content).toBe('Quero voltar')
  })

  it('mensagem de texto não tem button_id', () => {
    const { mensagens } = parseWebhook(
      envelope({
        id: 'wamid.3',
        from: '5534988861441',
        timestamp: '1755000000',
        type: 'text',
        text: { body: 'oi' },
      })
    )
    expect(mensagens[0].button_id).toBeNull()
  })

  it('mensagem de lista guarda o id do list_reply no button_id', () => {
    const { mensagens } = parseWebhook(
      envelope({
        id: 'wamid.4',
        from: '5534988861441',
        timestamp: '1755000000',
        type: 'interactive',
        interactive: {
          type: 'list_reply',
          list_reply: { id: 'menu:1', title: 'Opção 1' },
        },
      })
    )
    expect(mensagens[0].button_id).toBe('menu:1')
    expect(mensagens[0].content).toBe('Opção 1')
  })

  it('botão de template sem payload não estoura, button_id fica null', () => {
    const { mensagens } = parseWebhook(
      envelope({
        id: 'wamid.5',
        from: '5534988861441',
        timestamp: '1755000000',
        type: 'button',
        button: { text: 'sem payload' },
      })
    )
    expect(mensagens[0].button_id).toBeNull()
  })

  it('mensagem interativa sem button_reply nem list_reply não estoura, button_id fica null', () => {
    const { mensagens } = parseWebhook(
      envelope({
        id: 'wamid.6',
        from: '5534988861441',
        timestamp: '1755000000',
        type: 'interactive',
        interactive: { type: 'button_reply' },
      })
    )
    expect(mensagens[0].button_id).toBeNull()
  })
})
