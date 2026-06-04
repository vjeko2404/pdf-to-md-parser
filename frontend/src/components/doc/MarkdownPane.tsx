import type { RefObject } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'

export function MarkdownPane({
  markdown,
  containerRef,
  editing = false,
  draft = '',
  onDraftChange,
}: {
  markdown: string
  containerRef: RefObject<HTMLDivElement | null>
  /** When true, render an editable textarea over the raw .md instead of the rendered view. */
  editing?: boolean
  draft?: string
  onDraftChange?: (value: string) => void
}) {
  return (
    <div ref={containerRef} className="prose-doc h-full overflow-auto p-6">
      {editing ? (
        // Raw markdown incl. the <a class="blk"> anchors — they're kept so sync-scroll
        // stays aligned. The bloat text sits right under its anchor, easy to delete/fix.
        <textarea
          value={draft}
          onChange={(e) => onDraftChange?.(e.target.value)}
          spellCheck={false}
          autoFocus
          className="block h-full w-full resize-none border-0 bg-transparent font-mono text-xs leading-relaxed text-foreground outline-none"
        />
      ) : (
        <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
          {markdown}
        </Markdown>
      )}
    </div>
  )
}
