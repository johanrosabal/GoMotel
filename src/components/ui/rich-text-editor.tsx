'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Bold, Italic, Strikethrough, Heading1, Heading2, List, ListOrdered, Quote, Undo, Redo, RemoveFormatting } from 'lucide-react';
import { Button } from './button';

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
}

export function RichTextEditor({ content, onChange }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
    ],
    immediatelyRender: false,
    content,
    editorProps: {
      attributes: {
        class: 'prose prose-invert prose-sm sm:prose-base focus:outline-none max-w-none min-h-[300px] p-4 bg-background border rounded-b-md prose-headings:text-primary prose-a:text-primary hover:prose-a:text-primary/80',
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  if (!editor) {
    return null;
  }

  return (
    <div className="flex flex-col w-full border rounded-md overflow-hidden bg-card">
      <div className="flex flex-wrap items-center gap-1 p-2 bg-muted/50 border-b">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => editor.chain().focus().toggleBold().run()}
          data-active={editor.isActive('bold') ? 'true' : 'false'}
          style={editor.isActive('bold') ? { backgroundColor: 'var(--primary)', color: 'white' } : {}}
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          data-active={editor.isActive('italic') ? 'true' : 'false'}
          style={editor.isActive('italic') ? { backgroundColor: 'var(--primary)', color: 'white' } : {}}
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          data-active={editor.isActive('strike') ? 'true' : 'false'}
          style={editor.isActive('strike') ? { backgroundColor: 'var(--primary)', color: 'white' } : {}}
        >
          <Strikethrough className="h-4 w-4" />
        </Button>
        <div className="w-[1px] h-6 bg-border mx-1" />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          style={editor.isActive('heading', { level: 1 }) ? { backgroundColor: 'var(--primary)', color: 'white' } : {}}
        >
          <Heading1 className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          style={editor.isActive('heading', { level: 2 }) ? { backgroundColor: 'var(--primary)', color: 'white' } : {}}
        >
          <Heading2 className="h-4 w-4" />
        </Button>
        <div className="w-[1px] h-6 bg-border mx-1" />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          style={editor.isActive('bulletList') ? { backgroundColor: 'var(--primary)', color: 'white' } : {}}
        >
          <List className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          style={editor.isActive('orderedList') ? { backgroundColor: 'var(--primary)', color: 'white' } : {}}
        >
          <ListOrdered className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          style={editor.isActive('blockquote') ? { backgroundColor: 'var(--primary)', color: 'white' } : {}}
        >
          <Quote className="h-4 w-4" />
        </Button>
        <div className="w-[1px] h-6 bg-border mx-1" />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}
        >
          <RemoveFormatting className="h-4 w-4" />
        </Button>
        <div className="flex-1" />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
        >
          <Undo className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
        >
          <Redo className="h-4 w-4" />
        </Button>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
