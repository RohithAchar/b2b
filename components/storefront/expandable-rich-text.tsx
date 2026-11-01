"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "cn"

/**
 * Server-sanitized product HTML with a collapse/expand control. The HTML is
 * passed as a string from a server component so the interactive shell stays
 * tiny and no parser runs on the client.
 *
 * Whether to show the control is measured from the rendered (clamped) content,
 * so it appears only when the text actually overflows — not from a guessed
 * character count.
 */
export function ExpandableRichText({
  html,
  collapsedClassName = "line-clamp-6",
}: {
  html: string
  collapsedClassName?: string
}) {
  const [expanded, setExpanded] = useState(false)
  const [canExpand, setCanExpand] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (expanded) return
    const element = contentRef.current
    if (!element) return

    const measure = () => {
      setCanExpand(element.scrollHeight > element.clientHeight + 1)
    }
    measure()

    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [expanded, html])

  return (
    <div>
      <div
        ref={contentRef}
        className={cn(
          "prose prose-sm max-w-none text-sm leading-relaxed [&_a]:break-all [&_a]:text-primary [&_a]:underline",
          !expanded && collapsedClassName,
        )}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {canExpand && (
        <Button
          type="button"
          variant="link"
          size="sm"
          className="mt-1 h-auto px-0 font-semibold"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? "View Less" : "View More"}
        </Button>
      )}
    </div>
  )
}
