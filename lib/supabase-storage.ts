/**
 * Utilidades para trabajar con Supabase Storage
 * Maneja la subida, obtención y eliminación de archivos
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseKey)

/**
 * Tipos de bucket disponibles
 */
export type BucketName =
    | 'survey-images'
    | 'survey-logos'
    | 'project-logos'
    | 'company-logos'
    | 'zone-maps'
    | 'response-media'

/**
 * Sube un archivo (File o Blob) a Supabase Storage
 * @param bucket - Nombre del bucket
 * @param path - Ruta dentro del bucket (ej: "question_id/option_1.png")
 * @param file - Archivo a subir
 * @returns URL pública del archivo
 */
export async function uploadImage(
    bucket: BucketName,
    path: string,
    file: File | Blob
): Promise<string> {
    const { data, error } = await supabase.storage.from(bucket).upload(path, file, {
        upsert: true, // Sobrescribe si ya existe
        contentType: file.type,
    })

    if (error) {
        console.error('Error uploading to storage:', error)
        throw new Error(`Error subiendo archivo: ${error.message}`)
    }

    return getPublicUrl(bucket, data.path)
}

/**
 * Obtiene la URL pública de un archivo en un bucket público
 * @param bucket - Nombre del bucket
 * @param path - Ruta del archivo
 * @returns URL pública
 */
export function getPublicUrl(bucket: BucketName, path: string): string {
    const { data } = supabase.storage.from(bucket).getPublicUrl(path)
    return data.publicUrl
}

/**
 * Obtiene una URL firmada (temporal) para archivos en buckets privados
 * @param bucket - Nombre del bucket
 * @param path - Ruta del archivo
 * @param expiresIn - Tiempo de expiración en segundos (default: 1 hora)
 * @returns URL firmada con expiración
 */
export async function getSignedUrl(
    bucket: BucketName,
    path: string,
    expiresIn: number = 3600
): Promise<string> {
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn)

    if (error) {
        throw new Error(`Error generando URL firmada: ${error.message}`)
    }

    return data.signedUrl
}

/**
 * Elimina un archivo de Storage
 * @param bucket - Nombre del bucket
 * @param path - Ruta del archivo
 */
export async function deleteImage(bucket: BucketName, path: string): Promise<void> {
    const { error } = await supabase.storage.from(bucket).remove([path])

    if (error) {
        throw new Error(`Error eliminando archivo: ${error.message}`)
    }
}

/**
 * Convierte una cadena base64 a Blob
 * @param base64 - Cadena base64 (puede incluir el prefijo data:image/...)
 * @returns Blob del archivo
 */
export function base64ToBlob(base64: string): Blob {
    // Remover el prefijo data:image/...;base64, si existe
    const base64Data = base64.includes(',') ? base64.split(',')[1] : base64

    // Detectar el tipo MIME
    let mimeType = 'image/png' // Default
    if (base64.includes('data:')) {
        const mimeMatch = base64.match(/data:([^;]+);/)
        if (mimeMatch) {
            mimeType = mimeMatch[1]
        }
    }

    // Convertir base64 a binary
    const byteCharacters = atob(base64Data)
    const byteNumbers = new Array(byteCharacters.length)

    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i)
    }

    const byteArray = new Uint8Array(byteNumbers)
    return new Blob([byteArray], { type: mimeType })
}

/**
 * Migra una imagen base64 a Supabase Storage
 * @param bucket - Nombre del bucket
 * @param path - Ruta destino en el bucket
 * @param base64 - Cadena base64 de la imagen
 * @returns URL pública de la imagen en Storage
 */
export async function migrateBase64ToStorage(
    bucket: BucketName,
    path: string,
    base64: string
): Promise<string> {
    const blob = base64ToBlob(base64)
    return uploadImage(bucket, path, blob)
}

/**
 * Verifica si una cadena es una URL de base64
 * @param str - Cadena a verificar
 * @returns true si es base64, false si es URL
 */
export function isBase64(str: string): boolean {
    return str.startsWith('data:image/') || str.startsWith('data:audio/') || str.startsWith('data:video/')
}

/**
 * Verifica si una cadena es una URL de Supabase Storage
 * @param str - Cadena a verificar
 * @returns true si es URL de storage
 */
export function isStorageUrl(str: string): boolean {
    return str.includes('.supabase.co/storage/v1/object/')
}

/**
 * Genera un nombre de archivo único
 * @param prefix - Prefijo para el nombre (ej: "question_id")
 * @param extension - Extensión del archivo (ej: "png")
 * @returns Nombre único con timestamp
 */
export function generateUniqueFileName(prefix: string, extension: string): string {
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(7)
    return `${prefix}_${timestamp}_${random}.${extension}`
}

/**
 * Extrae la extensión de un tipo MIME
 * @param mimeType - Tipo MIME (ej: "image/jpeg")
 * @returns Extensión (ej: "jpg")
 */
export function getExtensionFromMimeType(mimeType: string): string {
    const map: Record<string, string> = {
        'image/jpeg': 'jpg',
        'image/jpg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp',
        'image/gif': 'gif',
        'audio/mpeg': 'mp3',
        'audio/wav': 'wav',
        'video/mp4': 'mp4',
    }
    return map[mimeType] || 'bin'
}

/**
 * Redimensiona una imagen manteniendo la proporción
 * @param file - Archivo de imagen
 * @param maxWidth - Ancho máximo
 * @param maxHeight - Alto máximo
 * @returns Blob de la imagen redimensionada
 */
export async function resizeImage(
    file: File | Blob,
    maxWidth: number = 1920,
    maxHeight: number = 1080
): Promise<Blob> {
    return new Promise((resolve, reject) => {
        const img = new Image()
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')

        if (!ctx) {
            reject(new Error('No se pudo obtener contexto del canvas'))
            return
        }

        img.onload = () => {
            let { width, height } = img

            // Calcular nuevas dimensiones manteniendo proporción
            if (width > maxWidth) {
                height = (height * maxWidth) / width
                width = maxWidth
            }

            if (height > maxHeight) {
                width = (width * maxHeight) / height
                height = maxHeight
            }

            canvas.width = width
            canvas.height = height
            ctx.drawImage(img, 0, 0, width, height)

            canvas.toBlob(
                (blob) => {
                    if (blob) {
                        resolve(blob)
                    } else {
                        reject(new Error('Error al convertir canvas a blob'))
                    }
                },
                'image/jpeg',
                0.9
            )
        }

        img.onerror = () => reject(new Error('Error cargando imagen'))
        img.src = URL.createObjectURL(file)
    })
}
