"use client"

import type React from "react"

import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Underline from "@tiptap/extension-underline"
import Link from "@tiptap/extension-link"
import Image from "@tiptap/extension-image"
import Placeholder from "@tiptap/extension-placeholder"
import TextAlign from "@tiptap/extension-text-align"
import { TextStyle } from "@tiptap/extension-text-style"
import Color from "@tiptap/extension-color"
import Highlight from "@tiptap/extension-highlight"
import { useCallback, useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import {
  Bold,
  Italic,
  UnderlineIcon,
  Strikethrough,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  LinkIcon,
  ImageIcon,
  Type,
  Highlighter,
} from "lucide-react"

interface ProfessionalRichTextEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  compact?: boolean
  showToolbar?: boolean
}

export function ProfessionalRichTextEditor({
  value,
  onChange,
  placeholder = "Escribe aquí...",
  className,
  compact = false,
  showToolbar = true,
}: ProfessionalRichTextEditorProps) {
  const [showLinkDialog, setShowLinkDialog] = useState(false)
  const [linkUrl, setLinkUrl] = useState("")
  const [linkText, setLinkText] = useState("")
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [showFontPicker, setShowFontPicker] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextStyle,

      Color.configure({
        types: ["textStyle"],
      }),
      Highlight.configure({
        multicolor: true,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-primary underline cursor-pointer",
        },
      }),
      Image.configure({
        HTMLAttributes: {
          class: "max-w-full h-auto rounded-lg",
        },
      }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class: cn(
          "prose prose-sm max-w-none focus:outline-none",
          "min-h-[60px] p-3 bg-background text-foreground",
          compact && "min-h-[40px] p-2 text-sm",
        ),
      },
    },
    immediatelyRender: false,
  })

  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || "", { emitUpdate: false })
    }
  }, [value, editor])

  const setLink = useCallback(() => {
    if (linkUrl.trim()) {
      if (linkText.trim()) {
        editor?.chain().focus().insertContent(`<a href="${linkUrl}">${linkText}</a>`).run()
      } else {
        editor?.chain().focus().setLink({ href: linkUrl }).run()
      }
      setShowLinkDialog(false)
      setLinkUrl("")
      setLinkText("")
    }
  }, [editor, linkUrl, linkText])

  const openLinkDialog = useCallback(() => {
    const { from, to } = editor?.state.selection || {}
    const selectedText = editor?.state.doc.textBetween(from || 0, to || 0) || ""
    setLinkText(selectedText)
    setLinkUrl("")
    setShowLinkDialog(true)
  }, [editor])

  const handleImageUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) return

      const maxSize = 2 * 1024 * 1024 // 2MB
      if (file.size > maxSize) {
        alert("La imagen no debe superar 2MB")
        return
      }

      try {
        const { uploadImage, generateUniqueFileName, getExtensionFromMimeType, resizeImage } = await import(
          "@/lib/supabase-storage"
        )

        const resized = await resizeImage(file, 800, 800)
        const extension = getExtensionFromMimeType(file.type)
        const fileName = generateUniqueFileName("content_image", extension)

        const publicUrl = await uploadImage("survey-images", `content/${fileName}`, resized)

        editor?.chain().focus().setImage({ src: publicUrl }).run()
      } catch (error: any) {
        console.error("Error uploading image:", error)
        alert(`Error subiendo imagen: ${error.message || "Error desconocido"}`)
      } finally {
        event.target.value = ""
      }
    },
    [editor],
  )

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  if (!editor) {
    return (
      <div className={cn("border rounded-md animate-pulse", className)}>
        <div className="h-12 bg-muted/50 rounded-t-md" />
        <div className="h-20 bg-background" />
      </div>
    )
  }

  const colors = [
    "#000000",
    "#374151",
    "#6B7280",
    "#9CA3AF",
    "#D1D5DB",
    "#EF4444",
    "#F97316",
    "#EAB308",
    "#22C55E",
    "#3B82F6",
    "#8B5CF6",
    "#EC4899",
    "#F43F5E",
    "#06B6D4",
    "#10B981",
  ]

  const fonts = [
    { value: "Inter", label: "Inter" },
    { value: "Arial", label: "Arial" },
    { value: "Helvetica", label: "Helvetica" },
    { value: "Times New Roman", label: "Times New Roman" },
    { value: "Georgia", label: "Georgia" },
    { value: "Verdana", label: "Verdana" },
    { value: "Trebuchet MS", label: "Trebuchet MS" },
    { value: "Courier New", label: "Courier New" },
  ]

  return (
    <div className={cn("border rounded-md bg-background", className)}>
      {showToolbar && (
        <div className="flex flex-wrap items-center gap-1 p-2 border-b bg-muted/30">
          {/* Font Family */}
          <Select
            value={editor.getAttributes("textStyle").fontFamily || "Inter"}
            onValueChange={(value) => editor.chain().focus().setFontFamily(value).run()}
          >
            <SelectTrigger className="w-32 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {fonts.map((font) => (
                <SelectItem key={font.value} value={font.value} style={{ fontFamily: font.value }}>
                  {font.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Separator orientation="vertical" className="h-6 mx-1" />

          {/* Basic Formatting */}
          <Button
            variant={editor.isActive("bold") ? "default" : "ghost"}
            size="sm"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className="h-8 w-8 p-0"
            title="Negrita"
          >
            <Bold className="h-4 w-4" />
          </Button>

          <Button
            variant={editor.isActive("italic") ? "default" : "ghost"}
            size="sm"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className="h-8 w-8 p-0"
            title="Cursiva"
          >
            <Italic className="h-4 w-4" />
          </Button>

          <Button
            variant={editor.isActive("underline") ? "default" : "ghost"}
            size="sm"
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            className="h-8 w-8 p-0"
            title="Subrayado"
          >
            <UnderlineIcon className="h-4 w-4" />
          </Button>

          <Button
            variant={editor.isActive("strike") ? "default" : "ghost"}
            size="sm"
            onClick={() => editor.chain().focus().toggleStrike().run()}
            className="h-8 w-8 p-0"
            title="Tachado"
          >
            <Strikethrough className="h-4 w-4" />
          </Button>

          <Separator orientation="vertical" className="h-6 mx-1" />

          {/* Text Color */}
          <div className="relative">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowColorPicker(!showColorPicker)}
              className="h-8 w-8 p-0"
              title="Color de texto"
            >
              <Type className="h-4 w-4" />
              <div
                className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-4 h-1 rounded"
                style={{ backgroundColor: editor.getAttributes("textStyle").color || "#000000" }}
              />
            </Button>
            {showColorPicker && (
              <div className="absolute top-10 left-0 z-50 p-2 bg-background border rounded-md shadow-lg">
                <div className="grid grid-cols-5 gap-1">
                  {colors.map((color) => (
                    <button
                      key={color}
                      className="w-6 h-6 rounded border hover:scale-110 transition-transform"
                      style={{ backgroundColor: color }}
                      onClick={() => {
                        editor.chain().focus().setColor(color).run()
                        setShowColorPicker(false)
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Highlight */}
          <Button
            variant={editor.isActive("highlight") ? "default" : "ghost"}
            size="sm"
            onClick={() => editor.chain().focus().toggleHighlight().run()}
            className="h-8 w-8 p-0"
            title="Resaltar"
          >
            <Highlighter className="h-4 w-4" />
          </Button>

          <Separator orientation="vertical" className="h-6 mx-1" />

          {/* Headings */}
          <Button
            variant={editor.isActive("heading", { level: 1 }) ? "default" : "ghost"}
            size="sm"
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            className="h-8 px-2 text-xs font-bold"
            title="Título 1"
          >
            H1
          </Button>

          <Button
            variant={editor.isActive("heading", { level: 2 }) ? "default" : "ghost"}
            size="sm"
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className="h-8 px-2 text-xs font-bold"
            title="Título 2"
          >
            H2
          </Button>

          <Separator orientation="vertical" className="h-6 mx-1" />

          {/* Alignment */}
          <Button
            variant={editor.isActive({ textAlign: "left" }) ? "default" : "ghost"}
            size="sm"
            onClick={() => editor.chain().focus().setTextAlign("left").run()}
            className="h-8 w-8 p-0"
            title="Alinear izquierda"
          >
            <AlignLeft className="h-4 w-4" />
          </Button>

          <Button
            variant={editor.isActive({ textAlign: "center" }) ? "default" : "ghost"}
            size="sm"
            onClick={() => editor.chain().focus().setTextAlign("center").run()}
            className="h-8 w-8 p-0"
            title="Centrar"
          >
            <AlignCenter className="h-4 w-4" />
          </Button>

          <Button
            variant={editor.isActive({ textAlign: "right" }) ? "default" : "ghost"}
            size="sm"
            onClick={() => editor.chain().focus().setTextAlign("right").run()}
            className="h-8 w-8 p-0"
            title="Alinear derecha"
          >
            <AlignRight className="h-4 w-4" />
          </Button>

          <Separator orientation="vertical" className="h-6 mx-1" />

          {/* Lists */}
          <Button
            variant={editor.isActive("bulletList") ? "default" : "ghost"}
            size="sm"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className="h-8 w-8 p-0"
            title="Lista con viñetas"
          >
            <List className="h-4 w-4" />
          </Button>

          <Button
            variant={editor.isActive("orderedList") ? "default" : "ghost"}
            size="sm"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className="h-8 w-8 p-0"
            title="Lista numerada"
          >
            <ListOrdered className="h-4 w-4" />
          </Button>

          <Separator orientation="vertical" className="h-6 mx-1" />

          {/* Link */}
          <Button
            variant={editor.isActive("link") ? "default" : "ghost"}
            size="sm"
            onClick={openLinkDialog}
            className="h-8 w-8 p-0"
            title="Insertar enlace"
          >
            <LinkIcon className="h-4 w-4" />
          </Button>

          {/* Image */}
          <Button variant="ghost" size="sm" onClick={openFilePicker} className="h-8 w-8 p-0" title="Insertar imagen">
            <ImageIcon className="h-4 w-4" />
          </Button>

          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
        </div>
      )}

      <div className="relative">
        <EditorContent editor={editor} />
      </div>

      {/* Link Dialog */}
      <Dialog open={showLinkDialog} onOpenChange={setShowLinkDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LinkIcon className="h-5 w-5" />
              Insertar Enlace
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="link-text">Texto del enlace</Label>
              <Input
                id="link-text"
                placeholder="Texto que se mostrará"
                value={linkText}
                onChange={(e) => setLinkText(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="link-url">URL</Label>
              <Input
                id="link-url"
                placeholder="https://ejemplo.com"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    setLink()
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLinkDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={setLink} disabled={!linkUrl.trim()}>
              Insertar Enlace
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
