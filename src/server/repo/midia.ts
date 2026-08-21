// src/server/repo/midia.ts
// A URL que a Meta devolve expira em ~5 min e exige o header Authorization —
// servir direto ao browser não funciona nunca, nem dentro dos 5 min, porque o
// browser não manda o token. Baixamos uma vez e guardamos. Spec §6.4.
import 'server-only'
import { baixarMidia, urlDaMidia } from '../meta/client'
import { db } from '../supabase'

const BUCKET = 'midia'

/** Baixa da Meta e guarda. Devolve o caminho no Storage, ou null se falhar. */
export async function arquivarMidia(
  mediaId: string,
  mime: string | null
): Promise<string | null> {
  try {
    const url = await urlDaMidia(mediaId)
    const bytes = await baixarMidia(url)
    // `image/jpeg; codecs=…` existe: corta o parâmetro antes de virar extensão.
    const extensao = (mime?.split('/')[1] ?? 'bin').split(';')[0]
    const caminho = `${mediaId}.${extensao}`

    const { error } = await db().storage
      .from(BUCKET)
      .upload(caminho, bytes, { contentType: mime ?? 'application/octet-stream', upsert: true })
    if (error) {
      console.error('[midia] falha ao subir para o Storage', mediaId, error.message)
      return null
    }

    await db().from('messages').update({ media_storage_path: caminho }).eq('media_id', mediaId)
    return caminho
  } catch (e) {
    // Não relança DE PROPÓSITO: mídia perdida não pode derrubar o webhook. A
    // mensagem já está gravada, só o anexo falta — melhor um anexo quebrado que
    // uma conversa perdida. O console.error é o que impede a falha de sumir em
    // silêncio: sem ele, um token expirado ficaria invisível para sempre.
    console.error('[midia] falha ao arquivar', mediaId, e)
    return null
  }
}

/** URL assinada, válida por uma hora. É o que a tela usa no <img>. */
export async function urlAssinada(caminho: string): Promise<string | null> {
  // Bucket PRIVADO: `getPublicUrl` devolveria uma URL que dá 400. Só assinada.
  const { data } = await db().storage.from(BUCKET).createSignedUrl(caminho, 3_600)
  return data?.signedUrl ?? null
}
