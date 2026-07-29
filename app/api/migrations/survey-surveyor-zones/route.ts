import { NextResponse } from "next/server"

// SEGURIDAD (auditoría 2026-07-29): esta ruta ejecutaba SQL/DDL arbitrario
// contra la base de datos con la llave de service-role, sin ningún check de
// autenticación — cualquiera con la URL podía usarla. Es un script de
// desarrollo que nunca debió quedar accesible en producción.
//
// No se pudo eliminar el archivo físicamente desde este entorno (el
// filesystem montado no permite operaciones unlink), así que se neutralizó
// aquí: no expone ningún handler funcional. Si ya no se necesita, bórralo
// manualmente desde tu computador.
export async function POST() {
  return NextResponse.json({ error: "Endpoint deshabilitado" }, { status: 410 })
}
