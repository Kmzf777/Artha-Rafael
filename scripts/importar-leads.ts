// Importa a base de leads de um CSV para a tabela `leads`.
//
// Rodar: IMPORT_CONFIRMO=sim npx tsx scripts/importar-leads.ts leads-rtv.csv
//
// O CSV é `nome,email,telefone` com cabeçalho. Telefone em qualquer formato —
// `telNorm11` resolve o nono dígito ausente, que é como a base do cliente veio.
//
// NÃO SILENCIA RECUSA. `telNorm11` devolve null para número que não é celular
// brasileiro reconhecível, e o lote de 2026-09-09 tem um (`551134980291`, cujo
// assinante começa em 3). Sumir com ele faria o disparo parecer completo com
// um lead a menos. Ele é impresso por nome no final.
import './env'
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { telNorm11, toBrazilPhone } from '../src/lib/phoneUtils'

const caminho = process.argv[2]

if (process.env.IMPORT_CONFIRMO !== 'sim') {
  console.error(
    [
      '',
      'Recusando rodar sem confirmação explícita.',
      '',
      'Este script escreve leads REAIS na tabela `leads` do projeto Supabase.',
      '',
      `  Banco alvo: ${process.env.NEXT_PUBLIC_SUPABASE_URL || '(não configurado)'}`,
      `  Arquivo:    ${caminho || '(não informado)'}`,
      '',
      'Se for o banco certo:  IMPORT_CONFIRMO=sim npx tsx scripts/importar-leads.ts <arquivo.csv>',
      '',
    ].join('\n')
  )
  process.exit(1)
}

if (!caminho) {
  console.error('Faltou o caminho do CSV.')
  process.exit(1)
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const chave = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !chave) {
  console.error('NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórias.')
  process.exit(1)
}

type Linha = { nome: string; email: string; telefone: string }

/** Parser mínimo. O arquivo é gerado por nós e não tem vírgula dentro de campo. */
function lerCsv(texto: string): Linha[] {
  const linhas = texto.split(/\r?\n/).filter((l) => l.trim() !== '')
  return linhas.slice(1).map((l) => {
    const [nome = '', email = '', telefone = ''] = l.split(',')
    return { nome: nome.trim(), email: email.trim(), telefone: telefone.trim() }
  })
}

async function main(): Promise<void> {
  const db = createClient(url!, chave!, { auth: { persistSession: false } })
  const linhas = lerCsv(readFileSync(caminho!, 'utf8'))

  // `telNorm11` aqui é PORTEIRO, não conversor: o valor canônico não é gravado
  // por nós. `tel_norm` é coluna gerada no Postgres, por uma função que espelha
  // esta — gravar o nosso lado aqui seria a terceira cópia da mesma regra.
  const aceitos: Linha[] = []
  const recusados: Linha[] = []

  for (const linha of linhas) {
    if (telNorm11(linha.telefone) === null) recusados.push(linha)
    else aceitos.push(linha)
  }

  // `tel_norm` é coluna gerada, com índice único (`leads_tel_norm_uk`). O
  // upsert conflita por ela, então reimportar o mesmo arquivo não duplica.
  const registros = aceitos.map((linha) => ({
    nome: linha.nome,
    // Guarda com DDI, a forma que a Meta entrega. `tel_norm` deriva sozinha.
    telefone: toBrazilPhone(linha.telefone),
    email: linha.email || null,
    segmento: 'artha',
    stage: 'novo',
    plano_status: 'trial_expirado',
    ultimo_acesso_em: null,
    ficticio: false,
  }))

  const { data, error } = await db
    .from('leads')
    .upsert(registros, { onConflict: 'tel_norm', ignoreDuplicates: false })
    .select('id')

  if (error) {
    console.error(`Falhou: ${error.message}`)
    process.exit(1)
  }

  console.log('')
  console.log(`Linhas no arquivo:  ${linhas.length}`)
  console.log(`Gravados:           ${data?.length ?? 0}`)
  console.log(`Recusados:          ${recusados.length}`)

  if (recusados.length > 0) {
    console.log('')
    console.log('NÃO ENTRARAM — telNorm11 não reconheceu como celular brasileiro:')
    for (const r of recusados) console.log(`  ${r.telefone}  ${r.nome}`)
    console.log('')
    console.log('Trate à mão ou confirme o número com o cliente. Não some com eles.')
  }
  console.log('')
}

void main()
