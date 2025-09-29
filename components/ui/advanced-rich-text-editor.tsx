"use client"

import { RichTextEditor, Link } from '@mantine/tiptap';
import { useEditor, Extension } from '@tiptap/react';
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
}

export function AdvancedRichTextEditor({ value, onChange, placeholder = 'Escribe aquí...', immediatelyRender = false }: Props) {
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
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    immediatelyRender,
  });

  if (!editor) {
    return null;
  }

  return (
    <MantineProvider>
      <RichTextEditor editor={editor} className="min-h-[200px]">
        <RichTextEditor.Toolbar sticky stickyOffset={0}>
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
                { value: 'Tahoma', label: 'Tahoma' },
                { value: 'Trebuchet MS', label: 'Trebuchet MS' },
                { value: 'Impact', label: 'Impact' }
              ]}
              placeholder="Seleccionar fuente"
              styles={{ root: { width: '180px' } }}
            />
        </RichTextEditor.ControlsGroup>

        <RichTextEditor.ControlsGroup>
          <RichTextEditor.Bold />
          <RichTextEditor.Italic />
          <RichTextEditor.Underline />
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
          <RichTextEditor.H1 />
          <RichTextEditor.H2 />
          <RichTextEditor.H3 />
          <RichTextEditor.H4 />
        </RichTextEditor.ControlsGroup>

        <RichTextEditor.ControlsGroup>
          <RichTextEditor.Blockquote />
          <RichTextEditor.Hr />
          <RichTextEditor.BulletList />
          <RichTextEditor.OrderedList />
        </RichTextEditor.ControlsGroup>

        <RichTextEditor.ControlsGroup>
          <RichTextEditor.AlignLeft />
          <RichTextEditor.AlignCenter />
          <RichTextEditor.AlignJustify />
          <RichTextEditor.AlignRight />
        </RichTextEditor.ControlsGroup>

        <RichTextEditor.ControlsGroup>
          <RichTextEditor.Link />
          <RichTextEditor.Unlink />
        </RichTextEditor.ControlsGroup>
      </RichTextEditor.Toolbar>

      <RichTextEditor.Content />
    </RichTextEditor>
    </MantineProvider>
  );
}