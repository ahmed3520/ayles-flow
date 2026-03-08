import { describe, expect, it } from 'vitest'

import {
  createWordDocumentHtml,
  replaceNodeDocumentText,
  richTextToMarkdown,
} from '@/utils/nodeTextUtils'

describe('replaceNodeDocumentText', () => {
  it('replaces the first occurrence by default', () => {
    expect(
      replaceNodeDocumentText('<p>Alpha Beta Beta</p>', 'Beta', 'Gamma'),
    ).toBe('<p>Alpha Gamma Beta</p>')
  })

  it('replaces all occurrences when requested', () => {
    expect(
      replaceNodeDocumentText(
        '<p>Alpha Beta Beta</p>',
        'Beta',
        'Gamma',
        true,
      ),
    ).toBe('<p>Alpha Gamma Gamma</p>')
  })

  it('returns null when the target text is missing', () => {
    expect(
      replaceNodeDocumentText('<p>Alpha Beta</p>', 'Delta', 'Gamma'),
    ).toBeNull()
  })
})

describe('richTextToMarkdown', () => {
  it('converts editor html into markdown', () => {
    expect(
      richTextToMarkdown(
        '<h1>Title</h1><p>Hello <strong>world</strong>.</p><ul><li><p>First</p></li><li><p>Second</p></li></ul><blockquote><p>Quoted</p></blockquote><pre><code>const x = 1;</code></pre><img src="https://example.com/pharaoh.png" alt="Pharaoh" />',
      ),
    ).toBe(
      '# Title\n\nHello **world**.\n\n- First\n- Second\n\n> Quoted\n\n```\nconst x = 1;\n```\n\n![Pharaoh](https://example.com/pharaoh.png)',
    )
  })

  it('passes through non-html content', () => {
    expect(richTextToMarkdown('Plain text content')).toBe('Plain text content')
  })
})

describe('createWordDocumentHtml', () => {
  it('wraps content in a word-compatible html document', () => {
    const documentHtml = createWordDocumentHtml(
      'Ancient <Egypt>',
      '<h1>Pharaohs</h1><p>Story</p>',
    )

    expect(documentHtml).toContain('<!DOCTYPE html>')
    expect(documentHtml).toContain('<title>Ancient &lt;Egypt&gt;</title>')
    expect(documentHtml).toContain('<body><h1>Pharaohs</h1><p>Story</p></body>')
    expect(documentHtml).toContain('urn:schemas-microsoft-com:office:word')
  })
})
