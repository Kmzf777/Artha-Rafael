// src/lib/statusEntrega.test.ts
import { describe, expect, it } from 'vitest'
import { avancarStatus, estadosPromovidosPor, statusDaMeta } from './statusEntrega'

describe('avancarStatus — status só avança, nunca retrocede', () => {
  it('avança na ordem normal', () => {
    expect(avancarStatus(null, 'enviado')).toBe('enviado')
    expect(avancarStatus('enviado', 'entregue')).toBe('entregue')
    expect(avancarStatus('entregue', 'lido')).toBe('lido')
  })

  it('ignora callback atrasado que rebaixaria', () => {
    expect(avancarStatus('lido', 'enviado')).toBe('lido')
    expect(avancarStatus('lido', 'entregue')).toBe('lido')
    expect(avancarStatus('entregue', 'enviado')).toBe('entregue')
  })

  it('falha vence qualquer estado e é terminal', () => {
    expect(avancarStatus('enviado', 'falhou')).toBe('falhou')
    expect(avancarStatus('lido', 'falhou')).toBe('falhou')
    expect(avancarStatus('falhou', 'lido')).toBe('falhou')
    expect(avancarStatus('falhou', 'entregue')).toBe('falhou')
  })
})

describe('statusDaMeta — traduz o vocabulário do webhook', () => {
  it('mapeia os quatro estados', () => {
    expect(statusDaMeta('sent')).toBe('enviado')
    expect(statusDaMeta('delivered')).toBe('entregue')
    expect(statusDaMeta('read')).toBe('lido')
    expect(statusDaMeta('failed')).toBe('falhou')
  })

  it('devolve null para o que não conhece', () => {
    expect(statusDaMeta('deleted')).toBeNull()
    expect(statusDaMeta('')).toBeNull()
  })
})

describe('estadosPromovidosPor — a guarda que vai no where do update', () => {
  it('lista só o que o novo estado supera', () => {
    expect(estadosPromovidosPor('enviado')).toEqual([])
    expect(estadosPromovidosPor('entregue')).toEqual(['enviado'])
    expect(estadosPromovidosPor('lido')).toEqual(['enviado', 'entregue'])
    expect(estadosPromovidosPor('falhou')).toEqual(['enviado', 'entregue', 'lido'])
  })

  it('concorda com avancarStatus para todo par possível', () => {
    // As duas réguas precisam dizer a mesma coisa: `avancarStatus` decide o
    // valor, `estadosPromovidosPor` decide se a linha pode ser sobrescrita.
    // Divergirem devolveria a corrida que a guarda existe para fechar.
    const todos = ['enviado', 'entregue', 'lido', 'falhou'] as const
    for (const atual of todos) {
      for (const novo of todos) {
        const promove = estadosPromovidosPor(novo).includes(atual)
        expect(promove).toBe(avancarStatus(atual, novo) === novo && atual !== novo)
      }
    }
  })
})
