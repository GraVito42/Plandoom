"use client"

interface SeendoPanelProps {
  seendoImages: string[]
  eventId: string | null
}

export default function SeendoPanel({ seendoImages, eventId }: SeendoPanelProps) {
  const images = seendoImages ?? []

  return (
    <div className="flex flex-col gap-3 py-2">
      {images.length === 0 ? (
        <p className="text-xs text-smoke-500">No images attached to this event.</p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {images.map((url, i) => (
            <a key={i} href={url} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`Seendo image ${i + 1}`}
                className="w-full h-20 object-cover rounded border border-smoke-700 hover:border-smoke-500 transition-colors"
              />
            </a>
          ))}
        </div>
      )}

      {!eventId && (
        <p className="text-[10px] text-smoke-600">Save the event first to attach Seendo images.</p>
      )}
    </div>
  )
}
