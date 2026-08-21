'use client'

import { useEffect, useState } from 'react'

/**
 * Cadência do tique. Todo contador desta UI é em minutos, então 30s basta: o
 * pior atraso possível é meio minuto. O que exige o tique é a janela de 24h —
 * ela precisa fechar sozinha, com a aba aberta, sem o operador recarregar.
 */
const INTERVALO_MS = 30_000

/**
 * O "agora" das telas que leem dados reais do banco.
 *
 * NÃO é `agoraDemo()`. Aquela âncora é resolvida uma única vez na carga do
 * módulo e existe para o dataset fictício de `src/mock/db.ts` não envelhecer —
 * continua correta para semear o banco e para os testes. Sobre dados reais ela
 * vira um relógio parado: uma aba aberta às 08:00 seguiria dizendo, às 20:00,
 * que a janela de 24h está aberta, e o envio só falharia lá no servidor.
 *
 * HIDRATAÇÃO: o valor inicial vem do inicializador preguiçoso do `useState`,
 * avaliado UMA vez por montagem e nunca de novo em re-render — o corpo do render
 * continua puro. No servidor ele é o instante da renderização, no cliente o da
 * hidratação: os dois no mesmo minuto, então nenhum texto diverge. Uma constante
 * de módulo pareceria mais estável e seria pior: no servidor ela congelaria no
 * boot do processo, e um processo de ontem carimbaria a data de ontem no HTML.
 */
export function useAgora(): Date {
  const [agora, setAgora] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setAgora(new Date()), INTERVALO_MS)
    return () => clearInterval(id)
  }, [])

  return agora
}
