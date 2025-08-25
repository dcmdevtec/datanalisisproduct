"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { createLowlight } from "lowlight";
import { useCallback, useEffect, useRef } from "react";
import '@mantine/tiptap/styles.css';
import { Bold, Italic, Underline as UnderlineIcon, Strikethrough, List, ListOrdered, Heading2, Heading3, Link as LinkIcon, Image as ImageIcon, Code, AlignLeft, AlignCenter, AlignRight, Eraser } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "./dialog";
import { Button } from "./button";
import { Input } from "./input";
import { Label } from "./label";
import { Alert, AlertDescription } from "./alert";

const lowlight = createLowlight();

export default function FullTiptapEditor({
  value,
  onChange,
  autofocus = false,
}: {
  value: string;
  onChange: (html: string) => void;
  autofocus?: boolean;
}) {
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [showErrorAlert, setShowErrorAlert] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link,
      Image,
      Placeholder.configure({ placeholder: "Escribe aquí tu pregunta..." }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      CodeBlockLowlight.configure({ lowlight }),
    ],
    content: value,
    autofocus,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: "min-h-[120px] p-2 border rounded bg-white focus:outline-none",
      },
    },
    immediatelyRender: false,
  });

  // Sync external value
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || "<p></p>", { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Auto-cerrar el alert de error después de 5 segundos
  useEffect(() => {
    if (showErrorAlert) {
      const timeout = setTimeout(() => {
        setShowErrorAlert(false);
      }, 5000);
      return () => clearTimeout(timeout);
    }
  }, [showErrorAlert]);

  // Toolbar actions
  const openLinkDialog = useCallback(() => {
    setLinkUrl("");
    setShowLinkDialog(true);
  }, []);

  const setLink = useCallback(() => {
    if (linkUrl.trim()) {
      editor?.chain().focus().setLink({ href: linkUrl }).run();
      setShowLinkDialog(false);
      setLinkUrl("");
    }
  }, [editor, linkUrl]);


  // File input ref for image upload
  const fileInputRef = useRef<HTMLInputElement>(null);


  // Handler for uploading image from device with size/weight limits
  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    // Limit: 1MB and max 800x800px
    const maxSize = 1024 * 1024; // 1MB
    const maxDim = 800;
    if (file.size > maxSize) {
      setErrorMessage('La imagen no debe superar 1MB.');
      setShowErrorAlert(true);
      event.target.value = '';
      return;
    }
    const img = new window.Image();
    const reader = new FileReader();
    reader.onload = (e) => {
      if (!e?.target || !e.target.result) return;
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          // Resize
          const scale = Math.min(maxDim / width, maxDim / height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const resized = canvas.toDataURL('image/jpeg', 0.92);
            editor?.chain().focus().setImage({ src: resized }).run();
          }
        } else {
          editor?.chain().focus().setImage({ src: e.target.result as string }).run();
        }
      };
      img.src = e.target.result as string;
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  // Open file picker
  const openFilePicker = () => {
    fileInputRef.current?.click();
  };


  if (!editor) return null;

  return (
    <>
      <style jsx global>{`
        .tiptap-editor-pro .ProseMirror {
          background-color: var(--background, #18181b) !important;
          color: var(--foreground, #f4f4f5) !important;
        }
        [data-theme="dark"] .tiptap-editor-pro .ProseMirror {
          background-color: #18181b !important;
          color: #f4f4f5 !important;
        }
        [data-theme="light"] .tiptap-editor-pro .ProseMirror {
          background-color: #fff !important;
          color: #18181b !important;
        }
      `}</style>
      <div className="tiptap-editor-pro space-y-2">
        <div className="flex flex-wrap gap-1 items-center p-1 rounded bg-gray-100 dark:bg-[#23232b] border border-gray-200 dark:border-[#23232b]">
          <button type="button" title="Negrita" onClick={() => editor.chain().focus().toggleBold().run()} className={editor.isActive('bold') ? 'text-primary' : 'text-gray-700 dark:text-gray-200'}><Bold className="w-5 h-5" /></button>
          <button type="button" title="Cursiva" onClick={() => editor.chain().focus().toggleItalic().run()} className={editor.isActive('italic') ? 'text-primary' : 'text-gray-700 dark:text-gray-200'}><Italic className="w-5 h-5" /></button>
          <button type="button" title="Subrayado" onClick={() => editor.chain().focus().toggleUnderline().run()} className={editor.isActive('underline') ? 'text-primary' : 'text-gray-700 dark:text-gray-200'}><UnderlineIcon className="w-5 h-5" /></button>
          <button type="button" title="Tachado" onClick={() => editor.chain().focus().toggleStrike().run()} className={editor.isActive('strike') ? 'text-primary' : 'text-gray-700 dark:text-gray-200'}><Strikethrough className="w-5 h-5" /></button>
          <button type="button" title="Lista" onClick={() => editor.chain().focus().toggleBulletList().run()} className={editor.isActive('bulletList') ? 'text-primary' : 'text-gray-700 dark:text-gray-200'}><List className="w-5 h-5" /></button>
          <button type="button" title="Lista ordenada" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={editor.isActive('orderedList') ? 'text-primary' : 'text-gray-700 dark:text-gray-200'}><ListOrdered className="w-5 h-5" /></button>
          <button type="button" title="Encabezado H2" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={editor.isActive('heading', { level: 2 }) ? 'text-primary font-bold' : 'text-gray-700 dark:text-gray-200'}><Heading2 className="w-5 h-5" /></button>
          <button type="button" title="Encabezado H3" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className={editor.isActive('heading', { level: 3 }) ? 'text-primary font-bold' : 'text-gray-700 dark:text-gray-200'}><Heading3 className="w-5 h-5" /></button>
          <button type="button" title="Enlace" onClick={openLinkDialog} className={editor.isActive('link') ? 'text-primary underline' : 'text-gray-700 dark:text-gray-200'}><LinkIcon className="w-5 h-5" /></button>
          <button type="button" title="Subir imagen" onClick={openFilePicker} className="text-gray-700 dark:text-gray-200"><ImageIcon className="w-5 h-5" /></button>
          <input
            className="dark:bg-[#18181b] dark:text-white"
            type="file"
            accept="image/*"
            ref={fileInputRef}
            style={{ display: 'none' }}
            onChange={handleImageUpload}
          />
          <button type="button" title="Código" onClick={() => editor.chain().focus().toggleCodeBlock().run()} className={editor.isActive('codeBlock') ? 'text-primary' : 'text-gray-700 dark:text-gray-200'}><Code className="w-5 h-5" /></button>
          <button type="button" title="Alinear a la izquierda" onClick={() => editor.chain().focus().setTextAlign('left').run()} className="text-gray-700 dark:text-gray-200"><AlignLeft className="w-5 h-5" /></button>
          <button type="button" title="Centrar" onClick={() => editor.chain().focus().setTextAlign('center').run()} className="text-gray-700 dark:text-gray-200"><AlignCenter className="w-5 h-5" /></button>
          <button type="button" title="Alinear a la derecha" onClick={() => editor.chain().focus().setTextAlign('right').run()} className="text-gray-700 dark:text-gray-200"><AlignRight className="w-5 h-5" /></button>
          <button type="button" title="Limpiar formato" onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()} className="text-gray-700 dark:text-gray-200"><Eraser className="w-5 h-5" /></button>
        </div>
        <div className="rounded-lg border border-[#e5e7eb] dark:border-[#23232b] bg-white dark:bg-[#18181b] p-3 min-h-[140px] transition-colors">
          <EditorContent editor={editor} />
        </div>
      </div>

      {/* Modal para agregar enlaces */}
      <Dialog open={showLinkDialog} onOpenChange={setShowLinkDialog}>
        <DialogContent className="sm:max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2" style={{ color: '#18b0a4' }}>
              <LinkIcon className="h-5 w-5" />
              Agregar Enlace
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="link-url">URL del enlace</Label>
              <Input
                id="link-url"
                placeholder="https://ejemplo.com"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    setLink();
                  }
                }}
                autoFocus
                className="rounded-full"
              />
            </div>
          </div>
          <DialogFooter className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => setShowLinkDialog(false)}
              className="rounded-full"
            >
              Cancelar
            </Button>
            <Button 
              onClick={setLink}
              disabled={!linkUrl.trim()}
              className="rounded-full text-white"
              style={{ backgroundColor: '#18b0a4' }}
            >
              Agregar Enlace
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Alert para errores */}
      {showErrorAlert && (
        <div className="fixed top-4 right-4 z-50 max-w-sm">
          <Alert variant="destructive" className="rounded-2xl shadow-lg">
            <AlertDescription className="flex items-center justify-between">
              <span>{errorMessage}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowErrorAlert(false)}
                className="h-6 w-6 p-0 ml-2"
              >
                ✕
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      )}
    </>
  );
}
