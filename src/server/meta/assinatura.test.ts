// src/server/meta/assinatura.test.ts
import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { assinaturaConfere } from './assinatura'

const SEGREDO = 'segredo_de_teste'
const CORPO = '{"object":"whatsapp_business_account","entry":[]}'

function assinar(corpo: string, segredo = SEGREDO): string {
  return 'sha256=' + createHmac('sha256', segredo).update(corpo).digest('hex')
}

describe('assinaturaConfere', () => {
  it('aceita a assinatura correta', () => {
    expect(assinaturaConfere(CORPO, assinar(CORPO), SEGREDO)).toBe(true)
  })

  it('recusa corpo adulterado', () => {
    expect(assinaturaConfere(CORPO + ' ', assinar(CORPO), SEGREDO)).toBe(false)
  })

  it('recusa assinatura feita com outro segredo', () => {
    expect(assinaturaConfere(CORPO, assinar(CORPO, 'outro'), SEGREDO)).toBe(false)
  })

  it('recusa header ausente, vazio ou sem o prefixo sha256=', () => {
    expect(assinaturaConfere(CORPO, null, SEGREDO)).toBe(false)
    expect(assinaturaConfere(CORPO, '', SEGREDO)).toBe(false)
    expect(assinaturaConfere(CORPO, 'abc123', SEGREDO)).toBe(false)
  })

  it('recusa hex de tamanho errado sem estourar', () => {
    expect(assinaturaConfere(CORPO, 'sha256=dead', SEGREDO)).toBe(false)
  })
})
