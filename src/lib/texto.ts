// Normalização de texto para busca. Módulo puro, sem dependência.
//
// Mora aqui, e não em `src/mock/db.ts`, porque o servidor precisa dela e
// importar de `db.ts` executaria a construção dos 760 leads fictícios no load.
// A função `sem_acento(text)` do Postgres espelha esta — as duas precisam
// concordar, senão a busca da tabela de Leads passa a achar coisa diferente
// dependendo de quem pergunta.

/** Minúscula e sem diacrítico: "José" e "jose" viram a mesma coisa. */
export function semAcento(texto: string): string {
  let out = ''
  for (const c of texto.toLowerCase().normalize('NFD')) {
    const cod = c.charCodeAt(0)
    if (cod < 0x0300 || cod > 0x036f) out += c
  }
  return out
}
