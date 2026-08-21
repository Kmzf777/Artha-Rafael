import { describe, it, expect } from 'vitest'
import { getInitials, formatRecordingTime } from './format'

describe('getInitials', () => {
  it('usa as duas primeiras iniciais do nome', () => {
    expect(getInitials('Maria Silva Souza', '5534999999999')).toBe('MS')
  })
  it('nome de uma palavra devolve uma inicial', () => {
    expect(getInitials('Maria', '5534999999999')).toBe('M')
  })
  it('sem nome, cai para os dois ultimos digitos do telefone', () => {
    expect(getInitials(null, '5534999999912')).toBe('12')
  })
  it('nome vazio cai para o telefone', () => {
    expect(getInitials('', '5534999999912')).toBe('12')
  })
})

describe('formatRecordingTime', () => {
  it('zero-padda minutos e segundos', () => {
    expect(formatRecordingTime(0)).toBe('00:00')
    expect(formatRecordingTime(9)).toBe('00:09')
    expect(formatRecordingTime(75)).toBe('01:15')
    expect(formatRecordingTime(600)).toBe('10:00')
  })
})
