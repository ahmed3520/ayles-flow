import { useEffect, useState } from 'react'

type BlogCoverImageProps = {
  src: string
  alt: string
  className?: string
  paddingClassName?: string
}

function shouldInlineSvg(src: string) {
  return src.startsWith('/') && src.toLowerCase().endsWith('.svg')
}

export default function BlogCoverImage({
  src,
  alt,
  className = '',
  paddingClassName = 'p-6 sm:p-8',
}: BlogCoverImageProps) {
  const [inlineSvg, setInlineSvg] = useState<string | null>(null)
  const [svgLoadFailed, setSvgLoadFailed] = useState(false)

  useEffect(() => {
    if (!shouldInlineSvg(src)) {
      setInlineSvg(null)
      setSvgLoadFailed(false)
      return
    }

    let isCancelled = false
    setSvgLoadFailed(false)

    fetch(src)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to load SVG cover: ${src}`)
        }
        return response.text()
      })
      .then((markup) => {
        if (!isCancelled) {
          setInlineSvg(markup)
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setInlineSvg(null)
          setSvgLoadFailed(true)
        }
      })

    return () => {
      isCancelled = true
    }
  }, [src])

  return (
    <div className={`overflow-hidden bg-white ${className}`.trim()}>
      <div className={`h-full w-full ${paddingClassName}`.trim()}>
        {shouldInlineSvg(src) && inlineSvg ? (
          <div
            role="img"
            aria-label={alt}
            className="h-full w-full [&_svg]:block [&_svg]:h-full [&_svg]:w-full"
            dangerouslySetInnerHTML={{ __html: inlineSvg }}
          />
        ) : shouldInlineSvg(src) && !svgLoadFailed ? (
          <div
            aria-hidden="true"
            className="h-full w-full bg-[#f7f5f2]"
          />
        ) : (
          <img src={src} alt={alt} className="h-full w-full object-cover" />
        )}
      </div>
    </div>
  )
}
