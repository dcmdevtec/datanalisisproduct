"use client"

import Image from "next/image"

export default function TestLogoPage() {
  return (
    <div className="p-8 space-y-8">
      <h1 className="text-2xl font-bold">Prueba de Logo</h1>
      
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Logo con Image de Next.js:</h2>
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 rounded-full bg-[#18b0a4] flex items-center justify-center p-1">
            <Image 
              src="/logo.png" 
              alt="Logo Datanálisis" 
              width={24} 
              height={24} 
              className="object-contain"
              priority
            />
          </div>
          <span>Logo con fondo verde</span>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Logo sin fondo:</h2>
        <div className="flex items-center gap-4">
          <Image 
            src="/logo.png" 
            alt="Logo Datanálisis" 
            width={32} 
            height={32} 
            className="object-contain"
            priority
          />
          <span>Logo original</span>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Logo con img HTML:</h2>
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 rounded-full bg-[#18b0a4] flex items-center justify-center p-1">
            <img 
              src="/logo.png" 
              alt="Logo Datanálisis" 
              width={24} 
              height={24} 
              className="object-contain"
            />
          </div>
          <span>Logo con img HTML</span>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Verificación de archivos:</h2>
        <div className="text-sm space-y-2">
          <p>Archivo logo.png existe en /public/logo.png</p>
          <p>Tamaño: 46KB</p>
          <p>Ruta completa: /c/Users/arauj/OneDrive/Documents/datanalisisproduct/public/logo.png</p>
        </div>
      </div>
    </div>
  )
}
