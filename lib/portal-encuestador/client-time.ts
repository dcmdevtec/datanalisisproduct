// Convierte un instante medido con el reloj del teléfono a hora del servidor.
//
// El portal manda el instante (`clientInstant`, ms) junto con su hora actual
// al enviar (`clientNow`, ms); la diferencia con la hora del servidor es el
// desfase del reloj del teléfono, y se corrige. Así un audio registrado
// tarde (sin señal) conserva su hora real de grabación, y un reloj de
// teléfono adelantado o atrasado no desordena los audios respecto a las
// respuestas (cuya hora pone el servidor). Si los datos no son válidos o
// el resultado es absurdo, se usa la hora del servidor.
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000
const MAX_FUTURE_MS = 5 * 60 * 1000

export function resolveClientInstant(clientInstant: unknown, clientNow: unknown): string {
  const serverNow = Date.now()
  if (typeof clientInstant !== "number" || typeof clientNow !== "number" || !isFinite(clientInstant) || !isFinite(clientNow)) {
    return new Date(serverNow).toISOString()
  }
  const corrected = clientInstant + (serverNow - clientNow)
  if (corrected > serverNow + MAX_FUTURE_MS || corrected < serverNow - MAX_AGE_MS) {
    return new Date(serverNow).toISOString()
  }
  return new Date(corrected).toISOString()
}
