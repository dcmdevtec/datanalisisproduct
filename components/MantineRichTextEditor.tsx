'use client';

import { useEffect, useState } from 'react';
import { useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Blockquote from '@tiptap/extension-blockquote';
import CodeBlock from '@tiptap/extension-code-block';
import TextAlign from '@tiptap/extension-text-align';

import { RichTextEditor } from '@mantine/tiptap';
import '@mantine/tiptap/styles.css';

interface MantineRichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  immediatelyRender?: boolean;
  autoFocus?: boolean;
}

export default function MyEditor({ value, onChange, placeholder = '', immediatelyRender = false, autoFocus = false }: MantineRichTextEditorProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link,
      Blockquote,
      CodeBlock,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ],
    content: value || '',
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        placeholder,
        autofocus: autoFocus ? 'autofocus' : undefined,
      },
    },
    immediatelyRender,
  });

  // Sync editor content if value changes from outside
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || '', false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  if (!mounted || !editor) return null;

  return (
    <>
  <style jsx global>{`
        /* Forzar fondo y color en el área editable tiptap/ProseMirror en cualquier contexto/modal */
        .tiptap.ProseMirror {
          background-color: var(--background, #18181b) !important;
          color: var(--foreground, #f4f4f5) !important;
        }
        [data-theme="dark"] .tiptap.ProseMirror {
          background-color: #18181b !important;
          color: #f4f4f5 !important;
        }
        [data-theme="light"] .tiptap.ProseMirror {
          background-color: #fff !important;
          color: #18181b !important;
        }
      `}</style>
      <RichTextEditor editor={editor}>
        <RichTextEditor.Toolbar sticky stickyOffset={60}>
          <RichTextEditor.ControlsGroup>
            <RichTextEditor.Bold />
            <RichTextEditor.Italic />
            <RichTextEditor.Underline />
            <RichTextEditor.Strikethrough />
            <RichTextEditor.ClearFormatting />
          </RichTextEditor.ControlsGroup>
          <RichTextEditor.ControlsGroup>
            <RichTextEditor.H1 />
            <RichTextEditor.H2 />
            <RichTextEditor.H3 />
            <RichTextEditor.H4 />
          </RichTextEditor.ControlsGroup>
          <RichTextEditor.ControlsGroup>
            <RichTextEditor.Blockquote />
            <RichTextEditor.CodeBlock />
          </RichTextEditor.ControlsGroup>
          <RichTextEditor.ControlsGroup>
            <RichTextEditor.BulletList />
            <RichTextEditor.OrderedList />
          </RichTextEditor.ControlsGroup>
          <RichTextEditor.ControlsGroup>
            <RichTextEditor.Link />
            <RichTextEditor.Unlink />
          </RichTextEditor.ControlsGroup>

          <RichTextEditor.ControlsGroup>
            <RichTextEditor.AlignLeft />
            <RichTextEditor.AlignCenter />
            <RichTextEditor.AlignRight />
            <RichTextEditor.AlignJustify />
          </RichTextEditor.ControlsGroup>
          <RichTextEditor.ControlsGroup>
            <RichTextEditor.Superscript />
            <RichTextEditor.Subscript />
          </RichTextEditor.ControlsGroup>
        </RichTextEditor.Toolbar>
        <RichTextEditor.Content className="mantine-richtext-content-override" style={{minHeight: 120}} />
      </RichTextEditor>
    </>
  );
}
