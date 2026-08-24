// Comandos de operação que chegam pela própria conversa do WhatsApp. Hoje há um
// só: `!reset`, que devolve um telefone ao estado de quem nunca escreveu, para
// o roteiro poder ser testado de novo.
//
// Isto NÃO faz parte do roteiro de qualificação — `roteiro.ts` e `estado.ts`
// não sabem que existe. É ferramenta de teste, e o corte é de propósito: um dia
// o comando sai e o bot não muda.
export const COMANDO_RESET = '!reset'

/**
 * A mensagem é o comando, e nada mais.
 *
 * Exigir a mensagem inteira, em vez de aceitar `startsWith`, é o que impede um
 * lead de apagar o próprio histórico escrevendo "quero !reset da minha conta"
 * no meio de uma frase.
 */
export function ehComandoReset(texto: string | null): boolean {
  return texto !== null && texto.trim().toLowerCase() === COMANDO_RESET
}
