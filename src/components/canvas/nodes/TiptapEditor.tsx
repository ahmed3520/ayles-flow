import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { useEffect, useRef } from 'react'

type TiptapEditorProps = {
  content: string
  onChange: (html: string) => void
  placeholder?: string
  className?: string
}

export default function TiptapEditor({
  content,
  onChange,
  placeholder,
  className,
}: TiptapEditorProps) {
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChangeRef.current(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class: `nodrag nowheel outline-none h-full overflow-y-auto ${className ?? ''}`,
      },
    },
  })

  // Sync external content changes (e.g. from LLM generation)
  useEffect(() => {
    if (!editor) return
    const current = editor.getHTML()
    if (content !== current) {
      editor.commands.setContent(content || '')
    }
  }, [content, editor])

  return <EditorContent editor={editor} className="h-full [&_.tiptap]:h-full" />
}
