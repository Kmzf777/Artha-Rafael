// Casos canônicos de normalização de telefone. Lidos por DOIS testes:
// `telNorm11.test.ts` (JS) e `tel_norm11.integration.test.ts` (Postgres — este
// pula enquanto não houver banco configurado).
// Divergência entre as duas implementações é falha de build — ver spec §2.1.

export type CasoTelefone = { entrada: string | null; esperado: string | null; porque: string }

export const CASOS_TELEFONE: CasoTelefone[] = [
  // Canário Vilssom: o wa_id da Meta vem sem o nono dígito.
  { entrada: '553791235196', esperado: '37991235196', porque: 'wa_id inbound sem 9º' },
  { entrada: '37991235196', esperado: '37991235196', porque: 'fila, 11 dígitos' },
  { entrada: '5537991235196', esperado: '37991235196', porque: 'DDI + 9º' },
  { entrada: '3791235196', esperado: '37991235196', porque: 'nacional sem 9º' },
  { entrada: '+55 (37) 99123-5196', esperado: '37991235196', porque: 'formatado' },

  // Canário 2026-08-20: enviamos 5534988861441, a Meta devolveu wa_id 553488861441.
  { entrada: '5534988861441', esperado: '34988861441', porque: 'número de teste, enviado' },
  { entrada: '553488861441', esperado: '34988861441', porque: 'wa_id devolvido pela Meta' },
  { entrada: '34988861441', esperado: '34988861441', porque: 'nacional com 9º' },

  // Fixo nunca ganha 9º dígito fabricado: criaria um celular inexistente.
  { entrada: '553432451234', esperado: null, porque: 'fixo com DDI' },
  { entrada: '3432451234', esperado: null, porque: 'fixo nacional' },

  // Não reconhecível.
  { entrada: '', esperado: null, porque: 'vazio' },
  { entrada: null, esperado: null, porque: 'nulo' },
  { entrada: '123', esperado: null, porque: 'curto demais' },
  { entrada: '12345678901234', esperado: null, porque: 'longo demais' },
]
