// Configuración específica para Edge Runtime
export const edgeConfig = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
}

// Función para verificar si estamos en Edge Runtime
export const isEdgeRuntime = () => {
  return typeof EdgeRuntime !== 'undefined'
}

// Función para obtener headers compatibles con Edge Runtime
export const getEdgeHeaders = (request: Request) => {
  const headers = new Headers()
  
  // Copiar headers relevantes
  const relevantHeaders = ['authorization', 'cookie', 'user-agent', 'referer']
  relevantHeaders.forEach(header => {
    const value = request.headers.get(header)
    if (value) {
      headers.set(header, value)
    }
  })
  
  return headers
}
