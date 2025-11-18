"use client"

import type React from "react"

import { useState, useEffect, useMemo, useCallback } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useAuth } from "@/components/auth-provider"
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

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth()
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)

  // Definir la interfaz para los elementos del menú
  interface NavigationItem {
    name: string
    href: string
    icon: React.ElementType
    disabled?: boolean
  }

  // Menú simplificado sin permisos - todas las opciones visibles
  const navigation: NavigationItem[] = useMemo(() => [
    { 
      name: "Dashboard", 
      href: "/dashboard", 
      icon: LayoutDashboard
    },
    { 
      name: "Empresas", 
      href: "/companies", 
      icon: Building2
    },
    { 
      name: "Proyectos", 
      href: "/projects", 
      icon: FolderKanban
    },
    { 
      name: "Encuestas", 
      href: "/surveys", 
      icon: FileText
    },
    { 
      name: "Encuestadores", 
      href: "/surveyors", 
      icon: Users
    },
    { 
      name: "Usuarios", 
      href: "/users", 
      icon: Users,
    
    },
    { 
      name: "Zonas", 
      href: "/zones", 
      icon: MapPin
    },
    { 
      name: "Reportes", 
      href: "/reports", 
      icon: BarChart3
    },
    { 
      name: "Mensajes", 
      href: "/messages", 
      icon: MessageSquare
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

  // Prefetch de rutas comunes para mejorar la navegación
  useEffect(() => {
    // Prefetch de rutas principales
    router.prefetch('/dashboard')
    router.prefetch('/projects')
    router.prefetch('/surveys')
    router.prefetch('/companies')
    router.prefetch('/users')
    router.prefetch('/zones')
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
      <div className="flex-1 md:ml-64 lg:ml-72 flex flex-col">
        {/* Top bar */}
        <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Removido SheetTrigger de aquí ya que está dentro de Sheet */}
            <SyncStatus />
          </div>
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-auto bg-gray-50">
          {children}
        </main>
      </div>
    </div>
  )
}
