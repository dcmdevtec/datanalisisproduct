import { spawn } from "child_process"
import { mkdtemp, writeFile, readFile, rm } from "fs/promises"
import { tmpdir } from "os"
import { join } from "path"

// Fusiona varios clips de audio (en orden) en un solo archivo, usando el
// binario `ffmpeg` del sistema (ver Dockerfile — instalado vía `apk add
// ffmpeg` en el runner, mismo criterio que Chromium para el PDF).
//
// Pedido 2026-08-31: el ZIP de descarga masiva de audios
// (app/api/surveys/[id]/audios/zip) traía un archivo separado por cada
// segmento — el de "antes de la encuesta" (fondo del turno) y el de la
// encuesta en sí quedaban sueltos. Se pidió un solo archivo por encuestado.
//
// Se usa el filtro `concat` de ffmpeg (no el demuxer `-f concat -c copy`)
// a propósito: los segmentos "antes" y "durante" salen normalmente del
// mismo MediaRecorder del navegador (mismo códec), pero pueden no serlo
// siempre — grabaciones viejas en .amr, o un segmento que cambió de
// formato entre uno y otro. El filtro `concat` decodifica cada entrada
// primero y RECODIFICA una sola vez al final, así que funciona sin
// importar si los formatos de entrada son distintos entre sí. El costo es
// una recodificación (más CPU/tiempo que un copy directo), aceptable acá
// porque esto corre en un contenedor de larga duración, no en una función
// serverless con límite de tiempo estricto.
//
// Devuelve null (nunca lanza) si ffmpeg no está disponible o falla — el
// llamador debe caer con gracia a incluir los clips por separado en vez de
// romper toda la descarga por un solo archivo problemático.
export async function mergeAudioSegments(
  segments: { buffer: Buffer; ext: string }[],
): Promise<Buffer | null> {
  if (segments.length === 0) return null
  if (segments.length === 1) return segments[0].buffer // nada que fusionar

  let dir: string | null = null
  try {
    dir = await mkdtemp(join(tmpdir(), "audio-merge-"))
    const inputPaths: string[] = []
    for (let i = 0; i < segments.length; i++) {
      const p = join(dir, `in_${i}.${segments[i].ext || "webm"}`)
      await writeFile(p, segments[i].buffer)
      inputPaths.push(p)
    }
    const outputPath = join(dir, "out.webm")

    const filterInputs = inputPaths.map((_, i) => `[${i}:a:0]`).join("")
    const filterComplex = `${filterInputs}concat=n=${inputPaths.length}:v=0:a=1[out]`

    const args: string[] = []
    for (const p of inputPaths) args.push("-i", p)
    args.push(
      "-filter_complex", filterComplex,
      "-map", "[out]",
      "-c:a", "libopus",
      "-b:a", "64k",
      "-y", outputPath,
    )

    await new Promise<void>((resolve, reject) => {
      const proc = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] })
      let stderr = ""
      proc.stderr.on("data", (d) => { stderr += d.toString() })
      proc.on("error", reject) // ej. ffmpeg no instalado
      proc.on("close", (code) => {
        if (code === 0) resolve()
        else reject(new Error(`ffmpeg salió con código ${code}: ${stderr.slice(-500)}`))
      })
    })

    return await readFile(outputPath)
  } catch (err) {
    console.error("[audio-merge] no se pudo fusionar, se deja como clips separados:", err)
    return null
  } finally {
    if (dir) {
      try { await rm(dir, { recursive: true, force: true }) } catch { /* best effort */ }
    }
  }
}
