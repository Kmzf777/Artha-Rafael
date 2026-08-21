// Esvazia o Storage do Supabase pela API oficial.
//
// Existe porque o SQL não dá conta: o Supabase instala um trigger
// `storage.protect_delete()` que recusa DELETE direto em `storage.objects` e
// `storage.buckets`, justamente para não deixar arquivo órfão no bucket de
// armazenamento quando alguém apaga só a linha do banco. A remoção tem de
// passar pela Storage API, que apaga o objeto e a linha juntos.
//
// ⚠️ DESTRUTIVO. Apaga TODOS os buckets do projeto, não só o `midia`.
//
// Rodar: RESET_CONFIRMO=sim npm run reset:storage
import './env'
import { createClient } from '@supabase/supabase-js'

if (process.env.RESET_CONFIRMO !== 'sim') {
  console.error(
    [
      '',
      'Recusando rodar sem confirmação explícita.',
      '',
      'Este script apaga TODOS os buckets e arquivos do projeto Supabase.',
      'Não há undo.',
      '',
      `  Banco alvo: ${process.env.NEXT_PUBLIC_SUPABASE_URL || '(não configurado)'}`,
      '',
      'Se for mesmo um projeto de teste:  RESET_CONFIRMO=sim npm run reset:storage',
      '',
    ].join('\n')
  )
  process.exit(1)
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY precisam estar no .env.local.')
  process.exit(1)
}

const db = createClient(url, key, { auth: { persistSession: false } })

/** Remove os objetos de um prefixo, descendo nas pastas. */
async function esvaziarPrefixo(bucket: string, prefixo = ''): Promise<number> {
  const { data, error } = await db.storage.from(bucket).list(prefixo, { limit: 1000 })
  if (error) throw new Error(`list ${bucket}/${prefixo}: ${error.message}`)
  if (!data || data.length === 0) return 0

  // `list` devolve pastas como entradas sem `id`. Elas não são apagáveis
  // diretamente: é preciso descer e remover o que está dentro.
  const arquivos = data.filter((e) => e.id !== null).map((e) => (prefixo ? `${prefixo}/${e.name}` : e.name))
  const pastas = data.filter((e) => e.id === null)

  let apagados = 0
  if (arquivos.length > 0) {
    const { error: erroRemove } = await db.storage.from(bucket).remove(arquivos)
    if (erroRemove) throw new Error(`remove ${bucket}: ${erroRemove.message}`)
    apagados += arquivos.length
  }
  for (const pasta of pastas) {
    apagados += await esvaziarPrefixo(bucket, prefixo ? `${prefixo}/${pasta.name}` : pasta.name)
  }
  return apagados
}

async function main() {
  const { data: buckets, error } = await db.storage.listBuckets()
  if (error) throw new Error(`listBuckets: ${error.message}`)

  if (!buckets || buckets.length === 0) {
    console.log('Nenhum bucket no projeto. Storage já está limpo.')
    return
  }

  for (const bucket of buckets) {
    const apagados = await esvaziarPrefixo(bucket.name)
    // `emptyBucket` é redundante depois do remove recursivo, mas cobre o que a
    // paginação de `list` (limite de 1000) possa ter deixado para trás.
    await db.storage.emptyBucket(bucket.name)

    const { error: erroDelete } = await db.storage.deleteBucket(bucket.name)
    if (erroDelete) throw new Error(`deleteBucket ${bucket.name}: ${erroDelete.message}`)

    console.log(`bucket "${bucket.name}" removido (${apagados} arquivos)`)
  }

  const { data: restantes } = await db.storage.listBuckets()
  console.log(`buckets restantes: ${restantes?.length ?? 0}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
