"use client"

// Módulo de mensajes dentro del portal del encuestador (CLAUDE.md:
// "necesito que el modulo de mensaje funcione ... en el modulo de
// encuestador"). Antes no existía ningún acceso a mensajería desde
// /portal-encuestador — el encuestador no tenía forma de contactar a su
// supervisor ni de ver los anuncios que el admin publica desde /messages.
//
// Reutiliza la misma API genérica /api/messages que usa el panel admin
// (las tablas solo usan sender_id/receiver_id como UUIDs de public.users),
// pero la lista de contactos NO sale de /api/users (esa devuelve TODOS los
// usuarios del sistema sin filtrar por rol) sino de
// /api/portal-encuestador/contacts, que solo expone al supervisor asignado
// y a los admins — un encuestador no debe poder escribirle a otros
// encuestadores ni ver la lista completa de usuarios.

import { useEffect, useState, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Card, CardContent } from "@/components/ui/card"
import { Logo } from "@/components/ui/logo"
import { Loader2, Send, ArrowLeft, MessageSquare } from "lucide-react"

type Message = {
  id: string
  sender: string
  receiver: string
  content: string
  timestamp: string
  read: boolean
  message_type?: string
}

type Contact = { id: string; name: string; email: string; role: string }

export default function PortalEncuestadorMensajesPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()

  const [contacts, setContacts] = useState<Contact[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedContact, setSelectedContact] = useState<string | null>(null)
  const [newMessage, setNewMessage] = useState("")
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!authLoading && !user) router.push("/login")
  }, [user, authLoading, router])

  const fetchMessages = useCallback(async () => {
    if (!user) return
    try {
      const res = await fetch(`/api/messages?userId=${user.id}&limit=200`)
      if (!res.ok) return
      const data = await res.json()
      if (Array.isArray(data)) setMessages(data)
    } catch {
      // silencioso — igual que el polling del panel admin
    }
  }, [user])

  useEffect(() => {
    if (!user) return
    ;(async () => {
      setLoading(true)
      try {
        const [contactsRes] = await Promise.all([
          fetch("/api/portal-encuestador/contacts"),
          fetchMessages(),
        ])
        if (contactsRes.ok) {
          const json = await contactsRes.json()
          setContacts(json.contacts || [])
        }
      } finally {
        setLoading(false)
      }
    })()
  }, [user, fetchMessages])

  // Polling cada 5s, igual que /messages (no hay Realtime configurado)
  useEffect(() => {
    if (!user) return
    const interval = setInterval(fetchMessages, 5000)
    return () => clearInterval(interval)
  }, [user, fetchMessages])

  // Marcar como leídos al abrir una conversación
  useEffect(() => {
    if (!selectedContact || !user) return
    const unreadIds = messages
      .filter((m) => m.sender === selectedContact && m.receiver === user.id && !m.read)
      .map((m) => m.id)
    if (unreadIds.length === 0) return
    setMessages((prev) => prev.map((m) => (unreadIds.includes(m.id) ? { ...m, read: true } : m)))
    fetch("/api/messages", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: unreadIds, read: true }),
    }).catch(() => {})
  }, [selectedContact, messages, user])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, selectedContact])

  const handleSend = async () => {
    if (!newMessage.trim() || !selectedContact || !user || sending) return
    setSending(true)
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sender: user.id, receiver: selectedContact, content: newMessage }),
      })
      if (res.ok) {
        const sent = await res.json()
        setMessages((prev) => [...prev, sent])
        setNewMessage("")
      }
    } finally {
      setSending(false)
    }
  }

  const getInitials = (name?: string | null) => {
    if (!name) return "?"
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().substring(0, 2)
  }

  const formatTime = (ts: string) =>
    new Intl.DateTimeFormat("es-CO", { hour: "2-digit", minute: "2-digit" }).format(new Date(ts))
  const formatDate = (ts: string) =>
    new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(ts))

  const conversationMessages = (contactId: string) =>
    messages
      .filter((m) => (m.sender === user?.id && m.receiver === contactId) || (m.sender === contactId && m.receiver === user?.id))
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

  const unreadFrom = (contactId: string) =>
    messages.filter((m) => m.sender === contactId && m.receiver === user?.id && !m.read).length

  const broadcasts = messages
    .filter((m) => m.receiver === "all")
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  const selectedContactData = contacts.find((c) => c.id === selectedContact) || null

  if (authLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col">
      <div className="bg-background border-b sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          {selectedContact ? (
            <Button variant="ghost" size="icon" onClick={() => setSelectedContact(null)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
          ) : (
            <Link href="/portal-encuestador">
              <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
            </Link>
          )}
          <Logo size="sm" showText={false} />
          <p className="text-sm font-semibold">
            {selectedContact ? selectedContactData?.name ?? "Conversación" : "Mensajes"}
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto w-full flex-1 flex flex-col">
        {selectedContact ? (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {conversationMessages(selectedContact).length === 0 && (
                <p className="text-sm text-muted-foreground text-center pt-8">
                  Aún no hay mensajes. Escribe el primero.
                </p>
              )}
              {conversationMessages(selectedContact).map((message, index, arr) => (
                <div key={message.id} className="space-y-4">
                  {(index === 0 || formatDate(message.timestamp) !== formatDate(arr[index - 1].timestamp)) && (
                    <div className="flex justify-center">
                      <span className="text-xs bg-muted px-2 py-1 rounded-full text-muted-foreground">
                        {formatDate(message.timestamp)}
                      </span>
                    </div>
                  )}
                  <div className={`flex ${message.sender === user.id ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] rounded-lg p-3 ${message.sender === user.id ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                      <p className="text-sm">{message.content}</p>
                      <p className={`text-xs mt-1 text-right ${message.sender === user.id ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                        {formatTime(message.timestamp)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
            <div className="p-3 border-t bg-background">
              <div className="flex gap-2">
                <Textarea
                  placeholder="Escribe un mensaje..."
                  className="min-h-[52px] resize-none"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend() }
                  }}
                />
                <Button size="icon" className="h-[52px] shrink-0" onClick={handleSend} disabled={!newMessage.trim() || sending}>
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </>
        ) : (
          <Tabs defaultValue="direct" className="flex flex-col flex-1">
            <div className="px-4 pt-3">
              <TabsList className="w-full">
                <TabsTrigger value="direct" className="flex-1">Directos</TabsTrigger>
                <TabsTrigger value="broadcast" className="flex-1">Anuncios</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="direct" className="flex-1 overflow-y-auto p-4 pt-3 space-y-2 m-0">
              {loading ? (
                <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              ) : contacts.length === 0 ? (
                <Card>
                  <CardContent className="py-10 text-center">
                    <MessageSquare className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-40" />
                    <p className="text-sm text-muted-foreground">No tienes contactos disponibles todavía.</p>
                    <p className="text-xs text-muted-foreground mt-1">Cuando un administrador te asigne un supervisor, podrás escribirle desde aquí.</p>
                  </CardContent>
                </Card>
              ) : (
                contacts.map((c) => {
                  const unread = unreadFrom(c.id)
                  const convo = conversationMessages(c.id)
                  const last = convo[convo.length - 1]
                  return (
                    <Card key={c.id} className="cursor-pointer hover:border-primary/40 transition-colors" onClick={() => setSelectedContact(c.id)}>
                      <CardContent className="p-3 flex items-center gap-3">
                        <Avatar>
                          <AvatarFallback>{getInitials(c.name)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="font-medium truncate">{c.name}</p>
                            {last && <p className="text-xs text-muted-foreground shrink-0">{formatTime(last.timestamp)}</p>}
                          </div>
                          <div className="flex items-center justify-between">
                            <p className="text-xs text-muted-foreground capitalize truncate">
                              {last ? `${last.sender === user.id ? "Tú: " : ""}${last.content}` : c.role === "admin" ? "Administración" : "Supervisor"}
                            </p>
                            {unread > 0 && <Badge className="ml-2 shrink-0">{unread}</Badge>}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })
              )}
            </TabsContent>

            <TabsContent value="broadcast" className="flex-1 overflow-y-auto p-4 pt-3 space-y-3 m-0">
              {loading ? (
                <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              ) : broadcasts.length === 0 ? (
                <Card>
                  <CardContent className="py-10 text-center">
                    <p className="text-sm text-muted-foreground">No hay anuncios disponibles.</p>
                  </CardContent>
                </Card>
              ) : (
                broadcasts.map((m) => (
                  <Card key={m.id}>
                    <CardContent className="p-3">
                      <p className="text-xs text-muted-foreground mb-1">{formatDate(m.timestamp)} {formatTime(m.timestamp)}</p>
                      <p className="text-sm">{m.content}</p>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  )
}
