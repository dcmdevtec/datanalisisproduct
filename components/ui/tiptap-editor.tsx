"use client"

import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Underline from "@tiptap/extension-underline"
import Link from "@tiptap/extension-link"
import Image from "@tiptap/extension-image"
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight"
import { createLowlight } from "lowlight"
import TextAlign from "@tiptap/extension-text-align"
import Placeholder from "@tiptap/extension-placeholder"
import { useCallback } from "react"

const lowlight = createLowlight()

type TiptapEditorProps = {
  immediatelyRender?: boolean
}

export default function TiptapEditor({ immediatelyRender = false }: TiptapEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link,
      Image,
      CodeBlockLowlight.configure({ lowlight }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Placeholder.configure({ placeholder: "Escribe la pregunta..." }),
    ],
    content: "<p>Escribe aquí tu contenido...</p>",
    editorProps: {
      attributes: {
        class: "min-h-[120px] p-2 border rounded bg-white focus:outline-none",
      },
    },
    immediatelyRender,
  })

  const setLink = useCallback(() => {
    const url = window.prompt("URL del enlace")
    if (url) {
      editor?.chain().focus().setLink({ href: url }).run()
    }
  }, [editor])

  const addImage = useCallback(() => {
    const url = window.prompt("URL de la imagen")
    if (url) {
      editor?.chain().focus().setImage({ src: url }).run()
    }
  }, [editor])

  if (!editor) return null

  return (
    <div className="border p-4 rounded-lg">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 mb-2">
        <button onClick={() => editor.chain().focus().toggleBold().run()} className={editor.isActive('bold') ? 'font-bold text-blue-600' : ''}>B</button>
        <button onClick={() => editor.chain().focus().toggleItalic().run()} className={editor.isActive('italic') ? 'italic text-blue-600' : ''}>I</button>
        <button onClick={() => editor.chain().focus().toggleUnderline().run()} className={editor.isActive('underline') ? 'underline text-blue-600' : ''}>U</button>
        <button onClick={() => editor.chain().focus().toggleStrike().run()} className={editor.isActive('strike') ? 'line-through text-blue-600' : ''}>S</button>
        <button onClick={() => editor.chain().focus().toggleBulletList().run()} className={editor.isActive('bulletList') ? 'text-blue-600' : ''}>• Lista</button>
        <button onClick={() => editor.chain().focus().toggleOrderedList().run()} className={editor.isActive('orderedList') ? 'text-blue-600' : ''}>1. Lista</button>
        <button onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={editor.isActive('heading', { level: 2 }) ? 'text-blue-600 font-bold' : ''}>H2</button>
        <button onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className={editor.isActive('heading', { level: 3 }) ? 'text-blue-600 font-bold' : ''}>H3</button>
        <button onClick={setLink} className={editor.isActive('link') ? 'text-blue-600 underline' : ''}>Link</button>
        <button onClick={addImage}>Imagen</button>
        <button onClick={() => editor.chain().focus().toggleCodeBlock().run()} className={editor.isActive('codeBlock') ? 'text-blue-600' : ''}>Code</button>
        <button onClick={() => editor.chain().focus().setTextAlign('left').run()}>⯇</button>
        <button onClick={() => editor.chain().focus().setTextAlign('center').run()}>≡</button>
        <button onClick={() => editor.chain().focus().setTextAlign('right').run()}>⯈</button>
        <button onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}>Limpiar</button>
      </div>
      <EditorContent editor={editor} />
    </div>
  )
}
