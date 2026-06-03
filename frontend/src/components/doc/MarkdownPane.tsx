import type { RefObject } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'

export function MarkdownPane({
  markdown,
  containerRef,
}: {
  markdown: string
  containerRef: RefObject<HTMLDivElement | null>
}) {
  return (
    <div ref={containerRef} className="prose-doc h-full overflow-auto p-6">
      <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
        {markdown}
      </Markdown>
    </div>
  )
}
