import type { Segmento } from '@/mock/types'

// Fonte única do rótulo de produto. O mapa nasceu duplicado em cinco telas e
// divergiu em quatro grafias — 'LucIA', 'IA operacional', 'Escritórios' — o que
// faria o mesmo lead aparecer como três produtos diferentes conforme a aba.
//
// 'LucIA' é o nome do produto que o cliente vende (lucia.arthafp.com.br), não o
// nome de uma persona de atendimento. A proibição de citar persona vale para copy
// de mensagem, onde há três nomes em disputa (Lúcia / Clara / LucIA) e a escolha é
// do cliente; rótulo de segmento é fato de catálogo.
export const ROTULO_SEGMENTO: Record<Segmento, string> = {
  artha: 'Artha',
  dhana: 'Dhana',
  lucia: 'LucIA',
}

// Público de cada produto, para telas que precisam explicar o segmento em vez de
// apenas nomeá-lo (relatórios, painel executivo).
export const PUBLICO_SEGMENTO: Record<Segmento, string> = {
  artha: 'B2C · pessoa física',
  dhana: 'B2B · planejadores',
  lucia: 'B2B · escritórios',
}

export const SEGMENTOS: readonly Segmento[] = ['artha', 'dhana', 'lucia'] as const
