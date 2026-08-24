import { describe, it, expect } from 'vitest'
import { parseTab, isActiveTab, tabHref, DEFAULT_TAB, ACTIVE_TABS } from './tabs'

describe('ACTIVE_TABS', () => {
  it('registra exatamente as sete superfícies do painel', () => {
    expect(ACTIVE_TABS).toEqual([
      'dashboard',
      'conversations',
      'leads',
      'disparos',
      'templates',
      'reports',
      'account',
    ])
  })
})

describe('parseTab', () => {
  it('retorna a própria aba para valores válidos', () => {
    expect(parseTab('dashboard')).toBe('dashboard')
    expect(parseTab('conversations')).toBe('conversations')
    expect(parseTab('leads')).toBe('leads')
    expect(parseTab('reports')).toBe('reports')
    expect(parseTab('account')).toBe('account')
  })
  it('cai no default para ausente, vazio ou inválido', () => {
    expect(parseTab(null)).toBe(DEFAULT_TAB)
    expect(parseTab(undefined)).toBe(DEFAULT_TAB)
    expect(parseTab('')).toBe(DEFAULT_TAB)
    expect(parseTab('xyz')).toBe(DEFAULT_TAB)
    // Abas da herança Mar Azul não existem mais.
    expect(parseTab('erros')).toBe(DEFAULT_TAB)
    expect(parseTab('instances')).toBe(DEFAULT_TAB)
    // Superfícies fora do recorte da demo.
    expect(parseTab('reativacao')).toBe(DEFAULT_TAB)
    expect(parseTab('agendamentos')).toBe(DEFAULT_TAB)
    expect(parseTab('executivo')).toBe(DEFAULT_TAB)
  })
})

describe('isActiveTab', () => {
  it('true para válidos, false para o resto', () => {
    expect(isActiveTab('leads')).toBe(true)
    expect(isActiveTab('templates')).toBe(true)
    expect(isActiveTab('reativacao')).toBe(false)
    expect(isActiveTab('xyz')).toBe(false)
    expect(isActiveTab(null)).toBe(false)
  })
})

describe('tabHref', () => {
  it('dashboard usa a raiz limpa e as demais usam ?tab=', () => {
    expect(tabHref('dashboard')).toBe('/')
    expect(tabHref('conversations')).toBe('/?tab=conversations')
    expect(tabHref('disparos')).toBe('/?tab=disparos')
    expect(tabHref('reports')).toBe('/?tab=reports')
    expect(tabHref('account')).toBe('/?tab=account')
  })
})
