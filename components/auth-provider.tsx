"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { useToast } from "@/components/ui/use-toast"
import type { Session } from "@supabase/supabase-js"
import type { Database } from "@/types/supabase"
import { supabase } from "@/lib/supabase-browser"

type SupabaseUserRow = Database["public"]["Tables"]["users"]["Row"]

type AuthContextType = {
  user: SupabaseUserRow | null
  session: Session | null
  loading: boolean
  error: string | null
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  register: (email: string, password: string, name: string, role: string) => Promise<void>
  refreshSession: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error("useAuth must be used within AuthProvider")
  return context
}

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SupabaseUserRow | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const { toast } = useToast()

  const getUserData = async (userId: string) => {
    const { data, error } = await supabase.from("users").select("*").eq("id", userId).single()
    if (error) throw error
    return data
  }

  const refreshSession = async () => {
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (userError || !userData?.user) throw userError || new Error("No user")

      const { data: sessionData } = await supabase.auth.getSession()
      setSession(sessionData.session)

      const dbUser = await getUserData(userData.user.id)
      setUser(dbUser)
    } catch {
      setUser(null)
      setSession(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refreshSession()

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        getUserData(session.user.id).then(setUser)
        setSession(session)
      } else {
        setUser(null)
        setSession(null)
      }
    })

    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [])

  const login = async (email: string, password: string) => {
    setLoading(true)
    setError(null)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error

      const userData = await getUserData(data.user.id)
      setUser(userData)
      setSession(data.session)

      router.push(
        userData.role === "admin" || userData.role === "supervisor"
          ? "/dashboard"
          : userData.role === "surveyor"
          ? "/surveys"
          : "/results"
      )

      toast({
        title: "Inicio de sesión exitoso",
        description: `Bienvenido, ${userData.name}`,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error al iniciar sesión"
      setError(message)
      toast({ title: "Error", description: message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const logout = async () => {
    setLoading(true)
    try {
      await supabase.auth.signOut()
      setUser(null)
      setSession(null)
      router.push("/login")
      toast({ title: "Sesión cerrada correctamente" })
    } catch (error) {
      toast({
        title: "Error al cerrar sesión",
        description: error instanceof Error ? error.message : "Error desconocido",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const register = async (email: string, password: string, name: string, role: string) => {
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) throw error

      await supabase.from("users").insert({
        id: data.user.id,
        email,
        name,
        role,
        status: "active",
      })

      toast({
        title: "Registro exitoso",
        description: "Ya puedes iniciar sesión.",
      })
      router.push("/login")
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error desconocido"
      toast({ title: "Error de registro", description: message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthContext.Provider
      value={{ user, session, loading, error, login, logout, register, refreshSession }}
    >
      {children}
    </AuthContext.Provider>
  )
}
