export type ShapePoint = { x: number; y: number }

export function computeCentroid(points: ShapePoint[]): ShapePoint {
  if (points.length === 0) return { x: 0.5, y: 0.5 }
  return {
    x: points.reduce((s, p) => s + p.x, 0) / points.length,
    y: points.reduce((s, p) => s + p.y, 0) / points.length,
  }
}

export function pathToPoints(path: string | null): ShapePoint[] {
  if (!path) return []
  const matches = [...path.matchAll(/[ML]\s*([\d.]+)\s+([\d.]+)/g)]
  return matches.map((m) => ({ x: parseFloat(m[1]), y: parseFloat(m[2]) }))
}

/**
 * Cardinal spline through closed polygon points.
 * smoothing 0 = straight edges, 100 = Catmull-Rom-like curves.
 * scaleX/scaleY let you output pixel coords for SVG canvas rendering;
 * defaults (1,1) produce objectBoundingBox coords for clip-path use.
 */
export function smoothedPath(
  points: ShapePoint[],
  smoothing: number,
  scaleX = 1,
  scaleY = 1,
): string {
  if (points.length < 3) return ""
  const s = (smoothing / 100) * 0.5
  const n = points.length
  const fx = (x: number) => (x * scaleX).toFixed(5)
  const fy = (y: number) => (y * scaleY).toFixed(5)

  let d = `M ${fx(points[0].x)} ${fy(points[0].y)}`

  for (let i = 0; i < n; i++) {
    const prev = points[(i - 1 + n) % n]
    const curr = points[i]
    const next = points[(i + 1) % n]
    const nn   = points[(i + 2) % n]

    const cp1x = curr.x + (next.x - prev.x) * s
    const cp1y = curr.y + (next.y - prev.y) * s
    const cp2x = next.x - (nn.x - curr.x) * s
    const cp2y = next.y - (nn.y - curr.y) * s

    d += ` C ${fx(cp1x)},${fy(cp1y)} ${fx(cp2x)},${fy(cp2y)} ${fx(next.x)},${fy(next.y)}`
  }

  return d + " Z"
}
