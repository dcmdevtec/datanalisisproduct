"use client"

import { RichTextEditor, Link } from '@mantine/tiptap';
import { useEditor, Extension } from '@tiptap/react';
import { useEffect, useRef, useState } from 'react'
import Highlight from '@tiptap/extension-highlight';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import { Color } from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import Placeholder from '@tiptap/extension-placeholder';
import { Select, MantineProvider } from '@mantine/core';
import '@mantine/core/styles.css';
import '@mantine/tiptap/styles.css';

const FontFamily = Extension.create({
  name: 'fontFamily',
  addOptions() {
    return {
      types: ['textStyle'],
    }
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontFamily: {
            default: null,
            parseHTML: element => {
              return element.style.fontFamily?.replace(/["']/g, '') || null
            },
            renderHTML: attributes => {
              if (!attributes.fontFamily) {
                return {}
              }
              return {
                style: `font-family: ${attributes.fontFamily}`,
              }
            },
          },
        },
      },
    ]
  },
  addCommands() {
    return {
      setFontFamily: (fontFamily: string) => ({ chain }) => {
        return chain()
          .setMark('textStyle', { fontFamily })
          .run()
      },
      unsetFontFamily: () => ({ chain }) => {
        return chain()
          .setMark('textStyle', { fontFamily: null })
          .removeEmptyTextStyle()
          .run()
      },
    }
  },
});

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  immediatelyRender?: boolean;
  debounceMs?: number;
  minHeight?: string;
  compact?: boolean;
}

export function CompactRichTextEditor({ 
  value, 
  onChange, 
  placeholder = 'Escribe aquí...', 
  immediatelyRender = false, 
  debounceMs = 300,
  minHeight = "80px",
  compact = true
}: Props) {
  const [isFocused, setIsFocused] = useState(false);
  const [hasContent, setHasContent] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const blurTimeoutRef = useRef<number | null>(null);

  const handleFocus = () => {
    if (blurTimeoutRef.current) {
      window.clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }
    setIsFocused(true);
  };

  const handleBlur = ({ event }: { event: FocusEvent }) => {
    // Si el foco se mueve a un elemento dentro del container, no ocultar
    if (blurTimeoutRef.current) {
      window.clearTimeout(blurTimeoutRef.current);
    }
    
    blurTimeoutRef.current = window.setTimeout(() => {
      const relatedTarget = event.relatedTarget as Node;
      const container = containerRef.current;
      
      // Solo ocultar si el foco se mueve fuera del container completo
      if (!container || !relatedTarget || !container.contains(relatedTarget)) {
        setIsFocused(false);
        flushPending();
      }
    }, 150); // Pequeño delay para permitir clics en la toolbar
  };

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link,
      Highlight,
      TextStyle,
      Color,
      FontFamily,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder }),
    ],
    content: value,
    immediatelyRender,
    onFocus: handleFocus,
    onBlur: handleBlur,
    onUpdate: () => {
      const html = editor?.getHTML() || '';
      setHasContent(html.length > 0 && html !== '<p></p>');
    }
  });

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) {
        window.clearTimeout(blurTimeoutRef.current);
      }
    };
  }, []);

  // Implement debouncing of onChange and flush on blur using local refs
  const pendingRef = useRef<string | null>(null)
  const timeoutRef = useRef<number | null>(null)

  const flushPending = () => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    if (pendingRef.current !== null) {
      onChange(pendingRef.current)
      pendingRef.current = null
    }
  }

  useEffect(() => {
    if (!editor) return

    const handleUpdate = () => {
      const html = editor.getHTML()
      pendingRef.current = html
      setHasContent(html.length > 0 && html !== '<p></p>');

      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current)
      }

      timeoutRef.current = window.setTimeout(() => {
        flushPending()
      }, debounceMs)
    }

    editor.on('update', handleUpdate)
    return () => {
      editor.off('update', handleUpdate)
      flushPending()
    }
  }, [editor, debounceMs, onChange])

  // Keep editor content in sync when external value changes
  useEffect(() => {
    if (!editor) return
    const current = editor.getHTML()
    if (value !== current) {
      editor.commands.setContent(value, { emitUpdate: false })
      setHasContent(value.length > 0 && value !== '<p></p>');
    }
  }, [value, editor])

  if (!editor) {
    return (
      <div className="animate-pulse bg-muted rounded h-20" />
    );
  }

  const shouldShowToolbar = !compact || isFocused || hasContent;
  const editorHeight = isFocused || hasContent ? "auto" : minHeight;

  return (
    <div ref={containerRef}>
      <MantineProvider>
        <RichTextEditor 
          editor={editor} 
          className="border border-input rounded-md transition-all duration-200"
          style={{ minHeight: editorHeight }}
        >
          {shouldShowToolbar && (
            <RichTextEditor.Toolbar 
              className={`transition-all duration-200 ${isFocused ? 'border-b' : 'border-b-0'}`}
              onMouseDown={(e) => {
                // Prevenir que los clics en la toolbar causen blur del editor
                e.preventDefault();
              }}
            >
              <RichTextEditor.ControlsGroup>
                <RichTextEditor.Bold />
                <RichTextEditor.Italic />
                <RichTextEditor.Underline />
              </RichTextEditor.ControlsGroup>

            <RichTextEditor.ControlsGroup>
              <RichTextEditor.H1 />
              <RichTextEditor.H2 />
              <RichTextEditor.H3 />
            </RichTextEditor.ControlsGroup>

            <RichTextEditor.ControlsGroup>
              <RichTextEditor.BulletList />
              <RichTextEditor.OrderedList />
            </RichTextEditor.ControlsGroup>

            {isFocused && (
              <>
                <RichTextEditor.ControlsGroup>
                  <RichTextEditor.Strikethrough />
                  <RichTextEditor.ClearFormatting />
                  <RichTextEditor.ColorPicker
                    colors={[
                      '#25262b',
                      '#868e96',
                      '#fa5252',
                      '#e64980',
                      '#be4bdb',
                      '#7950f2',
                      '#4c6ef5',
                      '#228be6',
                      '#15aabf',
                      '#12b886',
                      '#40c057',
                      '#82c91e',
                      '#fab005',
                      '#fd7e14',
                    ]}
                  />
                  <RichTextEditor.Highlight />
                </RichTextEditor.ControlsGroup>

                <RichTextEditor.ControlsGroup>
                  <RichTextEditor.Blockquote />
                  <RichTextEditor.Hr />
                </RichTextEditor.ControlsGroup>

                <RichTextEditor.ControlsGroup>
                  <RichTextEditor.AlignLeft />
                  <RichTextEditor.AlignCenter />
                  <RichTextEditor.AlignRight />
                </RichTextEditor.ControlsGroup>

                <RichTextEditor.ControlsGroup>
                  <RichTextEditor.Link />
                  <RichTextEditor.Unlink />
                </RichTextEditor.ControlsGroup>

                <RichTextEditor.ControlsGroup>
                  <Select
                    size="xs"
                    value={editor.getAttributes('textStyle').fontFamily || 'Arial'}
                    onChange={(value) => editor.chain().focus().setFontFamily(value || '').run()}
                    data={[
                      { value: 'Arial', label: 'Arial' },
                      { value: 'Times New Roman', label: 'Times New Roman' },
                      { value: 'Helvetica', label: 'Helvetica' },
                      { value: 'Georgia', label: 'Georgia' },
                      { value: 'Verdana', label: 'Verdana' },
                    ]}
                    placeholder="Fuente"
                    styles={{ root: { width: '120px' } }}
                  />
                </RichTextEditor.ControlsGroup>
              </>
            )}
          </RichTextEditor.Toolbar>
        )}

        <RichTextEditor.Content 
          className="p-3"
          style={{ 
            minHeight: editorHeight,
            maxHeight: isFocused ? '300px' : '150px',
            overflow: 'auto'
          }} 
        />
      </RichTextEditor>
    </MantineProvider>
    </div>
  );
}