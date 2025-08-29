import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight, BarChart3, Globe, Users } from "lucide-react"
import { Logo } from "@/components/ui/logo"

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      <header className="border-b">
        <div className="max-w-screen-xl mx-auto px-4 flex h-16 items-center justify-between">
          <Logo size="md" />
          <nav className="hidden md:flex gap-6">
            <Link href="#features" className="text-sm font-medium hover:underline">
              Características
            </Link>
            <Link href="#pricing" className="text-sm font-medium hover:underline">
              Precios
            </Link>
            <Link href="#about" className="text-sm font-medium hover:underline">
              Acerca de
            </Link>
          </nav>
          <div className="flex items-center gap-4">
            <Link href="/login">
              <Button variant="outline">Iniciar Sesión</Button>
            </Link>
            <Link href="/register">
              <Button>Registrarse</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="py-20 md:py-32">
          <div className="max-w-screen-xl mx-auto px-4 flex flex-col items-center justify-center text-center">
            {/* <CHANGE> Traduciendo título principal */}
            <h1 className="text-4xl md:text-6xl font-bold tracking-tighter mb-6">
              Recolecta Datos en Cualquier Lugar, Analiza en Todas Partes
            </h1>
            {/* <CHANGE> Traduciendo descripción */}
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mb-8">
              Una plataforma integral de encuestas con capacidades en línea y sin conexión, monitoreo en tiempo real y
              análisis potentes.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/register">
                <Button size="lg" className="gap-2">
                  Comenzar <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
             
            </div>
          </div>
        </section>

        <section id="features" className="py-20 bg-muted/50">
          <div className="max-w-screen-xl mx-auto px-4">
            {/* <CHANGE> Traduciendo título de características */}
            <h2 className="text-3xl font-bold tracking-tighter mb-12 text-center">Características Principales</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">
              <div className="bg-background p-6 rounded-lg shadow-sm">
                <div className="mb-4 p-3 rounded-full bg-primary/10 w-fit">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                {/* <CHANGE> Traduciendo características */}
                <h3 className="text-xl font-bold mb-2">Acceso Basado en Roles</h3>
                <p className="text-muted-foreground">
                  Diferentes roles para administradores, supervisores, encuestadores y clientes con permisos
                  personalizados.
                </p>
              </div>
              <div className="bg-background p-6 rounded-lg shadow-sm">
                <div className="mb-4 p-3 rounded-full bg-primary/10 w-fit">
                  <Globe className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-2">Capacidades Sin Conexión</h3>
                <p className="text-muted-foreground">
                  Recolecta datos sin conexión a internet y sincroniza automáticamente cuando vuelvas a estar en línea.
                </p>
              </div>
              <div className="bg-background p-6 rounded-lg shadow-sm">
                <div className="mb-4 p-3 rounded-full bg-primary/10 w-fit">
                  <BarChart3 className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-2">Análisis Avanzados</h3>
                <p className="text-muted-foreground">
                  Genera reportes con visualizaciones interactivas y exporta a múltiples formatos.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t py-6">
        <div className="max-w-screen-xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          {/* <CHANGE> Traduciendo footer */}
          <p className="text-sm text-muted-foreground">© 2024 Datanálisis. Todos los derechos reservados.</p>
          <div className="flex gap-4">
            <Link href="/terms" className="text-sm text-muted-foreground hover:underline">
              Términos
            </Link>
            <Link href="/privacy" className="text-sm text-muted-foreground hover:underline">
              Privacidad
            </Link>
            <Link href="/contact" className="text-sm text-muted-foreground hover:underline">
              Contacto
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
