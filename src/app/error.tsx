"use client"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-navy-950 text-smoke-100 p-8">
      <h1 className="text-2xl font-bold text-doom-gold">PlanDoom — Runtime Error</h1>
      <pre className="bg-smoke-900 border border-smoke-700 rounded p-4 text-sm text-red-400 max-w-2xl w-full overflow-auto whitespace-pre-wrap">
        {error.message || "Unknown error"}
        {error.digest ? `\n\nDigest: ${error.digest}` : ""}
      </pre>
      <button
        onClick={reset}
        className="px-4 py-2 bg-navy-700 hover:bg-navy-600 rounded text-sm transition-colors"
      >
        Try again
      </button>
    </div>
  )
}
