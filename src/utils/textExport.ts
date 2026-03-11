import { jsPDF } from 'jspdf'

import {
  isHtmlDocument,
  markdownToRichTextHtml,
  plainTextToRichText,
  richTextToMarkdown,
  richTextToPlainText,
} from '@/utils/nodeTextUtils'

export type TextExportFormat = 'pdf' | 'markdown' | 'document'

type ExportTextDocumentOptions = {
  document: string
  fallbackLabel?: string
  format: TextExportFormat
}

type ExportBlock =
  | { type: 'heading'; level: number; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'blockquote'; text: string }
  | { type: 'code'; text: string }
  | { type: 'list'; ordered: boolean; items: Array<string> }
  | { type: 'divider' }
  | { type: 'image'; alt: string; src: string }

type ImageAsset = {
  dataUrl: string
  height: number
  pngBytes: Uint8Array
  width: number
}

type DocxImagePart = {
  alt: string
  fileName: string
  heightEmu: number
  pngBytes: Uint8Array
  relationshipId: string
  widthEmu: number
}

type ZipEntry = {
  data: Uint8Array
  name: string
}

const PNG_CONTENT_TYPE = 'image/png'
const DOCX_MIME_TYPE =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const XML_CONTENT_TYPE = 'application/xml'
const EMU_PER_PIXEL = 9525
const MAX_DOCX_IMAGE_WIDTH_PX = 640

function sanitizeFileNameSegment(value: string): string {
  return value
    .trim()
    .split('')
    .filter((character) => character.charCodeAt(0) >= 32)
    .join('')
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function getDocumentTitle(document: string, fallbackLabel = 'document'): string {
  const plainText = (
    isHtmlDocument(document) ? richTextToPlainText(document) : document
  ).trim()
  const firstLine = plainText
    .split(/\n+/)
    .map((line) => line.trim())
    .find(Boolean)

  return (firstLine || fallbackLabel || 'document').slice(0, 80)
}

function getDocumentHtml(value: string): string {
  if (isHtmlDocument(value)) return value
  return markdownToRichTextHtml(value) || plainTextToRichText(value)
}

function getExportFileName(title: string, format: TextExportFormat): string {
  const baseName = sanitizeFileNameSegment(title) || 'document'
  switch (format) {
    case 'pdf':
      return `${baseName}.pdf`
    case 'markdown':
      return `${baseName}.md`
    case 'document':
      return `${baseName}.docx`
  }
}

function triggerDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

function parseExportBlocks(documentHtml: string): Array<ExportBlock> {
  const parser = new DOMParser()
  const parsedDocument = parser.parseFromString(documentHtml, 'text/html')

  const collectBlocks = (root: ParentNode): Array<ExportBlock> =>
    Array.from(root.childNodes).flatMap((node) => {
      if (node.nodeType === 3) {
        const text = (node.textContent ?? '').trim()
        return text ? [{ type: 'paragraph', text }] : []
      }

      if (node.nodeType !== 1) return []

      const element = node as HTMLElement
      const tagName = element.tagName.toLowerCase()

      switch (tagName) {
        case 'h1':
        case 'h2':
        case 'h3':
        case 'h4':
        case 'h5':
        case 'h6': {
          const text = richTextToPlainText(element.innerHTML).trim()
          if (!text) return []
          return [
            {
              type: 'heading',
              level: Number.parseInt(tagName.slice(1), 10),
              text,
            },
          ]
        }
        case 'p': {
          const text = richTextToPlainText(element.innerHTML).trim()
          return text ? [{ type: 'paragraph', text }] : []
        }
        case 'blockquote': {
          const text = richTextToPlainText(element.innerHTML).trim()
          return text ? [{ type: 'blockquote', text }] : []
        }
        case 'pre': {
          const text = (element.textContent || '').replace(/\n+$/g, '')
          return text ? [{ type: 'code', text }] : []
        }
        case 'ul':
        case 'ol': {
          const items = Array.from(element.children)
            .filter(
              (child): child is HTMLLIElement =>
                child.tagName.toLowerCase() === 'li',
            )
            .map((item) => richTextToPlainText(item.innerHTML).trim())
            .filter(Boolean)

          return items.length > 0
            ? [{ type: 'list', ordered: tagName === 'ol', items }]
            : []
        }
        case 'hr':
          return [{ type: 'divider' }]
        case 'img': {
          const src = element.getAttribute('src')?.trim()
          if (!src) return []
          return [
            {
              type: 'image',
              alt: element.getAttribute('alt')?.trim() ?? '',
              src,
            },
          ]
        }
        default:
          return collectBlocks(element)
      }
    })

  return collectBlocks(parsedDocument.body)
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
        return
      }
      reject(new Error('Failed to read export image data'))
    }
    reader.onerror = () =>
      reject(reader.error || new Error('Failed to read export image data'))
    reader.readAsDataURL(blob)
  })
}

async function rasterizeImageToPng(blob: Blob): Promise<ImageAsset> {
  const objectUrl = URL.createObjectURL(blob)

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const value = new Image()
      value.onload = () => resolve(value)
      value.onerror = () => reject(new Error('Failed to load export image'))
      value.src = objectUrl
    })

    const width = image.naturalWidth || image.width || 1
    const height = image.naturalHeight || image.height || 1
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')

    if (!context) {
      throw new Error('Failed to prepare export image canvas')
    }

    context.drawImage(image, 0, 0, width, height)

    const pngBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((value) => {
        if (value) {
          resolve(value)
          return
        }
        reject(new Error('Failed to encode export image'))
      }, PNG_CONTENT_TYPE)
    })

    return {
      dataUrl: await blobToDataUrl(pngBlob),
      height,
      pngBytes: new Uint8Array(await pngBlob.arrayBuffer()),
      width,
    }
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

function createImageAssetLoader() {
  const cache = new Map<string, Promise<ImageAsset | null>>()

  return async (src: string): Promise<ImageAsset | null> => {
    if (!cache.has(src)) {
      cache.set(
        src,
        (async () => {
          try {
            const response = await fetch(src)
            if (!response.ok) return null
            return await rasterizeImageToPng(await response.blob())
          } catch {
            return null
          }
        })(),
      )
    }

    return await cache.get(src)!
  }
}

function writePdfTextBlock(
  doc: jsPDF,
  text: string,
  options: {
    checkPage: (needed: number) => number
    contentWidth: number
    fontSize: number
    indent?: number
    margin: number
    spacingAfter: number
    style?: 'bold' | 'normal' | 'italic'
  },
) {
  const {
    checkPage,
    contentWidth,
    fontSize,
    indent = 0,
    margin,
    spacingAfter,
    style = 'normal',
  } = options

  doc.setFontSize(fontSize)
  doc.setFont('helvetica', style)
  const wrapped = doc.splitTextToSize(text, contentWidth - indent)
  const lineHeight = fontSize * 0.45 + 1
  const startY = checkPage(wrapped.length * lineHeight + spacingAfter)
  doc.text(wrapped, margin + indent, startY)
  return startY + wrapped.length * lineHeight + spacingAfter
}

async function generateTextDocumentPdf(
  title: string,
  documentHtml: string,
): Promise<Blob> {
  const doc = new jsPDF({
    format: 'a4',
    orientation: 'portrait',
    unit: 'mm',
  })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 20
  const contentWidth = pageWidth - margin * 2
  const loadImageAsset = createImageAssetLoader()
  const blocks = parseExportBlocks(documentHtml)
  let y = margin
  let skippedTitleHeading = false

  const addPage = () => {
    doc.addPage()
    y = margin
  }

  const checkPage = (needed: number) => {
    if (y + needed > pageHeight - margin) {
      addPage()
    }
    return y
  }

  doc.setFontSize(22)
  doc.setFont('helvetica', 'bold')
  const titleLines = doc.splitTextToSize(title, contentWidth)
  checkPage(titleLines.length * 8 + 10)
  doc.text(titleLines, margin, y)
  y += titleLines.length * 8 + 10

  doc.setDrawColor(200, 200, 200)
  doc.line(margin, y, pageWidth - margin, y)
  y += 8

  for (const block of blocks) {
    if (
      !skippedTitleHeading &&
      block.type === 'heading' &&
      block.level === 1 &&
      block.text.trim() === title.trim()
    ) {
      skippedTitleHeading = true
      continue
    }

    switch (block.type) {
      case 'heading': {
        y += 2
        y = writePdfTextBlock(doc, block.text, {
          checkPage,
          contentWidth,
          fontSize: block.level === 1 ? 18 : block.level === 2 ? 14 : 12,
          margin,
          spacingAfter: 4,
          style: 'bold',
        })
        continue
      }
      case 'paragraph': {
        y = writePdfTextBlock(doc, block.text, {
          checkPage,
          contentWidth,
          fontSize: 10,
          margin,
          spacingAfter: 3,
        })
        continue
      }
      case 'blockquote': {
        y = writePdfTextBlock(doc, block.text, {
          checkPage,
          contentWidth,
          fontSize: 10,
          indent: 6,
          margin,
          spacingAfter: 4,
          style: 'italic',
        })
        continue
      }
      case 'code': {
        doc.setDrawColor(228, 228, 231)
        checkPage(8)
        doc.line(margin, y, margin + contentWidth, y)
        y += 3
        y = writePdfTextBlock(doc, block.text, {
          checkPage,
          contentWidth,
          fontSize: 9,
          indent: 4,
          margin,
          spacingAfter: 4,
        })
        continue
      }
      case 'list': {
        for (let index = 0; index < block.items.length; index += 1) {
          const marker = block.ordered ? `${index + 1}.` : '\u2022'
          doc.setFontSize(10)
          doc.setFont('helvetica', 'normal')
          const wrapped = doc.splitTextToSize(
            block.items[index],
            contentWidth - 10,
          )
          const lineHeight = 5
          checkPage(wrapped.length * lineHeight + 2)
          doc.text(marker, margin + 1, y)
          doc.text(wrapped, margin + 8, y)
          y += wrapped.length * lineHeight + 2
        }
        y += 1
        continue
      }
      case 'divider': {
        checkPage(6)
        doc.setDrawColor(220, 220, 220)
        doc.line(margin, y, margin + contentWidth, y)
        y += 6
        continue
      }
      case 'image': {
        const asset = await loadImageAsset(block.src)
        if (!asset) {
          const fallbackText = block.alt || block.src
          y = writePdfTextBlock(doc, `[Image] ${fallbackText}`, {
            checkPage,
            contentWidth,
            fontSize: 10,
            margin,
            spacingAfter: 3,
            style: 'italic',
          })
          continue
        }

        const maxWidth = contentWidth
        const pixelToMm = 25.4 / 96
        const naturalWidth = asset.width * pixelToMm
        const naturalHeight = asset.height * pixelToMm
        const scale = Math.min(1, maxWidth / naturalWidth)
        const width = naturalWidth * scale
        const height = naturalHeight * scale
        checkPage(height + 6)
        doc.addImage(asset.dataUrl, 'PNG', margin, y, width, height)
        y += height + 6
        continue
      }
    }
  }

  return doc.output('blob')
}

function escapeXmlText(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function escapeXmlAttribute(value: string): string {
  return escapeXmlText(value)
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function textToRunsXml(
  text: string,
  options?: { code?: boolean; italic?: boolean },
): string {
  const lines = text.split('\n')
  const runProperties = [
    options?.code
      ? '<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" w:cs="Consolas"/>'
      : '',
    options?.code ? '<w:sz w:val="20"/>' : '',
    options?.italic ? '<w:i/>' : '',
  ]
    .filter(Boolean)
    .join('')
  const rPr = runProperties ? `<w:rPr>${runProperties}</w:rPr>` : ''

  return lines
    .map((line, index) => {
      const run = `<w:r>${rPr}<w:t xml:space="preserve">${escapeXmlText(line)}</w:t></w:r>`
      return index === 0 ? run : `<w:r><w:br/></w:r>${run}`
    })
    .join('')
}

function buildParagraphXml(
  text: string,
  options?: {
    borderBottom?: boolean
    code?: boolean
    indentLeft?: number
    indentRight?: number
    italic?: boolean
    styleId?: string
  },
): string {
  const paragraphProperties: Array<string> = []

  if (options?.styleId) {
    paragraphProperties.push(
      `<w:pStyle w:val="${escapeXmlAttribute(options.styleId)}"/>`,
    )
  }

  if (
    typeof options?.indentLeft === 'number' ||
    typeof options?.indentRight === 'number'
  ) {
    paragraphProperties.push(
      `<w:ind${
        typeof options.indentLeft === 'number'
          ? ` w:left="${options.indentLeft}"`
          : ''
      }${
        typeof options.indentRight === 'number'
          ? ` w:right="${options.indentRight}"`
          : ''
      }/>`,
    )
  }

  if (options?.borderBottom) {
    paragraphProperties.push(
      '<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="D4D4D8"/></w:pBdr>',
    )
  }

  const pPr = paragraphProperties.length
    ? `<w:pPr>${paragraphProperties.join('')}</w:pPr>`
    : ''

  return `<w:p>${pPr}${textToRunsXml(text, {
    code: options?.code,
    italic: options?.italic,
  })}</w:p>`
}

function buildImageParagraphXml(
  image: DocxImagePart,
  index: number,
): string {
  const escapedAlt = escapeXmlAttribute(image.alt)
  const pictureName = `Image ${index + 1}`
  const objectId = index + 1

  return `<w:p><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${image.widthEmu}" cy="${image.heightEmu}"/><wp:docPr id="${objectId}" name="${pictureName}" descr="${escapedAlt}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="${objectId}" name="${pictureName}" descr="${escapedAlt}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${image.relationshipId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${image.widthEmu}" cy="${image.heightEmu}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`
}

function buildStylesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>
        <w:sz w:val="24"/>
        <w:szCs w:val="24"/>
      </w:rPr>
    </w:rPrDefault>
    <w:pPrDefault>
      <w:pPr>
        <w:spacing w:after="160"/>
      </w:pPr>
    </w:pPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:qFormat/>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Title">
    <w:name w:val="Title"/>
    <w:basedOn w:val="Normal"/>
    <w:qFormat/>
    <w:pPr>
      <w:spacing w:before="0" w:after="240"/>
    </w:pPr>
    <w:rPr>
      <w:b/>
      <w:sz w:val="36"/>
      <w:szCs w:val="36"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:basedOn w:val="Normal"/>
    <w:qFormat/>
    <w:pPr>
      <w:spacing w:before="280" w:after="120"/>
    </w:pPr>
    <w:rPr>
      <w:b/>
      <w:sz w:val="32"/>
      <w:szCs w:val="32"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="heading 2"/>
    <w:basedOn w:val="Normal"/>
    <w:qFormat/>
    <w:pPr>
      <w:spacing w:before="240" w:after="100"/>
    </w:pPr>
    <w:rPr>
      <w:b/>
      <w:sz w:val="28"/>
      <w:szCs w:val="28"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading3">
    <w:name w:val="heading 3"/>
    <w:basedOn w:val="Normal"/>
    <w:qFormat/>
    <w:pPr>
      <w:spacing w:before="220" w:after="90"/>
    </w:pPr>
    <w:rPr>
      <w:b/>
      <w:sz w:val="24"/>
      <w:szCs w:val="24"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Quote">
    <w:name w:val="Quote"/>
    <w:basedOn w:val="Normal"/>
    <w:pPr>
      <w:ind w:left="720" w:right="240"/>
      <w:spacing w:before="80" w:after="180"/>
    </w:pPr>
    <w:rPr>
      <w:i/>
      <w:color w:val="3F3F46"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="CodeBlock">
    <w:name w:val="Code Block"/>
    <w:basedOn w:val="Normal"/>
    <w:pPr>
      <w:ind w:left="360" w:right="120"/>
      <w:spacing w:before="80" w:after="180"/>
      <w:shd w:val="clear" w:color="auto" w:fill="F4F4F5"/>
    </w:pPr>
    <w:rPr>
      <w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" w:cs="Consolas"/>
      <w:sz w:val="20"/>
      <w:szCs w:val="20"/>
    </w:rPr>
  </w:style>
</w:styles>`
}

function buildContentTypesXml(imageCount: number): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="${XML_CONTENT_TYPE}"/>
  ${
    imageCount > 0
      ? `<Default Extension="png" ContentType="${PNG_CONTENT_TYPE}"/>`
      : ''
  }
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`
}

function buildRootRelationshipsXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`
}

function buildDocumentRelationshipsXml(images: Array<DocxImagePart>): string {
  const imageRelationships = images
    .map(
      (image, index) =>
        `<Relationship Id="${image.relationshipId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image${
          index + 1
        }.png"/>`,
    )
    .join('')

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  ${imageRelationships}
</Relationships>`
}

function buildAppPropertiesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Ayles Flow</Application>
</Properties>`
}

function buildCorePropertiesXml(title: string): string {
  const timestamp = new Date().toISOString()
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>${escapeXmlText(title)}</dc:title>
  <dc:creator>Ayles Flow</dc:creator>
  <cp:lastModifiedBy>Ayles Flow</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">${timestamp}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${timestamp}</dcterms:modified>
</cp:coreProperties>`
}

function buildDocumentXml(
  title: string,
  blocks: Array<ExportBlock>,
  images: Array<DocxImagePart>,
): string {
  const bodyParts: Array<string> = [
    buildParagraphXml(title, { styleId: 'Title' }),
  ]
  let skippedTitleHeading = false
  let imageIndex = 0

  for (const block of blocks) {
    if (
      !skippedTitleHeading &&
      block.type === 'heading' &&
      block.level === 1 &&
      block.text.trim() === title.trim()
    ) {
      skippedTitleHeading = true
      continue
    }

    switch (block.type) {
      case 'heading':
        bodyParts.push(
          buildParagraphXml(block.text, {
            styleId: block.level <= 1 ? 'Heading1' : block.level === 2 ? 'Heading2' : 'Heading3',
          }),
        )
        continue
      case 'paragraph':
        bodyParts.push(buildParagraphXml(block.text))
        continue
      case 'blockquote':
        bodyParts.push(buildParagraphXml(block.text, { styleId: 'Quote' }))
        continue
      case 'code':
        bodyParts.push(
          buildParagraphXml(block.text, {
            code: true,
            styleId: 'CodeBlock',
          }),
        )
        continue
      case 'list':
        for (let index = 0; index < block.items.length; index += 1) {
          const marker = block.ordered ? `${index + 1}. ` : '• '
          bodyParts.push(
            buildParagraphXml(`${marker}${block.items[index]}`, {
              indentLeft: 360,
            }),
          )
        }
        continue
      case 'divider':
        bodyParts.push(buildParagraphXml('', { borderBottom: true }))
        continue
      case 'image': {
        const image = images.at(imageIndex)
        if (image) {
          bodyParts.push(buildImageParagraphXml(image, imageIndex))
          imageIndex += 1
        } else {
          bodyParts.push(
            buildParagraphXml(`[Image] ${block.alt || block.src}`, {
              italic: true,
            }),
          )
        }
        continue
      }
    }
  }

  bodyParts.push(
    '<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr>',
  )

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
  <w:body>${bodyParts.join('')}</w:body>
</w:document>`
}

const textEncoder = new TextEncoder()

function encodeUtf8(value: string): Uint8Array {
  return textEncoder.encode(value)
}

function createCrc32Table() {
  const table = new Uint32Array(256)

  for (let index = 0; index < 256; index += 1) {
    let value = index
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) === 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
    }
    table[index] = value >>> 0
  }

  return table
}

const crc32Table = createCrc32Table()

function getCrc32(bytes: Uint8Array): number {
  let crc = 0xffffffff

  for (const value of bytes) {
    crc = crc32Table[(crc ^ value) & 0xff] ^ (crc >>> 8)
  }

  return (crc ^ 0xffffffff) >>> 0
}

function getDosDateTime(date = new Date()) {
  const year = Math.max(date.getFullYear(), 1980)
  return {
    date:
      ((year - 1980) << 9) |
      ((date.getMonth() + 1) << 5) |
      date.getDate(),
    time:
      (date.getHours() << 11) |
      (date.getMinutes() << 5) |
      Math.floor(date.getSeconds() / 2),
  }
}

function writeUint16(view: DataView, offset: number, value: number) {
  view.setUint16(offset, value, true)
}

function writeUint32(view: DataView, offset: number, value: number) {
  view.setUint32(offset, value >>> 0, true)
}

function concatUint8Arrays(parts: Array<Uint8Array>): Uint8Array {
  const totalLength = parts.reduce((sum, part) => sum + part.length, 0)
  const result = new Uint8Array(totalLength)
  let offset = 0

  for (const part of parts) {
    result.set(part, offset)
    offset += part.length
  }

  return result
}

function buildStoredZip(entries: Array<ZipEntry>): Uint8Array {
  const now = getDosDateTime()
  const localParts: Array<Uint8Array> = []
  const centralParts: Array<Uint8Array> = []
  let offset = 0

  for (const entry of entries) {
    const nameBytes = encodeUtf8(entry.name)
    const data = entry.data
    const crc32 = getCrc32(data)

    const localHeader = new Uint8Array(30 + nameBytes.length)
    const localView = new DataView(localHeader.buffer)
    writeUint32(localView, 0, 0x04034b50)
    writeUint16(localView, 4, 20)
    writeUint16(localView, 6, 0)
    writeUint16(localView, 8, 0)
    writeUint16(localView, 10, now.time)
    writeUint16(localView, 12, now.date)
    writeUint32(localView, 14, crc32)
    writeUint32(localView, 18, data.length)
    writeUint32(localView, 22, data.length)
    writeUint16(localView, 26, nameBytes.length)
    writeUint16(localView, 28, 0)
    localHeader.set(nameBytes, 30)
    localParts.push(localHeader, data)

    const centralHeader = new Uint8Array(46 + nameBytes.length)
    const centralView = new DataView(centralHeader.buffer)
    writeUint32(centralView, 0, 0x02014b50)
    writeUint16(centralView, 4, 20)
    writeUint16(centralView, 6, 20)
    writeUint16(centralView, 8, 0)
    writeUint16(centralView, 10, 0)
    writeUint16(centralView, 12, now.time)
    writeUint16(centralView, 14, now.date)
    writeUint32(centralView, 16, crc32)
    writeUint32(centralView, 20, data.length)
    writeUint32(centralView, 24, data.length)
    writeUint16(centralView, 28, nameBytes.length)
    writeUint16(centralView, 30, 0)
    writeUint16(centralView, 32, 0)
    writeUint16(centralView, 34, 0)
    writeUint16(centralView, 36, 0)
    writeUint32(centralView, 38, 0)
    writeUint32(centralView, 42, offset)
    centralHeader.set(nameBytes, 46)
    centralParts.push(centralHeader)

    offset += localHeader.length + data.length
  }

  const centralDirectory = concatUint8Arrays(centralParts)
  const localDirectory = concatUint8Arrays(localParts)
  const endOfCentralDirectory = new Uint8Array(22)
  const endView = new DataView(endOfCentralDirectory.buffer)
  writeUint32(endView, 0, 0x06054b50)
  writeUint16(endView, 4, 0)
  writeUint16(endView, 6, 0)
  writeUint16(endView, 8, entries.length)
  writeUint16(endView, 10, entries.length)
  writeUint32(endView, 12, centralDirectory.length)
  writeUint32(endView, 16, localDirectory.length)
  writeUint16(endView, 20, 0)

  return concatUint8Arrays([
    localDirectory,
    centralDirectory,
    endOfCentralDirectory,
  ])
}

export async function createDocxDocument(
  title: string,
  documentHtml: string,
): Promise<Blob> {
  const loadImageAsset = createImageAssetLoader()
  const blocks = parseExportBlocks(documentHtml)
  const images: Array<DocxImagePart> = []

  for (const block of blocks) {
    if (block.type !== 'image') continue

    const asset = await loadImageAsset(block.src)
    if (!asset) continue

    const scale = Math.min(1, MAX_DOCX_IMAGE_WIDTH_PX / asset.width)
    images.push({
      alt: block.alt,
      fileName: `image${images.length + 1}.png`,
      heightEmu: Math.round(asset.height * scale * EMU_PER_PIXEL),
      pngBytes: asset.pngBytes,
      relationshipId: `rId${images.length + 2}`,
      widthEmu: Math.round(asset.width * scale * EMU_PER_PIXEL),
    })
  }

  const zipEntries: Array<ZipEntry> = [
    {
      data: encodeUtf8(buildContentTypesXml(images.length)),
      name: '[Content_Types].xml',
    },
    {
      data: encodeUtf8(buildRootRelationshipsXml()),
      name: '_rels/.rels',
    },
    {
      data: encodeUtf8(buildAppPropertiesXml()),
      name: 'docProps/app.xml',
    },
    {
      data: encodeUtf8(buildCorePropertiesXml(title)),
      name: 'docProps/core.xml',
    },
    {
      data: encodeUtf8(buildDocumentXml(title, blocks, images)),
      name: 'word/document.xml',
    },
    {
      data: encodeUtf8(buildDocumentRelationshipsXml(images)),
      name: 'word/_rels/document.xml.rels',
    },
    {
      data: encodeUtf8(buildStylesXml()),
      name: 'word/styles.xml',
    },
    ...images.map((image) => ({
      data: image.pngBytes,
      name: `word/media/${image.fileName}`,
    })),
  ]

  const zipBytes = buildStoredZip(zipEntries)
  return new Blob([zipBytes], { type: DOCX_MIME_TYPE })
}

export async function exportTextDocument({
  document,
  fallbackLabel,
  format,
}: ExportTextDocumentOptions): Promise<void> {
  const title = getDocumentTitle(document, fallbackLabel)
  const fileName = getExportFileName(title, format)
  const documentHtml = getDocumentHtml(document)

  switch (format) {
    case 'pdf': {
      const pdfBlob = await generateTextDocumentPdf(title, documentHtml)
      triggerDownload(pdfBlob, fileName)
      return
    }
    case 'markdown': {
      const markdown = richTextToMarkdown(document)
      triggerDownload(
        new Blob([markdown], { type: 'text/markdown;charset=utf-8' }),
        fileName,
      )
      return
    }
    case 'document': {
      const docxBlob = await createDocxDocument(title, documentHtml)
      triggerDownload(docxBlob, fileName)
    }
  }
}
