"use client"

import type React from "react"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
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

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  // Menú simplificado sin permisos - todas las opciones visibles
  const navigation = [
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
      icon: Users
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
      icon: Settings
    },
  ]

  const handleLogout = async () => {
    try {
      await signOut()
    } catch (error) {
      console.error('Error al cerrar sesión:', error)
    }
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar for desktop */}
      <div className="hidden md:flex md:w-64 lg:w-72 md:flex-col md:fixed md:inset-y-0 z-10">
        <div className="flex flex-col flex-grow border-r bg-white pt-5">
          <div className="flex items-center gap-3 px-4 pb-5 border-b border-[#18b0a4]/30">
            <div className="h-10 w-10 flex items-center justify-center bg-[#18b0a4] rounded shadow-sm overflow-hidden">
              <img
                src="/logo-datanalisis.png"
                alt="Logo Datanálisis"
                className="h-8 w-8 object-contain"
                onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.parentElement!.innerHTML = '<span class=\'text-white font-bold text-lg\'>D</span>'; }}
                draggable={false}
              />
            </div>
            <span className="font-extrabold text-xl lg:text-2xl tracking-tight text-[#18b0a4]">Datanálisis</span>
          </div>
          <div className="flex-grow flex flex-col justify-between">
            <nav className="flex-1 px-2 py-4 space-y-1">
              {navigation.map((item) => {
                const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`
                      flex items-center px-3 py-3 text-sm font-semibold rounded-lg transition-colors
                      ${isActive
                        ? "bg-[#18b0a4] text-white shadow"
                        : "text-gray-700 hover:bg-[#18b0a4]/10 hover:text-[#18b0a4]"}
                    `}
                  >
                    <item.icon className={`mr-3 h-5 w-5 ${isActive ? 'text-white' : 'text-[#18b0a4]'}`} />
                    {item.name}
                  </Link>
                );
              })}
            </nav>
            <div className="p-4 border-t border-[#18b0a4]/30">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="h-8 w-8 rounded-full bg-[#18b0a4] flex items-center justify-center border border-[#18b0a4]">
                    <span className="text-white font-bold">{user?.email?.charAt(0).toUpperCase() || "U"}</span>
                  </div>
                </div>
                <div className="ml-3 overflow-hidden">
                  <p className="text-sm font-semibold text-[#18b0a4] truncate">{user?.email}</p>
                  <p className="text-xs text-gray-500 capitalize truncate">Usuario</p>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="ml-auto text-[#18b0a4] hover:bg-[#18b0a4]/10" 
                  onClick={handleLogout}
                >
                  <LogOut className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-10 bg-white border-b border-[#18b0a4]/30">
        <div className="flex items-center justify-between h-16 px-4">
          <div className="flex items-center gap-2">
            <Globe className="h-6 w-6 text-[#18b0a4]" />
            <span className="font-extrabold text-lg sm:text-xl tracking-tight text-[#18b0a4]">Datanálisis</span>
          </div>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="text-[#18b0a4]">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 sm:w-80 p-0 bg-white text-[#18b0a4]">
              <div className="flex flex-col h-full">
                <div className="flex items-center gap-2 p-4 border-b border-[#18b0a4]/30">
                  <Globe className="h-6 w-6 text-[#18b0a4]" />
                  <span className="font-extrabold text-lg sm:text-xl tracking-tight text-[#18b0a4]">Datanálisis</span>
                </div>
                <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
                  {navigation.map((item) => {
                    const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        className={`
                          flex items-center px-3 py-3 text-sm font-semibold rounded-lg transition-colors
                          ${isActive
                            ? "bg-[#18b0a4] text-white shadow"
                            : "text-[#18b0a4] hover:bg-[#18b0a4]/10 hover:text-[#18b0a4]"}
                        `}
                        onClick={() => setOpen(false)}
                      >
                        <item.icon className={`mr-3 h-5 w-5 ${isActive ? 'text-white' : 'text-[#18b0a4]'}`} />
                        {item.name}
                      </Link>
                    );
                  })}
                </nav>
                <div className="p-4 border-t border-[#18b0a4]/30">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="h-8 w-8 rounded-full bg-[#18b0a4] flex items-center justify-center border border-[#18b0a4]">
                        <span className="text-white font-bold">{user?.email?.charAt(0).toUpperCase() || "U"}</span>
                      </div>
                    </div>
                    <div className="ml-3 overflow-hidden">
                      <p className="text-sm font-semibold text-[#18b0a4] truncate">{user?.email}</p>
                      <p className="text-xs text-gray-500 capitalize truncate">Usuario</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="ml-auto text-[#18b0a4] hover:bg-[#18b0a4]/10"
                      onClick={() => {
                        setOpen(false)
                        handleLogout()
                      }}
                    >
                      <LogOut className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Main content */}
      <div className="md:pl-64 lg:pl-72 flex flex-col flex-1">
        <main className="flex-1 overflow-y-auto pt-16 md:pt-0 px-4 md:px-6">{children}</main>
      </div>

      {/* Sync status indicator */}
      <SyncStatus />
    </div>
  )
}
