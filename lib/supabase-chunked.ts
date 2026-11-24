// PostgREST manda los filtros .in() dentro de la URL. Contra el Supabase de
// producción, a partir de ~250 UUIDs la URL pasa de ~8 KB y el servidor
// responde 414 (URI Too Long) — verificado el 24/11/2026. Cualquier consulta
// que filtre por "todas las respuestas de una encuesta" fallaba en cuanto la
// encuesta superaba ese tamaño. Esto parte la lista en lotes y concatena los
// resultados; el orden entre lotes no se conserva, así que quien lo necesite
// debe ordenar después.
export const IN_CHUNK_SIZE = 100

export async function selectInChunks<T = any>(
  ids: (string | null | undefined)[],
  run: (chunk: string[]) => PromiseLike<{ data: T[] | null; error: any }>,
  size: number = IN_CHUNK_SIZE
): Promise<{ data: T[]; error: any }> {
  const unique = Array.from(new Set(ids.filter((id): id is string => !!id)))
  const out: T[] = []
  for (let i = 0; i < unique.length; i += size) {
    const { data, error } = await run(unique.slice(i, i + size))
    if (error) return { data: out, error }
    if (data) out.push(...data)
  }
  return { data: out, error: null }
}
