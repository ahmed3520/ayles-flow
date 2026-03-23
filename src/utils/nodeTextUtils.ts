import type { BlockNodeData } from '@/types/nodes'

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function applyInlineMarkdown(value: string): string {
  const codeTokens: Array<string> = []
  let html = escapeHtml(value)

  html = html.replace(/`([^`]+)`/g, (_, content: string) => {
    const token = `__CODE_TOKEN_${codeTokens.length}__`
    codeTokens.push(`<code>${content}</code>`)
    return token
  })

  html = html
    .replace(
      /\[([^\]]+)\]\(((?:https?:\/\/|\/|mailto:)[^\s)]+)\)/g,
      '<a href="$2">$1</a>',
    )
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_]+)__/g, '<strong>$1</strong>')
    .replace(/(^|[^\w])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>')
    .replace(/(^|[^\w])_([^_\n]+)_(?!_)/g, '$1<em>$2</em>')

  return codeTokens.reduce(
    (current, token, index) =>
      current.replace(`__CODE_TOKEN_${index}__`, token),
    html,
  )
}

function wrapParagraph(lines: Array<string>): string {
  return `<p>${applyInlineMarkdown(lines.join('\n')).replace(/\n/g, '<br>')}</p>`
}

export function isHtmlDocument(value: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(value)
}

export function richTextToPlainText(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h1|h2|h3|blockquote)>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li>/gi, '- ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .trim()
}

function escapeMarkdownText(value: string): string {
  return value
    .replaceAll('\\', '\\\\')
    .replace(/([*_`[\]])/g, '\\$1')
}

function normalizeInlineMarkdown(value: string): string {
  return value
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
}

function renderInlineMarkdown(node: ChildNode): string {
  if (node.nodeType === 3) {
    return escapeMarkdownText(node.textContent ?? '')
  }

  if (node.nodeType !== 1) return ''

  const element = node as HTMLElement
  const tagName = element.tagName.toLowerCase()
  const content = normalizeInlineMarkdown(
    Array.from(element.childNodes).map(renderInlineMarkdown).join(''),
  )

  switch (tagName) {
    case 'br':
      return '\n'
    case 'strong':
    case 'b':
      return content.trim() ? `**${content.trim()}**` : ''
    case 'em':
    case 'i':
      return content.trim() ? `*${content.trim()}*` : ''
    case 'code':
      return element.parentElement?.tagName.toLowerCase() === 'pre'
        ? content
        : `\`${element.textContent.replaceAll('`', '\\`')}\``
    case 'a': {
      const href = element.getAttribute('href')?.trim()
      if (!href) return content
      const label = content.trim() || href
      return `[${label}](${href})`
    }
    case 'img': {
      const src = element.getAttribute('src')?.trim()
      if (!src) return ''
      const alt = escapeMarkdownText(element.getAttribute('alt')?.trim() ?? '')
      return `![${alt}](${src})`
    }
    default:
      return content
  }
}

function renderInlineMarkdownNodes(nodes: Array<ChildNode>): string {
  return normalizeInlineMarkdown(nodes.map(renderInlineMarkdown).join(''))
}

function renderListItemMarkdown(
  item: HTMLLIElement,
  marker: string,
  depth: number,
): string {
  const contentParts: Array<string> = []
  const nestedParts: Array<string> = []
  let inlineBuffer: Array<ChildNode> = []

  const flushInlineBuffer = () => {
    if (inlineBuffer.length === 0) return
    const inlineContent = renderInlineMarkdownNodes(inlineBuffer).trim()
    if (inlineContent) {
      contentParts.push(inlineContent)
    }
    inlineBuffer = []
  }

  for (const child of Array.from(item.childNodes)) {
    if (child.nodeType === 1) {
      const element = child as HTMLElement
      const tagName = element.tagName.toLowerCase()

      if (tagName === 'ul' || tagName === 'ol') {
        flushInlineBuffer()
        const nestedList = renderListMarkdown(
          element,
          tagName === 'ol',
          depth + 1,
        ).trimEnd()
        if (nestedList) {
          nestedParts.push(nestedList)
        }
        continue
      }

      if (tagName === 'p' || tagName === 'div') {
        flushInlineBuffer()
        const blockContent = renderInlineMarkdownNodes(
          Array.from(element.childNodes),
        ).trim()
        if (blockContent) {
          contentParts.push(blockContent)
        }
        continue
      }

      if (
        tagName === 'blockquote' ||
        tagName === 'pre' ||
        tagName === 'hr' ||
        tagName === 'img'
      ) {
        flushInlineBuffer()
        const blockContent = renderBlockMarkdown(child).trim()
        if (blockContent) {
          contentParts.push(blockContent)
        }
        continue
      }
    }

    inlineBuffer.push(child)
  }

  flushInlineBuffer()

  const indent = '  '.repeat(depth)
  const text = contentParts.join('\n').trim() || ' '
  const lines = text.split('\n')
  const content = lines
    .map((line, index) =>
      index === 0 ? `${indent}${marker} ${line}` : `${indent}  ${line}`,
    )
    .join('\n')

  return [content, ...nestedParts].filter(Boolean).join('\n')
}

function renderListMarkdown(
  element: HTMLElement,
  ordered: boolean,
  depth = 0,
): string {
  const items = Array.from(element.children).filter(
    (child): child is HTMLLIElement => child.tagName.toLowerCase() === 'li',
  )
  if (items.length === 0) return ''

  return `${items
    .map((item, index) =>
      renderListItemMarkdown(item, ordered ? `${index + 1}.` : '-', depth),
    )
    .join('\n')}\n`
}

function normalizeMarkdownTableCell(value: string): string {
  return value
    .replace(/\n+/g, ' ')
    .replace(/\|/g, '\\|')
    .trim()
}

function renderMarkdownTableRow(cells: Array<string>): string {
  return `| ${cells.map(normalizeMarkdownTableCell).join(' | ')} |`
}

function extractTableRowCells(row: HTMLTableRowElement): Array<string> {
  return Array.from(row.cells).map((cell) =>
    renderInlineMarkdownNodes(Array.from(cell.childNodes)).trim(),
  )
}

function renderTableMarkdown(element: HTMLElement): string {
  const headRows = Array.from(element.querySelectorAll('thead tr')).map(
    (row) => extractTableRowCells(row),
  )
  const bodyRows = Array.from(element.querySelectorAll('tbody tr')).map(
    (row) => extractTableRowCells(row),
  )

  const fallbackRows =
    headRows.length === 0 && bodyRows.length === 0
      ? Array.from(element.querySelectorAll('tr')).map((row) =>
          extractTableRowCells(row),
        )
      : []

  const rows = [...headRows, ...bodyRows, ...fallbackRows].filter(
    (row) => row.length > 0,
  )
  if (rows.length === 0) return ''

  const header = rows[0]
  const body = rows.slice(1)
  const separator = header.map(() => '---')

  const lines = [
    renderMarkdownTableRow(header),
    renderMarkdownTableRow(separator),
    ...body.map((row) => renderMarkdownTableRow(row)),
  ]

  return `${lines.join('\n')}\n\n`
}

function renderBlockMarkdown(node: ChildNode): string {
  if (node.nodeType === 3) {
    const text = escapeMarkdownText(node.textContent?.trim() ?? '')
    return text ? `${text}\n\n` : ''
  }

  if (node.nodeType !== 1) return ''

  const element = node as HTMLElement
  const tagName = element.tagName.toLowerCase()

  switch (tagName) {
    case 'h1':
    case 'h2':
    case 'h3':
    case 'h4':
    case 'h5':
    case 'h6': {
      const level = Number.parseInt(tagName.slice(1), 10)
      const content = renderInlineMarkdownNodes(Array.from(element.childNodes))
        .trim()
      return content ? `${'#'.repeat(level)} ${content}\n\n` : ''
    }
    case 'p': {
      const content = renderInlineMarkdownNodes(Array.from(element.childNodes))
        .trim()
      return content ? `${content}\n\n` : ''
    }
    case 'blockquote': {
      const content = richTextToMarkdown(element.innerHTML)
      if (!content) return ''
      const quoted = content
        .split('\n')
        .map((line) => (line ? `> ${line}` : '>'))
        .join('\n')
      return `${quoted}\n\n`
    }
    case 'ul':
      return `${renderListMarkdown(element, false)}\n`
    case 'ol':
      return `${renderListMarkdown(element, true)}\n`
    case 'table':
      return renderTableMarkdown(element)
    case 'pre': {
      const codeElement = element.querySelector('code')
      const language =
        codeElement?.className.match(/language-([\w-]+)/)?.[1] ?? ''
      const content = (codeElement?.textContent || element.textContent)
        .replace(/\n+$/g, '')
      return `\`\`\`${language}\n${content}\n\`\`\`\n\n`
    }
    case 'hr':
      return '---\n\n'
    case 'img': {
      const content = renderInlineMarkdown(element)
      return content ? `${content}\n\n` : ''
    }
    default: {
      const content = Array.from(element.childNodes)
        .map(renderBlockMarkdown)
        .join('')
      if (content) return content

      const inlineContent = renderInlineMarkdownNodes(
        Array.from(element.childNodes),
      ).trim()
      return inlineContent ? `${inlineContent}\n\n` : ''
    }
  }
}

export function richTextToMarkdown(value: string): string {
  const normalizedValue = value.replace(/\r\n/g, '\n').trim()
  if (!normalizedValue) return ''
  if (!isHtmlDocument(normalizedValue)) return normalizedValue

  const parser = new DOMParser()
  const document = parser.parseFromString(normalizedValue, 'text/html')
  return Array.from(document.body.childNodes)
    .map(renderBlockMarkdown)
    .join('')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function markdownToRichTextHtml(value: string): string {
  const markdown = value.replace(/\r\n/g, '\n').trim()
  if (!markdown) return ''

  const html: Array<string> = []
  const lines = markdown.split('\n')

  let paragraph: Array<string> = []
  let listItems: Array<string> = []
  let orderedItems: Array<string> = []
  let quoteLines: Array<string> = []
  let codeLines: Array<string> = []
  let inCodeBlock = false

  const parseMarkdownTableCells = (rawLine: string): Array<string> => {
    let line = rawLine.trim()
    if (!line.includes('|')) return []
    if (line.startsWith('|')) line = line.slice(1)
    if (line.endsWith('|')) line = line.slice(0, -1)
    return line.split('|').map((cell) => applyInlineMarkdown(cell.trim()))
  }

  const isMarkdownTableSeparator = (rawLine: string): boolean => {
    let line = rawLine.trim()
    if (!line.includes('|')) return false
    if (line.startsWith('|')) line = line.slice(1)
    if (line.endsWith('|')) line = line.slice(0, -1)

    const parts = line.split('|').map((part) => part.trim())
    if (parts.length === 0) return false
    return parts.every((part) => /^:?-{3,}:?$/.test(part))
  }

  const flushParagraph = () => {
    if (paragraph.length === 0) return
    html.push(wrapParagraph(paragraph))
    paragraph = []
  }

  const flushBulletList = () => {
    if (listItems.length === 0) return
    html.push(
      `<ul>${listItems.map((item) => `<li>${applyInlineMarkdown(item)}</li>`).join('')}</ul>`,
    )
    listItems = []
  }

  const flushOrderedList = () => {
    if (orderedItems.length === 0) return
    html.push(
      `<ol>${orderedItems.map((item) => `<li>${applyInlineMarkdown(item)}</li>`).join('')}</ol>`,
    )
    orderedItems = []
  }

  const flushQuote = () => {
    if (quoteLines.length === 0) return
    html.push(
      `<blockquote>${quoteLines.map((line) => wrapParagraph([line])).join('')}</blockquote>`,
    )
    quoteLines = []
  }

  const flushCode = () => {
    if (codeLines.length === 0) return
    html.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`)
    codeLines = []
  }

  const flushAll = () => {
    flushParagraph()
    flushBulletList()
    flushOrderedList()
    flushQuote()
  }

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]
    const trimmed = line.trim()

    if (trimmed.startsWith('```')) {
      flushAll()
      if (inCodeBlock) {
        flushCode()
        inCodeBlock = false
      } else {
        inCodeBlock = true
      }
      continue
    }

    if (inCodeBlock) {
      codeLines.push(line)
      continue
    }

    if (!trimmed) {
      flushAll()
      continue
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      flushAll()
      html.push('<hr>')
      continue
    }

    const heading = trimmed.match(/^(#{1,3})\s+(.+)$/)
    if (heading) {
      flushAll()
      const level = heading[1].length
      html.push(`<h${level}>${applyInlineMarkdown(heading[2])}</h${level}>`)
      continue
    }

    const ordered = trimmed.match(/^\d+\.\s+(.+)$/)
    if (ordered) {
      flushParagraph()
      flushBulletList()
      flushQuote()
      orderedItems.push(ordered[1])
      continue
    }

    const bullet = trimmed.match(/^[-*]\s+(.+)$/)
    if (bullet) {
      flushParagraph()
      flushOrderedList()
      flushQuote()
      listItems.push(bullet[1])
      continue
    }

    const quote = trimmed.match(/^>\s?(.*)$/)
    if (quote) {
      flushParagraph()
      flushBulletList()
      flushOrderedList()
      quoteLines.push(quote[1])
      continue
    }

    const nextLine = lines[index + 1]?.trim() ?? ''
    if (trimmed.includes('|') && isMarkdownTableSeparator(nextLine)) {
      flushAll()

      const headerCells = parseMarkdownTableCells(line)
      if (headerCells.length === 0) {
        paragraph.push(trimmed)
        continue
      }

      const rowCells: Array<Array<string>> = []
      index += 2

      while (index < lines.length) {
        const rowLine = lines[index]
        const rowTrimmed = rowLine.trim()
        if (
          !rowTrimmed ||
          !rowTrimmed.includes('|') ||
          isMarkdownTableSeparator(rowTrimmed)
        ) {
          break
        }

        const cells = parseMarkdownTableCells(rowLine)
        if (cells.length === 0) break
        rowCells.push(cells)
        index += 1
      }

      index -= 1

      const columnCount = headerCells.length
      const normalizeRow = (cells: Array<string>): Array<string> => {
        if (cells.length === columnCount) return cells
        if (cells.length > columnCount) return cells.slice(0, columnCount)
        return [
          ...cells,
          ...Array.from({ length: columnCount - cells.length }, () => ''),
        ]
      }

      const headerHtml = normalizeRow(headerCells)
        .map((cell) => `<th>${cell || '&nbsp;'}</th>`)
        .join('')
      const bodyHtml = rowCells
        .map(
          (cells) =>
            `<tr>${normalizeRow(cells)
              .map((cell) => `<td>${cell || '&nbsp;'}</td>`)
              .join('')}</tr>`,
        )
        .join('')

      html.push(
        `<table><thead><tr>${headerHtml}</tr></thead>${
          bodyHtml ? `<tbody>${bodyHtml}</tbody>` : ''
        }</table>`,
      )
      continue
    }

    paragraph.push(trimmed)
  }

  if (inCodeBlock) {
    flushCode()
  }

  flushAll()

  return html.join('')
}

export function plainTextToRichText(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''

  return trimmed
    .split(/\n{2,}/)
    .map((paragraph) => {
      const html = escapeHtml(paragraph).replace(/\n/g, '<br>')
      return `<p>${html}</p>`
    })
    .join('')
}

export function createWordDocumentHtml(title: string, value: string): string {
  const content = isHtmlDocument(value)
    ? value
    : markdownToRichTextHtml(value) || plainTextToRichText(value)
  const safeTitle = escapeHtml(title || 'Document')

  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8">
  <title>${safeTitle}</title>
  <!--[if gte mso 9]>
  <xml>
    <w:WordDocument>
      <w:View>Print</w:View>
      <w:Zoom>100</w:Zoom>
      <w:DoNotOptimizeForBrowser/>
    </w:WordDocument>
  </xml>
  <![endif]-->
  <style>
    body {
      font-family: Arial, sans-serif;
      font-size: 12pt;
      line-height: 1.55;
      color: #111827;
      margin: 28pt;
    }
    img {
      max-width: 100%;
      height: auto;
    }
    blockquote {
      border-left: 3px solid #d4d4d8;
      margin: 16pt 0;
      padding-left: 12pt;
      color: #3f3f46;
    }
    pre {
      background: #f4f4f5;
      padding: 10pt;
      border-radius: 6pt;
      overflow: auto;
    }
    code {
      font-family: "SFMono-Regular", Consolas, monospace;
    }
  </style>
</head>
<body>${content}</body>
</html>`
}

export function getNodeReadableText(data: BlockNodeData): string {
  if (data.contentType === 'text') {
    const value = data.resultText ?? data.prompt
    return isHtmlDocument(value) ? richTextToPlainText(value) : value
  }

  if (data.contentType === 'note' || data.contentType === 'ticket') {
    return richTextToPlainText(data.prompt || '')
  }

  return data.prompt || ''
}

export function getTextNodeDocument(data: BlockNodeData): string {
  if (data.contentType !== 'text') return ''
  return data.resultText ?? data.prompt
}

export function replaceNodeDocumentText(
  document: string,
  findText: string,
  replaceText: string,
  replaceAll = false,
): string | null {
  if (!findText) return null
  if (!document.includes(findText)) return null

  if (replaceAll) {
    return document.replaceAll(findText, replaceText)
  }

  return document.replace(findText, replaceText)
}

export function getTextNodeDocumentUpdate(
  value: string,
): Partial<BlockNodeData> {
  const hasContent = isHtmlDocument(value)
    ? Boolean(richTextToPlainText(value).trim())
    : Boolean(value.trim())

  if (hasContent) {
    return {
      generationStatus: 'completed',
      generationId: undefined,
      resultText: value,
      errorMessage: undefined,
    }
  }

  return {
    generationStatus: 'idle',
    generationId: undefined,
    resultText: undefined,
    errorMessage: undefined,
  }
}
