import { describe, expect, it } from 'vitest'
import { isToday } from 'date-fns'
import { ANCORA, agoraDemo, LEADS, MENSAGENS } from './db'
import { formatSectionDate } from '../lib/format'

// A âncora precisa acompanhar o calendário. `formatMsgTime` e `formatSectionDate`
// decidem "Hoje"/"Ontem" contra o relógio do sistema; com âncora congelada, a demo
// troca "14:32" por uma data no dia seguinte e parece parada no tempo.
describe('âncora temporal', () => {
  it('é sempre o dia corrente', () => {
    expect(isToday(ANCORA)).toBe(true)
  })

  it('nunca está no futuro', () => {
    expect(ANCORA.getTime()).toBeLessThanOrEqual(Date.now())
  })

  it('agoraDemo devolve cópia, não a instância compartilhada', () => {
    const a = agoraDemo()
    a.setFullYear(1999)
    expect(ANCORA.getFullYear()).not.toBe(1999)
  })

  it('a mensagem mais recente rende "Hoje" no separador de data', () => {
    const maisRecente = MENSAGENS.reduce((a, b) =>
      new Date(a.criadoEm) > new Date(b.criadoEm) ? a : b
    )
    expect(formatSectionDate(maisRecente.criadoEm)).toBe('Hoje')
  })

  it('nenhum dado do mock cai no futuro', () => {
    const agora = agoraDemo().getTime()
    const futuras = MENSAGENS.filter((m) => new Date(m.criadoEm).getTime() > agora)
    expect(futuras).toHaveLength(0)

    const acessosFuturos = LEADS.filter(
      (l) => l.ultimoAcessoEm !== null && new Date(l.ultimoAcessoEm).getTime() > agora
    )
    expect(acessosFuturos).toHaveLength(0)
  })
})
