"use client"

import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Underline from "@tiptap/extension-underline"
import Highlight from "@tiptap/extension-highlight"
import { Color } from "@tiptap/extension-color"
import { TextStyle } from "@tiptap/extension-text-style"
import FontFamily from "@tiptap/extension-font-family"
import Link from "@tiptap/extension-link"
import TextAlign from "@tiptap/extension-text-align"
import BulletList from "@tiptap/extension-bullet-list"
import OrderedList from "@tiptap/extension-ordered-list"
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Link as LinkIcon,
  Highlighter,
  Palette,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
} from "lucide-react"
import { useCallback } from "react"

interface RichTextEditorProps {
  content: string | null
  onChange: (html: string) => void
  placeholder?: string
  className?: string
}

const FONT_FAMILIES = ["Default", "serif", "monospace", "cursive"]
const COLORS = ["#f3f4f6", "#c9a84c", "#8b3a2a", "#4a2d6b", "#60a5fa", "#34d399", "#f87171", "#fb923c"]

export default function RichTextEditor({
  content,
  onChange,
  placeholder = "Scrivi qui...",
  className = "",
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ bulletList: false, orderedList: false }),
      Underline,
      Highlight.configure({ multicolor: true }),
      TextStyle,
      Color,
      FontFamily,
      Link.configure({ openOnClick: false }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      BulletList,
      OrderedList,
    ],
    content: content ?? "",
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class: "prose prose-invert prose-sm max-w-none focus:outline-none min-h-[80px] px-2 py-1.5",
      },
    },
  })

  const setLink = useCallback(() => {
    if (!editor) return
    const previous = editor.getAttributes("link").href as string | undefined
    const url = window.prompt("URL", previous ?? "https://")
    if (url === null) return
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run()
      return
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run()
  }, [editor])

  if (!editor) return null

  return (
    <div className={`flex flex-col gap-0 ${className}`}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 bg-navy-800 border border-smoke-700 rounded-t-md px-1.5 py-1">
        <ToolBtn
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Bold"
        >
          <Bold size={12} />
        </ToolBtn>
        <ToolBtn
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Italic"
        >
          <Italic size={12} />
        </ToolBtn>
        <ToolBtn
          active={editor.isActive("underline")}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          title="Underline"
        >
          <UnderlineIcon size={12} />
        </ToolBtn>
        <ToolBtn
          active={editor.isActive("strike")}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          title="Strikethrough"
        >
          <Strikethrough size={12} />
        </ToolBtn>

        <div className="w-px h-4 bg-smoke-700 mx-0.5" />

        <ToolBtn
          active={editor.isActive("link")}
          onClick={setLink}
          title="Link"
        >
          <LinkIcon size={12} />
        </ToolBtn>
        <ToolBtn
          active={editor.isActive("highlight")}
          onClick={() => editor.chain().focus().toggleHighlight().run()}
          title="Highlight"
        >
          <Highlighter size={12} />
        </ToolBtn>

        {/* Color picker */}
        <div className="relative group">
          <button
            className="p-1 rounded text-smoke-400 hover:text-smoke-100 hover:bg-navy-700 transition-colors"
            title="Text color"
            type="button"
          >
            <Palette size={12} />
          </button>
          <div className="absolute top-full left-0 z-50 hidden group-hover:flex flex-wrap gap-1 bg-navy-800 border border-smoke-700 rounded p-1.5 shadow-xl w-[90px]">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className="w-4 h-4 rounded-sm border border-smoke-600 hover:scale-110 transition-transform"
                style={{ backgroundColor: c }}
                onClick={() => editor.chain().focus().setColor(c).run()}
              />
            ))}
          </div>
        </div>

        {/* Font family */}
        <select
          className="bg-navy-700 border border-smoke-700 text-smoke-300 text-[10px] rounded px-1 py-0.5 ml-0.5 focus:outline-none"
          onChange={(e) => {
            if (e.target.value === "Default") {
              editor.chain().focus().unsetFontFamily().run()
            } else {
              editor.chain().focus().setFontFamily(e.target.value).run()
            }
          }}
          defaultValue="Default"
        >
          {FONT_FAMILIES.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>

        <div className="w-px h-4 bg-smoke-700 mx-0.5" />

        <ToolBtn
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="Bullet list"
        >
          <List size={12} />
        </ToolBtn>
        <ToolBtn
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title="Numbered list"
        >
          <ListOrdered size={12} />
        </ToolBtn>

        <div className="w-px h-4 bg-smoke-700 mx-0.5" />

        <ToolBtn
          active={editor.isActive({ textAlign: "left" })}
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
          title="Align left"
        >
          <AlignLeft size={12} />
        </ToolBtn>
        <ToolBtn
          active={editor.isActive({ textAlign: "center" })}
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
          title="Align center"
        >
          <AlignCenter size={12} />
        </ToolBtn>
        <ToolBtn
          active={editor.isActive({ textAlign: "right" })}
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
          title="Align right"
        >
          <AlignRight size={12} />
        </ToolBtn>
      </div>

      {/* Editor body */}
      <div className="bg-navy-900 border border-t-0 border-smoke-700 rounded-b-md relative">
        {!editor.getText() && (
          <span className="absolute left-2 top-1.5 text-smoke-600 text-xs pointer-events-none select-none italic">
            {placeholder}
          </span>
        )}
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}

function ToolBtn({
  children,
  active,
  onClick,
  title,
}: {
  children: React.ReactNode
  active: boolean
  onClick: () => void
  title: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`p-1 rounded transition-colors ${
        active
          ? "bg-navy-600 text-doom-gold"
          : "text-smoke-400 hover:text-smoke-100 hover:bg-navy-700"
      }`}
    >
      {children}
    </button>
  )
}
