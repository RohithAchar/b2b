"use client";

import { useEffect } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import { cn } from "cn";

function ToolButton({
  label,
  title,
  active,
  disabled,
  onClick,
}: {
  label: string;
  title: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex h-7 items-center justify-center rounded px-1.5 text-xs font-medium transition-colors",
        active
          ? "bg-primary/15 text-primary"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
        disabled && "pointer-events-none opacity-40",
      )}
    >
      {label}
    </button>
  );
}

export function RichTextEditor({
  value,
  onChange,
  id,
  invalid,
  placeholder,
}: {
  value: string;
  onChange: (html: string) => void;
  id?: string;
  invalid?: boolean;
  placeholder?: string;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Link.configure({ openOnClick: false, autolink: true, linkOnPaste: true }),
    ],
    content: value,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: cn(
          "min-h-40 max-h-80 overflow-y-auto px-3 py-2 text-sm outline-none",
          "prose prose-sm max-w-none [&_p.is-editor-empty:first-child::before]:float-left [&_p.is-editor-empty:first-child::before]:h-0 [&_p.is-editor-empty:first-child::before]:text-muted-foreground [&_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]",
        ),
      },
    },
    onUpdate: ({ editor: e }) => onChange(e.getHTML()),
  });

  useEffect(() => {
    if (!editor) return;
    if (editor.getHTML() !== value) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [editor, value]);

  function setLink() {
    if (!editor) return;
    const previousUrl = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Paste a URL (https://…)", previousUrl ?? "");
    if (url === null) return;
    const href = url.trim();
    if (href === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
  }

  function unsetLink() {
    editor?.chain().focus().extendMarkRange("link").unsetLink().run();
  }

  return (
    <div
      id={id}
      data-invalid={invalid ? "true" : undefined}
      className={cn(
        "overflow-hidden rounded-md border border-input bg-input/30 transition-colors",
        "focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50",
        invalid && "border-destructive focus-within:border-destructive focus-within:ring-destructive/20",
      )}
    >
      <div className="flex max-w-full flex-wrap items-center gap-0.5 border-b border-border bg-card/60 px-1.5 py-1">
        <ToolButton label="B" title="Bold" active={editor?.isActive("bold") ?? false} onClick={() => editor?.chain().focus().toggleBold().run()} />
        <ToolButton label="I" title="Italic" active={editor?.isActive("italic") ?? false} onClick={() => editor?.chain().focus().toggleItalic().run()} />
        <ToolButton label="S" title="Strikethrough" active={editor?.isActive("strike") ?? false} onClick={() => editor?.chain().focus().toggleStrike().run()} />
        <span className="mx-0.5 h-4 w-px bg-border" aria-hidden="true" />
        <ToolButton label="H2" title="Heading" active={editor?.isActive("heading", { level: 2 }) ?? false} onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} />
        <ToolButton label="H3" title="Subheading" active={editor?.isActive("heading", { level: 3 }) ?? false} onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()} />
        <ToolButton label="• List" title="Bullet list" active={editor?.isActive("bulletList") ?? false} onClick={() => editor?.chain().focus().toggleBulletList().run()} />
        <ToolButton label="1. List" title="Numbered list" active={editor?.isActive("orderedList") ?? false} onClick={() => editor?.chain().focus().toggleOrderedList().run()} />
        <ToolButton label="❝" title="Quote" active={editor?.isActive("blockquote") ?? false} onClick={() => editor?.chain().focus().toggleBlockquote().run()} />
        <ToolButton label="🔗" title="Link" active={editor?.isActive("link") ?? false} onClick={setLink} />
        <ToolButton label="Unlink" title="Remove link" active={editor?.isActive("link") ?? false} disabled={!(editor?.isActive("link") ?? false)} onClick={unsetLink} />
        <span className="mx-0.5 h-4 w-px bg-border" aria-hidden="true" />
        <ToolButton label="↶" title="Undo" active={false} disabled={!(editor?.can().undo() ?? false)} onClick={() => editor?.chain().focus().undo().run()} />
        <ToolButton label="↷" title="Redo" active={false} disabled={!(editor?.can().redo() ?? false)} onClick={() => editor?.chain().focus().redo().run()} />
      </div>
      <EditorContent
        editor={editor}
        data-placeholder={placeholder ?? "Describe your product — material, sizes, packaging, certifications…"}
      />
    </div>
  );
}