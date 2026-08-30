"use client"

import type React from "react"

import { useState, useEffect, useMemo, useCallback } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useAuth } from "@/components/auth-provider"
import supabase from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import {
  BarChart3,
  Building2,
  FileText,
  FolderKanban,
  Globe,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  MessageSquare,
  Settings,
  Users,
} from "lucide-react"
import SyncStatus from "@/components/sync-status"
import { Logo } from "@/components/ui/logo"
import { useMyPermissions } from "@/hooks/use-permissions"
import type { ModuleKey } from "@/lib/permissions"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth()
  const { can, loading: permissionsLoading } = useMyPermissions()
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)

  // Definir la interfaz para los elementos del menú
  interface NavigationItem {
    name: string
    href: string
    icon: React.ElementType
    disabled?: boolean
    // Módulo del catálogo de lib/permissions.ts que gatea este ítem. Sin
    // `module` = siempre visible (Configuración/Control de Versiones no
    // tienen modelo de permisos propio todavía).
    module?: ModuleKey
  }

  // AUDITORÍA 2026-08-30: hasta ahora este menú mostraba TODO a cualquiera
  // ("Menú simplificado sin permisos"), y era el hueco #1 de la auditoría de
  // permisos — ahora filtra por el permiso EFECTIVO del usuario (default de
  // su rol + override puntual, ver lib/permissions.ts). Esto es solo UX: el
  // control real sigue en cada ruta /api/** (requirePermission/requireRole)
  // y en RLS — ocultar un ítem acá no reemplaza esa protección.
  const allNavigation: NavigationItem[] = useMemo(() => [
    {
      name: "Dashboard",
      href: "/dashboard",
      icon: LayoutDashboard,
      module: "dashboard",
    },
    {
      name: "Empresas",
      href: "/companies",
      icon: Building2,
      module: "companies",
    },
    {
      name: "Proyectos",
      href: "/projects",
      icon: FolderKanban,
      module: "projects",
    },
    {
      name: "Encuestas",
      href: "/surveys",
      icon: FileText,
      module: "surveys",
    },
    {
      name: "Encuestadores",
      href: "/surveyors",
      icon: Users,
      module: "surveyors",
    },

    {
      name: "Usuarios",
      href: "/users",
      icon: Users,
      module: "users",
    },
    {
      name: "Zonas",
      href: "/zones",
      icon: MapPin,
      module: "zones",
    },
    {
      name: "Reportes",
      href: "/reports",
      icon: BarChart3,
      module: "reports",
    },
    {
      name: "Mensajes",
      href: "/messages",
      icon: MessageSquare,
      module: "messages",
    },
    {
      name: "Configuración",
      href: "/settings",
      icon: Settings,
      disabled: true
    },
    {
      name: "Control de Versiones",
      href: "/control",
      icon: Settings,
      disabled: false
    },
  ], [])

  // Mientras se resuelve el permiso (permissionsLoading) se muestra todo —
  // evita el parpadeo de "sidebar vacío" al cargar; la protección real está
  // en el servidor, así que mostrar un ítem de más por un instante no es un
  // problema de seguridad, solo de UX.
  const navigation = useMemo(
    () => allNavigation.filter((item) => !item.module || permissionsLoading || can(item.module, "view")),
    [allNavigation, permissionsLoading, can],
  )

  // Prefetch de rutas comunes para mejorar la navegación
  useEffect(() => {
    // Prefetch de rutas principales
    router.prefetch('/dashboard')
    router.prefetch('/projects')
    router.prefetch('/surveys')
    router.prefetch('/companies')
    router.prefetch('/users')
    router.prefetch('/zones')
    router.prefetch('/tracking')
    router.prefetch('/control')
  }, [router])

  // Memoizar la función de logout para evitar recreaciones
  const handleLogout = useCallback(async () => {
    try {
      await signOut()
    } catch (error) {
      console.error('Error al cerrar sesión:', error)
    }
  }, [signOut])

  // Memoizar la función de toggle del sidebar móvil
  const toggleSidebar = useCallback(() => {
    setOpen(prev => !prev)
  }, [])

  // Guardia de rol: el sidebar ya filtra por permiso (ver `navigation`
  // arriba), pero eso no le sirve de nada a un encuestador — su superficie
  // es /portal-encuestador, no este layout en absoluto. Si de todos modos
  // aterriza acá (link viejo, cambio de rol, o el bug ya corregido en POST
  // /api/surveyors donde encuestadores creados sin fila en public.users
  // terminaban aquí por defecto), lo sacamos apenas se detecta. Defensa en
  // profundidad, no reemplaza corregir el origen.
  useEffect(() => {
    if (!user) return
    let cancelled = false
    ;(async () => {
      const { data } = await supabase.from("users").select("role").eq("id", user.id).single()
      if (cancelled) return
      if ((data as any)?.role === "surveyor") {
        router.push("/portal-encuestador")
      }
    })()
    return () => { cancelled = true }
  }, [user, router])

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar for desktop */}
      <div className="hidden md:flex md:w-64 lg:w-72 md:flex-col md:fixed md:inset-y-0 z-10">
        <div className="flex flex-col flex-grow border-r bg-white pt-5">
          <div className="flex items-center gap-3 px-4 pb-5 border-b border-[#18b0a4]/30">
            <Logo size="lg" showText={false} />
            <div className="flex-1">
              <h1 className="text-lg font-semibold text-gray-900">Datanalisis</h1>
           
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-2">
            {navigation.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
              return (
                <Link
                  key={item.name}
                  href={item.disabled ? "#" : item.href}
                  onClick={item.disabled ? (e) => e.preventDefault() : undefined}
                  className={`flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    item.disabled
                      ? "text-gray-400 cursor-not-allowed opacity-50"
                      : isActive
                      ? "bg-[#18b0a4] text-white shadow-sm"
                      : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                  }`}
                >
                  <item.icon className={`h-5 w-5 ${item.disabled ? "opacity-50" : ""}`} />
                  {item.name}
                  {item.disabled && (
                    <span className="text-xs text-gray-400 ml-auto">
                      {item.name === "Configuración" ? "(No permitido)" : "(Próximamente)"}
                    </span>
                  )}
                </Link>
              )
            })}
          </nav>

          {/* User section */}
          <div className="border-t border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
                <span className="text-sm font-medium text-gray-700">
                  {user?.email?.charAt(0).toUpperCase() || "U"}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {user?.email || "Usuario"}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="text-gray-500 hover:text-gray-700"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile sidebar */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-80 p-0">
          <div className="flex flex-col h-full">
            <div className="flex items-center gap-3 px-4 py-5 border-b border-[#18b0a4]/30">
              <Logo size="lg" showText={false} />
              <div className="flex-1">
                <h1 className="text-lg font-semibold text-gray-900">Datanalisis</h1>
             
              </div>
            </div>

            <nav className="flex-1 px-4 py-6 space-y-2">
              {navigation.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                return (
                  <Link
                    key={item.name}
                    href={item.disabled ? "#" : item.href}
                    onClick={item.disabled ? (e) => e.preventDefault() : toggleSidebar}
                    className={`flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                      item.disabled
                        ? "text-gray-400 cursor-not-allowed opacity-50"
                        : isActive
                        ? "bg-[#18b0a4] text-white shadow-sm"
                        : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                    }`}
                  >
                    <item.icon className={`h-5 w-5 ${item.disabled ? "opacity-50" : ""}`} />
                    {item.name}
                    {item.disabled && (
                      <span className="text-xs text-gray-400 ml-auto">
                        {item.name === "Configuración" ? "(No permitido)" : "(Próximamente)"}
                      </span>
                    )}
                  </Link>
                )
              })}
            </nav>

            <div className="border-t border-gray-200 p-4">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
                  <span className="text-sm font-medium text-gray-700">
                    {user?.email?.charAt(0).toUpperCase() || "U"}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {user?.email || "Usuario"}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLogout}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </SheetContent>
        
        {/* SheetTrigger debe estar dentro de Sheet */}
        <SheetTrigger asChild>
          <Button variant="ghost" size="sm" className="md:hidden">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
      </Sheet>

      {/* Main content */}
      {/* min-w-0 (feedback 2026-07-29): sin esto, un hijo flex-1 no se
          encoge por debajo del ancho intrínseco de su contenido — si una
          página adentro tiene algo ancho (p.ej. la tabla de Encuestas con 5
          botones de acción por fila), este wrapper crecía para acomodarlo
          en vez de dejar que el propio overflow-x-auto de esa tabla hiciera
          scroll interno. Como el contenedor raíz de arriba tiene
          overflow-hidden, el sobrante simplemente se recortaba sin scrollbar
          ni aviso — exactamente el "las cosas no cuadran" reportado. Afecta
          a TODAS las páginas envueltas por este layout, no solo una. */}
      <div className="flex-1 min-w-0 md:ml-64 lg:ml-72 flex flex-col">
        {/* Top bar */}
        <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Removido SheetTrigger de aquí ya que está dentro de Sheet */}
            <SyncStatus />
          </div>
        </div>

        {/* Page content */}
        <main className="flex-1 min-w-0 overflow-auto bg-gray-50">
          {children}
        </main>
      </div>
    </div>
  )
}
