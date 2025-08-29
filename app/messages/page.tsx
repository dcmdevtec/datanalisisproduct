"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/auth-provider"
import DashboardLayout from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Loader2, Send, Search } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

type Message = {
  id: string
  sender: string
  receiver: string
  content: string
  timestamp: string
  read: boolean
}

type User = {
  id: string
  name: string
  email: string
  role: string
  status: string
}

export default function MessagesPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const { toast } = useToast()
  const [messages, setMessages] = useState<Message[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedUser, setSelectedUser] = useState<string | null>(null)
  const [newMessage, setNewMessage] = useState("")
  const [searchTerm, setSearchTerm] = useState("")
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login")
    }
  }, [user, authLoading, router])

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch users
        const usersResponse = await fetch("/api/users")
        if (!usersResponse.ok) {
          throw new Error("Error al cargar usuarios")
        }
        const usersData = await usersResponse.json()
        setUsers(usersData)

        // Fetch messages
        if (user) {
          const messagesResponse = await fetch(`/api/messages?userId=${user.id}`)
          if (!messagesResponse.ok) {
            throw new Error("Error al cargar mensajes")
          }
          const messagesData = await messagesResponse.json()
          setMessages(messagesData)
        }
      } catch (error) {
        console.error("Error fetching data:", error)
        toast({
          title: "Error",
          description: "No se pudieron cargar los datos",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    if (user) {
      fetchData()
    }
  }, [user, toast])

  useEffect(() => {
    // Scroll to bottom when messages change or user selected
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, selectedUser])

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedUser || !user) return

    try {
      const response = await fetch("/api/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sender: user.id,
          receiver: selectedUser,
          content: newMessage,
        }),
      })

      if (!response.ok) {
        throw new Error("Error al enviar mensaje")
      }

      const sentMessage = await response.json()
      setMessages([...messages, sentMessage])
      setNewMessage("")
    } catch (error) {
      console.error("Error sending message:", error)
      toast({
        title: "Error",
        description: "No se pudo enviar el mensaje",
        variant: "destructive",
      })
    }
  }

  const getConversations = () => {
    if (!user) return []

    const conversations: Record<string, { user: User; unreadCount: number; lastMessage: Message | null }> = {}

    // Add all users first
    users.forEach((u) => {
      if (u.id !== user.id) {
        conversations[u.id] = {
          user: u,
          unreadCount: 0,
          lastMessage: null,
        }
      }
    })

    // Process messages to find conversations
    messages.forEach((message) => {
      const isIncoming = message.receiver === user.id
      const otherUserId = isIncoming ? message.sender : message.receiver

      if (otherUserId === "all") {
        // Handle broadcast messages
        return
      }

      if (conversations[otherUserId]) {
        // Update unread count
        if (isIncoming && !message.read) {
          conversations[otherUserId].unreadCount += 1
        }

        // Update last message
        if (
          !conversations[otherUserId].lastMessage ||
          new Date(message.timestamp) > new Date(conversations[otherUserId].lastMessage!.timestamp)
        ) {
          conversations[otherUserId].lastMessage = message
        }
      }
    })

    // Convert to array and sort by last message time
    return Object.values(conversations)
      .filter((conv) => conv.lastMessage !== null)
      .sort((a, b) => {
        if (!a.lastMessage || !b.lastMessage) return 0
        return new Date(b.lastMessage.timestamp).getTime() - new Date(a.lastMessage.timestamp).getTime()
      })
  }

  const getConversationMessages = (userId: string) => {
    if (!user) return []

    return messages
      .filter(
        (message) =>
          (message.sender === user.id && message.receiver === userId) ||
          (message.sender === userId && message.receiver === user.id),
      )
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
  }

  const getBroadcastMessages = () => {
    if (!user) return []

    return messages
      .filter((message) => message.receiver === "all")
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }

  const formatMessageTime = (timestamp: string) => {
    const date = new Date(timestamp)
    return new Intl.DateTimeFormat("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(date)
  }

  const formatMessageDate = (timestamp: string) => {
    const date = new Date(timestamp)
    return new Intl.DateTimeFormat("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(date)
  }

  const getUserById = (userId: string) => {
    return users.find((u) => u.id === userId)
  }

  const getUserInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .substring(0, 2)
  }

  const conversations = getConversations()
  const filteredConversations = conversations.filter((conv) =>
    conv.user.name.toLowerCase().includes(searchTerm.toLowerCase()),
  )
  const broadcastMessages = getBroadcastMessages()

  if (authLoading || !user) {
    return <div className="flex h-screen items-center justify-center">Cargando...</div>
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col h-[calc(100vh-64px)] md:h-screen">
        <Tabs defaultValue="direct" className=" flex flex-col h-full">
          <div className="border-b px-6 py-3">
            <div className="flex items-center justify-between mb-3">
              <h1 className="text-2xl font-bold">Mensajes</h1>
              <TabsList className="mt-14">
                <TabsTrigger value="direct">Directos</TabsTrigger>
                <TabsTrigger value="broadcast">Anuncios</TabsTrigger>
              </TabsList>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Buscar conversaciones..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-1 overflow-hidden">
            <TabsContent value="direct" className="flex flex-1 overflow-hidden m-0">
              <div className="w-full md:w-80 border-r overflow-y-auto">
                {loading ? (
                  <div className="flex justify-center items-center h-20">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  </div>
                ) : filteredConversations.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground">No se encontraron conversaciones</div>
                ) : (
                  filteredConversations.map((conv) => (
                    <div
                      key={conv.user.id}
                      className={`p-3 border-b cursor-pointer hover:bg-muted/50 ${
                        selectedUser === conv.user.id ? "bg-muted" : ""
                      }`}
                      onClick={() => setSelectedUser(conv.user.id)}
                    >
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarFallback>{getUserInitials(conv.user.name)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="font-medium truncate">{conv.user.name}</p>
                            {conv.lastMessage && (
                              <p className="text-xs text-muted-foreground">
                                {formatMessageTime(conv.lastMessage.timestamp)}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center justify-between">
                            {conv.lastMessage && (
                              <p className="text-sm text-muted-foreground truncate">
                                {conv.lastMessage.sender === user.id ? "Tú: " : ""}
                                {conv.lastMessage.content}
                              </p>
                            )}
                            {conv.unreadCount > 0 && <Badge className="ml-2">{conv.unreadCount}</Badge>}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="flex-1 flex flex-col">
                {selectedUser ? (
                  <>
                    <div className="p-3 border-b">
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarFallback>{getUserInitials(getUserById(selectedUser)?.name || "")}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{getUserById(selectedUser)?.name}</p>
                          <p className="text-xs text-muted-foreground capitalize">{getUserById(selectedUser)?.role}</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                      {getConversationMessages(selectedUser).map((message, index) => (
                        <div key={message.id} className="space-y-4">
                          {index === 0 ||
                          formatMessageDate(message.timestamp) !==
                            formatMessageDate(getConversationMessages(selectedUser)[index - 1].timestamp) ? (
                            <div className="flex justify-center">
                              <span className="text-xs bg-muted px-2 py-1 rounded-full text-muted-foreground">
                                {formatMessageDate(message.timestamp)}
                              </span>
                            </div>
                          ) : null}

                          <div className={`flex ${message.sender === user.id ? "justify-end" : "justify-start"}`}>
                            <div
                              className={`max-w-[80%] rounded-lg p-3 ${
                                message.sender === user.id ? "bg-primary text-primary-foreground" : "bg-muted"
                              }`}
                            >
                              <p>{message.content}</p>
                              <p
                                className={`text-xs mt-1 text-right ${
                                  message.sender === user.id ? "text-primary-foreground/80" : "text-muted-foreground"
                                }`}
                              >
                                {formatMessageTime(message.timestamp)}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                      <div ref={messagesEndRef} />
                    </div>

                    <div className="p-3 border-t">
                      <div className="flex gap-2">
                        <Textarea
                          placeholder="Escribe un mensaje..."
                          className="min-h-[60px] resize-none"
                          value={newMessage}
                          onChange={(e) => setNewMessage(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault()
                              handleSendMessage()
                            }
                          }}
                        />
                        <Button
                          size="icon"
                          className="h-[60px]"
                          onClick={handleSendMessage}
                          disabled={!newMessage.trim()}
                        >
                          <Send className="h-5 w-5" />
                        </Button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-muted-foreground">
                    Selecciona una conversación para ver los mensajes
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="broadcast" className="flex-1 overflow-y-auto m-0 p-4">
              <div className="max-w-2xl mx-auto space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-bold">Anuncios</h2>
                  <Button>Nuevo Anuncio</Button>
                </div>

                {loading ? (
                  <div className="flex justify-center items-center h-20">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  </div>
                ) : broadcastMessages.length === 0 ? (
                  <div className="text-center p-8 border rounded-lg">
                    <p className="text-muted-foreground">No hay anuncios disponibles</p>
                  </div>
                ) : (
                  broadcastMessages.map((message) => (
                    <div key={message.id} className="border rounded-lg p-4">
                      <div className="flex items-center gap-3 mb-2">
                        <Avatar>
                          <AvatarFallback>{getUserInitials(getUserById(message.sender)?.name || "")}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{getUserById(message.sender)?.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatMessageDate(message.timestamp)} {formatMessageTime(message.timestamp)}
                          </p>
                        </div>
                      </div>
                      <p>{message.content}</p>
                    </div>
                  ))
                )}
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}
