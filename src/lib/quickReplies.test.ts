import { describe, it, expect } from 'vitest'
import {
  parseSlashCommand,
  normalizeShortcut,
  isValidShortcut,
  filterQuickReplies,
  applyLeadVariables,
} from './quickReplies'

describe('parseSlashCommand', () => {
  it('retorna string vazia para uma barra isolada', () => {
    expect(parseSlashCommand('/')).toBe('')
  })
  it('retorna a query após a barra', () => {
    expect(parseSlashCommand('/sau')).toBe('sau')
  })
  it('retorna null quando há espaço (deixou de ser atalho)', () => {
    expect(parseSlashCommand('/oi tudo')).toBeNull()
  })
  it('retorna null quando não começa com barra', () => {
    expect(parseSlashCommand('oi')).toBeNull()
  })
  it('retorna null para string vazia', () => {
    expect(parseSlashCommand('')).toBeNull()
  })
})

describe('normalizeShortcut', () => {
  it('remove a barra inicial, apara e minúscula', () => {
    expect(normalizeShortcut('/Saudacao ')).toBe('saudacao')
  })
  it('mantém texto simples normalizado', () => {
    expect(normalizeShortcut('  HORARIO')).toBe('horario')
  })
})

describe('isValidShortcut', () => {
  it('aceita atalho de um token', () => {
    expect(isValidShortcut('/saudacao')).toBe(true)
  })
  it('rejeita vazio', () => {
    expect(isValidShortcut('/')).toBe(false)
    expect(isValidShortcut('   ')).toBe(false)
  })
  it('rejeita atalho com espaço', () => {
    expect(isValidShortcut('bom dia')).toBe(false)
  })
})

const REPLIES = [
  { id: '1', shortcut: 'saudacao', message: 'Olá!' },
  { id: '2', shortcut: 'horario', message: '8h às 18h' },
  { id: '3', shortcut: 'saudavel', message: 'x' },
]

describe('filterQuickReplies', () => {
  it('retorna todas (ordenadas) quando a query é vazia', () => {
    expect(filterQuickReplies(REPLIES, '').map((r) => r.shortcut)).toEqual([
      'horario', 'saudacao', 'saudavel',
    ])
  })
  it('filtra por substring do shortcut, case-insensitive', () => {
    expect(filterQuickReplies(REPLIES, 'SAU').map((r) => r.id)).toEqual(['1', '3'])
  })
  it('retorna vazio quando nada casa', () => {
    expect(filterQuickReplies(REPLIES, 'zzz')).toEqual([])
  })
})

describe('applyLeadVariables', () => {
  it('substitui {nome} pelo contact_name', () => {
    expect(applyLeadVariables('Olá {nome}!', { contact_name: 'João' })).toBe('Olá João!')
  })
  it('usa string vazia quando o dado falta', () => {
    expect(applyLeadVariables('Oi {nome}', { contact_name: null })).toBe('Oi ')
  })
  it('é case-insensitive e global na tag de nome', () => {
    expect(applyLeadVariables('{NOME}/{nome}', { contact_name: 'Ana' })).toBe('Ana/Ana')
  })
})
