import {
  getTextNodeDocumentUpdate,
  isHtmlDocument,
  markdownToRichTextHtml,
} from '@/utils/nodeTextUtils'

export type TextFormat =
  | 'bold'
  | 'italic'
  | 'heading'
  | 'paragraph'
  | 'bullet_list'
  | 'ordered_list'
  | 'blockquote'
  | 'code_block'

export type TextFormatAction = {
  format: TextFormat
  targetText: string
  level?: 1 | 2 | 3
  replaceAll?: boolean
}

function toHtmlDocument(value: string): string {
  if (!value.trim()) return '<p></p>'
  return isHtmlDocument(value) ? value : markdownToRichTextHtml(value)
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function getParserDocument(html: string): Document | null {
  if (typeof DOMParser === 'undefined') return null
  const parser = new DOMParser()
  return parser.parseFromString(`<body>${html}</body>`, 'text/html')
}

function applyInlineFormat(
  doc: Document,
  targetText: string,
  tagName: 'strong' | 'em',
  replaceAll: boolean,
): boolean {
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT)
  const textNodes: Array<Text> = []
  let current = walker.nextNode()

  while (current) {
    if (current.nodeType === Node.TEXT_NODE) {
      textNodes.push(current as Text)
    }
    current = walker.nextNode()
  }

  let changed = false

  for (const originalNode of textNodes) {
    let node = originalNode

    for (;;) {
      const index = node.data.indexOf(targetText)
      if (index === -1) break

      const matchNode = node.splitText(index)
      const afterNode = matchNode.splitText(targetText.length)
      const wrapper = doc.createElement(tagName)
      matchNode.parentNode?.replaceChild(wrapper, matchNode)
      wrapper.appendChild(matchNode)
      changed = true

      if (!replaceAll) return true
      node = afterNode
    }
  }

  return changed
}

function getMatchingBlocks(
  doc: Document,
  targetText: string,
): Array<HTMLElement> {
  const blocks = Array.from(
    doc.body.querySelectorAll<HTMLElement>(
      'p, h1, h2, h3, blockquote, pre, ul, ol',
    ),
  )
  const normalizedTarget = normalizeText(targetText)

  const exact = blocks.filter(
    (element) => normalizeText(element.textContent || '') === normalizedTarget,
  )
  if (exact.length > 0) return exact

  return blocks.filter((element) =>
    normalizeText(element.textContent || '').includes(normalizedTarget),
  )
}

function replaceBlock(
  doc: Document,
  element: HTMLElement,
  action: TextFormatAction,
): boolean {
  const tagName = element.tagName.toLowerCase()

  if (action.format === 'heading') {
    const heading = doc.createElement(`h${action.level ?? 2}`)
    heading.innerHTML = tagName === 'pre' ? element.textContent || '' : element.innerHTML
    element.replaceWith(heading)
    return true
  }

  if (action.format === 'paragraph') {
    const paragraph = doc.createElement('p')
    if (tagName === 'pre' || tagName === 'ul' || tagName === 'ol') {
      paragraph.textContent = element.textContent || ''
    } else {
      paragraph.innerHTML = element.innerHTML
    }
    element.replaceWith(paragraph)
    return true
  }

  if (action.format === 'blockquote') {
    const quote = doc.createElement('blockquote')
    const paragraph = doc.createElement('p')
    paragraph.innerHTML =
      tagName === 'pre' || tagName === 'ul' || tagName === 'ol'
        ? element.textContent || ''
        : element.innerHTML
    quote.appendChild(paragraph)
    element.replaceWith(quote)
    return true
  }

  if (
    action.format === 'bullet_list' ||
    action.format === 'ordered_list'
  ) {
    const list = doc.createElement(
      action.format === 'ordered_list' ? 'ol' : 'ul',
    )

    if (tagName === 'ul' || tagName === 'ol') {
      const items = Array.from(element.querySelectorAll(':scope > li'))
      if (items.length === 0) return false
      for (const item of items) {
        const li = doc.createElement('li')
        li.innerHTML = item.innerHTML
        list.appendChild(li)
      }
    } else {
      const li = doc.createElement('li')
      li.innerHTML =
        tagName === 'pre' ? element.textContent || '' : element.innerHTML
      list.appendChild(li)
    }

    element.replaceWith(list)
    return true
  }

  if (action.format === 'code_block') {
    const pre = doc.createElement('pre')
    const code = doc.createElement('code')
    code.textContent = element.textContent || ''
    pre.appendChild(code)
    element.replaceWith(pre)
    return true
  }

  return false
}

export function formatTextDocument(
  document: string,
  action: TextFormatAction,
): string | null {
  if (!action.targetText.trim()) return null

  const doc = getParserDocument(toHtmlDocument(document))
  if (!doc) return null

  let changed = false

  if (action.format === 'bold' || action.format === 'italic') {
    changed = applyInlineFormat(
      doc,
      action.targetText,
      action.format === 'bold' ? 'strong' : 'em',
      Boolean(action.replaceAll),
    )
  } else {
    const blocks = getMatchingBlocks(doc, action.targetText)
    if (blocks.length === 0) return null

    for (const block of blocks) {
      changed = replaceBlock(doc, block, action) || changed
      if (changed && !action.replaceAll) break
    }
  }

  if (!changed) return null
  return doc.body.innerHTML
}

export function getFormattedTextNodeUpdate(
  document: string,
  action: TextFormatAction,
) {
  const nextDocument = formatTextDocument(document, action)
  if (!nextDocument) return null
  return getTextNodeDocumentUpdate(nextDocument)
}
