import { jsPDF } from 'jspdf'

type PdfSource = { title: string; url: string }

export async function generateResearchPdf(
  title: string,
  markdown: string,
  sources: Array<PdfSource>,
): Promise<Blob> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 20
  const contentWidth = pageWidth - margin * 2
  let y = margin

  const addPage = () => {
    doc.addPage()
    y = margin
  }

  const checkPage = (needed: number) => {
    if (y + needed > pageHeight - margin) {
      addPage()
    }
  }

  // Strip markdown inline formatting for clean PDF text
  const clean = (text: string) =>
    text
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/`(.*?)`/g, '$1')
      .replace(/\[(.*?)\]\(.*?\)/g, '$1')

  // --- Title ---
  doc.setFontSize(22)
  doc.setFont('helvetica', 'bold')
  const titleLines = doc.splitTextToSize(title, contentWidth)
  checkPage(titleLines.length * 8 + 10)
  doc.text(titleLines, margin, y)
  y += titleLines.length * 8 + 10

  // Divider
  doc.setDrawColor(200, 200, 200)
  doc.line(margin, y, pageWidth - margin, y)
  y += 8

  // --- Parse and render markdown ---
  const lines = markdown.split('\n')

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) {
      y += 3
      continue
    }

    // Skip the top-level title (already rendered)
    if (trimmed.startsWith('# ') && !trimmed.startsWith('## ')) {
      continue
    }

    // ## Heading
    if (trimmed.startsWith('## ')) {
      checkPage(14)
      y += 5
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      const text = clean(trimmed.replace(/^##\s+/, ''))
      const wrapped = doc.splitTextToSize(text, contentWidth)
      doc.text(wrapped, margin, y)
      y += wrapped.length * 6 + 4
      continue
    }

    // ### Sub-heading
    if (trimmed.startsWith('### ')) {
      checkPage(12)
      y += 3
      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      const text = clean(trimmed.replace(/^###\s+/, ''))
      const wrapped = doc.splitTextToSize(text, contentWidth)
      doc.text(wrapped, margin, y)
      y += wrapped.length * 5 + 3
      continue
    }

    // Bullet point
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      const text = clean(trimmed.replace(/^[-*]\s+/, ''))
      const wrapped = doc.splitTextToSize(text, contentWidth - 8)
      checkPage(wrapped.length * 4.5 + 2)
      doc.text('\u2022', margin + 2, y)
      doc.text(wrapped, margin + 8, y)
      y += wrapped.length * 4.5 + 2
      continue
    }

    // Numbered list
    const numberedMatch = trimmed.match(/^(\d+)\.\s+(.+)/)
    if (numberedMatch) {
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      const num = numberedMatch[1]
      const text = clean(numberedMatch[2])
      const wrapped = doc.splitTextToSize(text, contentWidth - 10)
      checkPage(wrapped.length * 4.5 + 2)
      doc.text(`${num}.`, margin + 1, y)
      doc.text(wrapped, margin + 10, y)
      y += wrapped.length * 4.5 + 2
      continue
    }

    // Regular paragraph
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    const text = clean(trimmed)
    const wrapped = doc.splitTextToSize(text, contentWidth)
    checkPage(wrapped.length * 4.5 + 2)
    doc.text(wrapped, margin, y)
    y += wrapped.length * 4.5 + 3
  }

  // --- Sources appendix (if not already in the markdown) ---
  if (sources.length > 0 && !markdown.includes('## Sources')) {
    checkPage(20)
    y += 8
    doc.setDrawColor(200, 200, 200)
    doc.line(margin, y, pageWidth - margin, y)
    y += 6
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('Sources', margin, y)
    y += 7

    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    for (let i = 0; i < sources.length; i++) {
      const s = sources[i]
      const text = `[${i + 1}] ${s.title} — ${s.url}`
      const wrapped = doc.splitTextToSize(text, contentWidth)
      checkPage(wrapped.length * 4 + 2)
      doc.text(wrapped, margin, y)
      y += wrapped.length * 4 + 2
    }
  }

  return doc.output('blob')
}
