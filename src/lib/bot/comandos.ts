// Comandos de operação que chegam pela própria conversa do WhatsApp. Hoje há um
// só: `!reset`, que devolve um telefone ao estado de quem nunca escreveu, para
// o roteiro poder ser testado de novo.
//
// Isto NÃO faz parte do roteiro de qualificação — `roteiro.ts` e `estado.ts`
// não sabem que existe. É ferramenta de teste, e o corte é de propósito: um dia
// o comando sai e o bot não muda.
import { telNorm11 } from '../phoneUtils'

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

/**
 * Quem pode resetar. `listaCrua` é a variável de ambiente, telefones separados
 * por vírgula em qualquer forma.
 *
 * **Lista vazia desliga o comando, e esse é o padrão.** `!reset` apaga dado de
 * produção sem confirmação, e é disparado por quem manda mensagem — o número da
 * Artha vai ser público e a base vai ter gente de verdade. Só telefone nomeado
 * à mão apaga alguma coisa.
 *
 * Os dois lados passam por `telNorm11` porque o wa_id da Meta (`5534988861441`)
 * e o canônico da base (`34988861441`) são a mesma pessoa escrita diferente.
 */
export function podeResetar(telefone: string | null, listaCrua: string): boolean {
  const alvo = telNorm11(telefone)
  if (!alvo) return false
  return listaCrua
    .split(',')
    .some((bruto) => telNorm11(bruto.trim()) === alvo)
}
