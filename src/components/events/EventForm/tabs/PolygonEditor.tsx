"use client"

import { useRef, useState, useLayoutEffect, useEffect } from "react"
import { smoothedPath, computeCentroid } from "@/lib/shapeUtils"

type Point = { x: number; y: number }

function pointsToPath(points: Point[]): string {
  if (points.length < 3) return ""
  return points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(5)} ${p.y.toFixed(5)}`).join(" ") + " Z"
}

function pathToPoints(path: string | null): Point[] {
  if (!path) return []
  return [...path.matchAll(/[ML]\s*([\d.]+)\s+([\d.]+)/g)].map((m) => ({
    x: parseFloat(m[1]),
    y: parseFloat(m[2]),
  }))
}

const HANDLE_R = 6
const STROKE_W = 1.5
const LS_KEY = "plandoom_shape_presets"

// ── Built-in presets ──────────────────────────────────────────────────────────

type BuiltInPreset = { name: string; pts: Point[] }

const BUILT_IN_PRESETS: BuiltInPreset[] = [
  {
    name: "Rectangle",
    pts: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }],
  },
  {
    name: "Rounded",
    pts: [
      { x: 0.05, y: 0 }, { x: 0.95, y: 0 },
      { x: 1, y: 0.08 }, { x: 1, y: 0.92 },
      { x: 0.95, y: 1 }, { x: 0.05, y: 1 },
      { x: 0, y: 0.92 }, { x: 0, y: 0.08 },
    ],
  },
  {
    name: "Pill",
    pts: [
      { x: 0.25, y: 0 }, { x: 0.75, y: 0 },
      { x: 0.93, y: 0.15 }, { x: 1, y: 0.5 }, { x: 0.93, y: 0.85 },
      { x: 0.75, y: 1 }, { x: 0.25, y: 1 },
      { x: 0.07, y: 0.85 }, { x: 0, y: 0.5 }, { x: 0.07, y: 0.15 },
    ],
  },
]

// ── User presets ──────────────────────────────────────────────────────────────

type UserPreset = { id: string; name: string; path: string }

function loadUserPresets(): UserPreset[] {
  try {
    const raw = localStorage.getItem(LS_KEY)
    return raw ? (JSON.parse(raw) as UserPreset[]) : []
  } catch {
    return []
  }
}

function persistUserPresets(presets: UserPreset[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(presets))
}

// ── Thumbnail SVG ─────────────────────────────────────────────────────────────

function ShapeThumbnail({ pts }: { pts: Point[] }) {
  const d = pts.length >= 3 ? smoothedPath(pts, 0) : ""
  if (!d) return <div className="w-9 h-6 rounded bg-smoke-700 shrink-0" />
  return (
    <svg
      width={36}
      height={24}
      viewBox="0 0 1 1"
      preserveAspectRatio="none"
      className="shrink-0 rounded"
      style={{ display: "block" }}
    >
      <path
        d={d}
        fill="rgba(22,45,94,0.9)"
        stroke="#c9a84c"
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

interface PolygonEditorProps {
  shapePath: string | null
  onChange: (path: string | null) => void
  canvasHeight: number
  smoothing: number
  onSmoothing: (v: number) => void
  textPosition: { x: number; y: number } | null
  onTextPosition: (pos: { x: number; y: number } | null) => void
  widthPercent: number
  onWidthPercent: (v: number) => void
  leftOffset: number
  onLeftOffset: (v: number) => void
  // Optional: folder symbol position handle
  folderSymbolPosition?: { x: number; y: number } | null
  onFolderSymbolPosition?: (pos: { x: number; y: number } | null) => void
  folderSymbolIcon?: string | null
  folderSymbolImage?: string | null
  // When true, hides internal user-preset list and "Save as preset" button
  hidePresets?: boolean
}

export default function PolygonEditor({
  shapePath,
  onChange,
  canvasHeight,
  smoothing,
  onSmoothing,
  textPosition,
  onTextPosition,
  widthPercent,
  onWidthPercent,
  leftOffset,
  onLeftOffset,
  folderSymbolPosition,
  onFolderSymbolPosition,
  folderSymbolIcon,
  folderSymbolImage,
  hidePresets = false,
}: PolygonEditorProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [svgW, setSvgW] = useState(220)
  const clampedH = Math.max(48, canvasHeight)

  useLayoutEffect(() => {
    const el = svgRef.current
    if (!el) return
    const obs = new ResizeObserver(([entry]) => setSvgW(entry.contentRect.width))
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const [points, setPoints] = useState<Point[]>(() => pathToPoints(shapePath))
  const [closed, setClosed] = useState(() => !!shapePath)
  const [dragIdx, setDragIdx] = useState<number | null>(null)

  const [userPresets, setUserPresets] = useState<UserPreset[]>([])
  useEffect(() => { setUserPresets(loadUserPresets()) }, [])

  const [savePromptOpen, setSavePromptOpen] = useState(false)
  const [saveName, setSaveName] = useState("")

  // Stale-closure–safe refs
  const pointsRef = useRef(points)
  const closedRef = useRef(closed)
  const ptrCleanupRef = useRef<(() => void) | null>(null)
  const widthCleanupRef = useRef<(() => void) | null>(null)
  const leftCleanupRef = useRef<(() => void) | null>(null)
  const textCleanupRef = useRef<(() => void) | null>(null)
  const symbolCleanupRef = useRef<(() => void) | null>(null)
  useEffect(() => { pointsRef.current = points }, [points])
  useEffect(() => { closedRef.current = closed }, [closed])
  useEffect(() => () => {
    ptrCleanupRef.current?.()
    widthCleanupRef.current?.()
    leftCleanupRef.current?.()
    textCleanupRef.current?.()
    symbolCleanupRef.current?.()
  }, [])

  // ── Preset helpers ────────────────────────────────────────────────────────────

  function applyPresetPoints(pts: Point[]) {
    setPoints(pts)
    setClosed(true)
    onChange(pointsToPath(pts))
    if (!textPosition) onTextPosition(computeCentroid(pts))
  }

  function applyUserPreset(path: string) {
    const pts = pathToPoints(path)
    setPoints(pts)
    setClosed(true)
    onChange(path)
    if (!textPosition) onTextPosition(computeCentroid(pts))
  }

  function handleSaveAsPreset() {
    const name = saveName.trim()
    if (!name || points.length < 3 || !closed) return
    const preset: UserPreset = { id: Date.now().toString(), name, path: pointsToPath(points) }
    const updated = [...userPresets, preset]
    setUserPresets(updated)
    persistUserPresets(updated)
    setSavePromptOpen(false)
    setSaveName("")
  }

  function deleteUserPreset(id: string) {
    const updated = userPresets.filter((p) => p.id !== id)
    setUserPresets(updated)
    persistUserPresets(updated)
  }

  // ── Coordinate helpers ────────────────────────────────────────────────────────

  function toNorm(clientX: number, clientY: number): Point {
    const rect = svgRef.current!.getBoundingClientRect()
    return {
      x: Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (clientY - rect.top) / rect.height)),
    }
  }

  function svgXtoWidthPct(clientX: number): number {
    const rect = svgRef.current!.getBoundingClientRect()
    return Math.round(Math.max(50, Math.min(100, ((clientX - rect.left) / rect.width) * 100)))
  }

  function svgXtoLeftOffset(clientX: number): number {
    const rect = svgRef.current!.getBoundingClientRect()
    return Math.round(Math.max(0, Math.min(49, ((clientX - rect.left) / rect.width) * 100)))
  }

  function px(p: Point) {
    return { cx: p.x * svgW, cy: p.y * clampedH }
  }

  // ── Canvas click — add point ──────────────────────────────────────────────────

  function handleCanvasClick(e: React.MouseEvent<SVGSVGElement>) {
    if (closed) return
    setPoints([...pointsRef.current, toNorm(e.clientX, e.clientY)])
  }

  // ── Drag a polygon handle ─────────────────────────────────────────────────────

  function startDrag(e: React.PointerEvent, idx: number) {
    e.stopPropagation()
    setDragIdx(idx)

    function onMove(ev: PointerEvent) {
      const pt = toNorm(ev.clientX, ev.clientY)
      setPoints((prev) => { const n = [...prev]; n[idx] = pt; return n })
    }
    function onUp(ev: PointerEvent) {
      const pt = toNorm(ev.clientX, ev.clientY)
      setDragIdx(null)
      ptrCleanupRef.current = null
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
      window.removeEventListener("pointercancel", onUp)
      const next = [...pointsRef.current]; next[idx] = pt
      setPoints(next)
      if (closedRef.current) onChange(pointsToPath(next))
    }
    ptrCleanupRef.current = () => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
      window.removeEventListener("pointercancel", onUp)
    }
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
    window.addEventListener("pointercancel", onUp)
  }

  // ── Drag right-edge (width) handle ───────────────────────────────────────────

  function startWidthDrag(e: React.PointerEvent) {
    e.stopPropagation()
    function onMove(ev: PointerEvent) { onWidthPercent(svgXtoWidthPct(ev.clientX)) }
    function onUp(ev: PointerEvent) {
      onWidthPercent(svgXtoWidthPct(ev.clientX))
      widthCleanupRef.current = null
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
      window.removeEventListener("pointercancel", onUp)
    }
    widthCleanupRef.current = () => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
      window.removeEventListener("pointercancel", onUp)
    }
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
    window.addEventListener("pointercancel", onUp)
  }

  // ── Drag left-edge (leftOffset) handle ───────────────────────────────────────

  function startLeftOffsetDrag(e: React.PointerEvent) {
    e.stopPropagation()
    function onMove(ev: PointerEvent) { onLeftOffset(svgXtoLeftOffset(ev.clientX)) }
    function onUp(ev: PointerEvent) {
      onLeftOffset(svgXtoLeftOffset(ev.clientX))
      leftCleanupRef.current = null
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
      window.removeEventListener("pointercancel", onUp)
    }
    leftCleanupRef.current = () => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
      window.removeEventListener("pointercancel", onUp)
    }
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
    window.addEventListener("pointercancel", onUp)
  }

  // ── Drag text position ────────────────────────────────────────────────────────

  function startTextDrag(e: React.PointerEvent) {
    e.stopPropagation()
    function onMove(ev: PointerEvent) { onTextPosition(toNorm(ev.clientX, ev.clientY)) }
    function onUp(ev: PointerEvent) {
      onTextPosition(toNorm(ev.clientX, ev.clientY))
      textCleanupRef.current = null
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
      window.removeEventListener("pointercancel", onUp)
    }
    textCleanupRef.current = () => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
      window.removeEventListener("pointercancel", onUp)
    }
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
    window.addEventListener("pointercancel", onUp)
  }

  // ── Drag folder symbol position ───────────────────────────────────────────────

  function startSymbolDrag(e: React.PointerEvent) {
    if (!onFolderSymbolPosition) return
    const onSymbolPos = onFolderSymbolPosition
    e.stopPropagation()
    function onMove(ev: PointerEvent) { onSymbolPos(toNorm(ev.clientX, ev.clientY)) }
    function onUp(ev: PointerEvent) {
      onSymbolPos(toNorm(ev.clientX, ev.clientY))
      symbolCleanupRef.current = null
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
      window.removeEventListener("pointercancel", onUp)
    }
    symbolCleanupRef.current = () => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
      window.removeEventListener("pointercancel", onUp)
    }
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
    window.addEventListener("pointercancel", onUp)
  }

  // ── Close / reset ─────────────────────────────────────────────────────────────

  function closeShape() {
    if (points.length < 3) return
    setClosed(true)
    onChange(pointsToPath(points))
    if (!textPosition) onTextPosition(computeCentroid(points))
  }

  function reset() {
    setPoints([])
    setClosed(false)
    onChange(null)
    onTextPosition(null)
  }

  // ── Edge indicator X positions ────────────────────────────────────────────────

  const widthLineX = (widthPercent / 100) * svgW
  const leftLineX = (leftOffset / 100) * svgW

  // Pixel-space polyline for open drawing phase
  const polyPts = points.map((p) => `${(p.x * svgW).toFixed(1)},${(p.y * clampedH).toFixed(1)}`).join(" ")

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[10px] text-smoke-500 uppercase tracking-wider">
        Shape{closed ? " — drag handles to refine" : ""}
      </span>

      {/* ── Preset list ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-0.5 max-h-36 overflow-y-auto border border-smoke-800 rounded bg-smoke-900/50 py-0.5">
        {BUILT_IN_PRESETS.map((preset) => (
          <button
            key={preset.name}
            type="button"
            onClick={() => applyPresetPoints(preset.pts)}
            className="flex items-center gap-2 px-2 py-1.5 text-left hover:bg-smoke-800 transition-colors rounded mx-0.5"
          >
            <ShapeThumbnail pts={preset.pts} />
            <span className="text-xs text-smoke-300">{preset.name}</span>
          </button>
        ))}
        {!hidePresets && userPresets.length > 0 && (
          <div className="border-t border-smoke-800 mt-0.5 pt-0.5">
            {userPresets.map((preset) => (
              <div key={preset.id} className="flex items-center mx-0.5">
                <button
                  type="button"
                  onClick={() => applyUserPreset(preset.path)}
                  className="flex-1 flex items-center gap-2 px-2 py-1.5 text-left hover:bg-smoke-800 transition-colors rounded-l"
                >
                  <ShapeThumbnail pts={pathToPoints(preset.path)} />
                  <span className="text-xs text-smoke-400">{preset.name}</span>
                </button>
                <button
                  type="button"
                  onClick={() => deleteUserPreset(preset.id)}
                  title="Remove preset"
                  className="px-2 py-1.5 text-smoke-500 hover:text-doom-ember transition-colors text-sm leading-none"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Canvas ───────────────────────────────────────────────────────────── */}
      <div
        className="relative w-full rounded border border-smoke-700 bg-navy-950/70 select-none"
        style={{ height: clampedH }}
      >
        <svg
          ref={svgRef}
          className={`absolute inset-0 w-full h-full overflow-visible ${!closed ? "cursor-crosshair" : ""}`}
          onClick={handleCanvasClick}
        >
          {/* Grid dots */}
          {[0.25, 0.5, 0.75].flatMap((gx) =>
            [0.25, 0.5, 0.75].map((gy) => (
              <circle key={`g-${gx}-${gy}`} cx={gx * svgW} cy={gy * clampedH} r={2} fill="#23262a" />
            ))
          )}

          {/* Centre crosshair */}
          <line x1={svgW * 0.5} y1={0} x2={svgW * 0.5} y2={clampedH} stroke="#23262a" strokeWidth={1} />
          <line x1={0} y1={clampedH * 0.5} x2={svgW} y2={clampedH * 0.5} stroke="#23262a" strokeWidth={1} />

          {/* Right-edge indicator dashed line */}
          {closed && (
            <line
              x1={widthLineX} y1={0}
              x2={widthLineX} y2={clampedH}
              stroke="#c9a84c"
              strokeWidth={1}
              strokeDasharray="4 3"
              opacity={0.45}
              pointerEvents="none"
            />
          )}

          {/* Left-edge indicator dashed line */}
          {closed && leftOffset > 0 && (
            <line
              x1={leftLineX} y1={0}
              x2={leftLineX} y2={clampedH}
              stroke="#c9a84c"
              strokeWidth={1}
              strokeDasharray="4 3"
              opacity={0.45}
              pointerEvents="none"
            />
          )}

          {/* Shape fill + stroke */}
          {points.length >= 3 && (
            closed ? (
              <path
                d={smoothedPath(points, smoothing, svgW, clampedH)}
                fill="rgba(201,168,76,0.12)"
                stroke="#c9a84c"
                strokeWidth={STROKE_W}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : (
              <>
                <polygon points={polyPts} fill="rgba(201,168,76,0.12)" stroke="none" />
                {points.slice(0, -1).map((p, i) => {
                  const next = points[i + 1]
                  const a = px(p), b = px(next)
                  return (
                    <line key={`e-${i}`} x1={a.cx} y1={a.cy} x2={b.cx} y2={b.cy}
                      stroke="#c9a84c" strokeWidth={STROKE_W} strokeLinecap="round" />
                  )
                })}
              </>
            )
          )}

          {/* Dashed closing preview (open phase) */}
          {points.length >= 2 && !closed && (() => {
            const a = px(points[points.length - 1]), b = px(points[0])
            return (
              <line x1={a.cx} y1={a.cy} x2={b.cx} y2={b.cy}
                stroke="#c9a84c" strokeWidth={STROKE_W} strokeDasharray="4 3" opacity={0.35} />
            )
          })()}

          {/* Text position handle — draggable "Aa" badge */}
          {closed && points.length >= 3 && textPosition && (
            <g
              transform={`translate(${textPosition.x * svgW},${textPosition.y * clampedH})`}
              style={{ cursor: "move", touchAction: "none" }}
              onPointerDown={startTextDrag}
            >
              <circle r={12} fill="rgba(0,0,0,0.45)" stroke="#9ca3af" strokeWidth={1} />
              <text
                textAnchor="middle"
                dominantBaseline="central"
                fill="#d1d5db"
                fontSize={9}
                fontWeight="600"
                pointerEvents="none"
              >
                Aa
              </text>
            </g>
          )}

          {/* Folder symbol position handle — draggable "◈" badge */}
          {onFolderSymbolPosition && folderSymbolPosition && (
            <g
              transform={`translate(${folderSymbolPosition.x * svgW},${folderSymbolPosition.y * clampedH})`}
              style={{ cursor: "move", touchAction: "none" }}
              onPointerDown={startSymbolDrag}
            >
              <circle r={12} fill="rgba(0,0,0,0.45)" stroke="#c9a84c" strokeWidth={1} />
              <text
                textAnchor="middle"
                dominantBaseline="central"
                fill="#c9a84c"
                fontSize={folderSymbolIcon ? 9 : 11}
                fontWeight="600"
                pointerEvents="none"
              >
                {folderSymbolImage ? "🖼" : (folderSymbolIcon ? folderSymbolIcon.slice(0, 2) : "◈")}
              </text>
            </g>
          )}

          {/* Polygon handles */}
          {points.map((p, i) => {
            const { cx, cy } = px(p)
            return (
              <circle
                key={`h-${i}`}
                cx={cx} cy={cy}
                r={dragIdx === i ? HANDLE_R + 2 : HANDLE_R}
                fill={i === 0 ? "#c9a84c" : "#9ca3af"}
                stroke="#050818"
                strokeWidth={1.5}
                style={{ cursor: "grab", touchAction: "none" }}
                onPointerDown={(e) => startDrag(e, i)}
              />
            )
          })}

          {/* Right-edge drag handle ◄ */}
          {closed && (
            <g
              transform={`translate(${svgW - 1},${clampedH / 2})`}
              style={{ cursor: "ew-resize", touchAction: "none" }}
              onPointerDown={startWidthDrag}
            >
              <rect x={-10} y={-14} width={14} height={28} fill="transparent" />
              <polygon points="-8,-8 0,0 -8,8" fill="#c9a84c" opacity={0.85} />
              <line x1={0} y1={-9} x2={0} y2={9} stroke="#c9a84c" strokeWidth={1.5} opacity={0.6} />
            </g>
          )}

          {/* Left-edge drag handle ► */}
          {closed && (
            <g
              transform={`translate(1,${clampedH / 2})`}
              style={{ cursor: "ew-resize", touchAction: "none" }}
              onPointerDown={startLeftOffsetDrag}
            >
              <rect x={-4} y={-14} width={14} height={28} fill="transparent" />
              <polygon points="8,-8 0,0 8,8" fill="#c9a84c" opacity={0.85} />
              <line x1={0} y1={-9} x2={0} y2={9} stroke="#c9a84c" strokeWidth={1.5} opacity={0.6} />
            </g>
          )}
        </svg>
      </div>

      {/* ── Controls ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap">
        {!closed && points.length >= 3 && (
          <button
            type="button"
            onClick={closeShape}
            className="px-2.5 py-1 text-xs bg-doom-gold text-navy-950 rounded hover:bg-doom-gold/80 transition-colors"
          >
            Close shape
          </button>
        )}
        {points.length > 0 && (
          <button
            type="button"
            onClick={reset}
            className="px-2.5 py-1 text-xs bg-smoke-700 text-smoke-300 rounded hover:bg-smoke-600 transition-colors"
          >
            Reset
          </button>
        )}
        {!hidePresets && closed && points.length >= 3 && !savePromptOpen && (
          <button
            type="button"
            onClick={() => setSavePromptOpen(true)}
            className="px-2.5 py-1 text-xs bg-smoke-800 border border-smoke-600 text-smoke-400 rounded hover:text-smoke-200 hover:border-smoke-500 transition-colors"
          >
            Save as preset
          </button>
        )}
        {closed && textPosition === null && points.length >= 3 && (
          <button
            type="button"
            onClick={() => onTextPosition(computeCentroid(points))}
            className="px-2.5 py-1 text-xs bg-smoke-800 border border-smoke-600 text-smoke-400 rounded hover:text-smoke-200 hover:border-smoke-500 transition-colors"
          >
            Add text handle
          </button>
        )}
        {closed && textPosition !== null && (
          <button
            type="button"
            onClick={() => onTextPosition(null)}
            className="px-2.5 py-1 text-xs text-smoke-500 hover:text-smoke-300 transition-colors"
          >
            Remove text handle
          </button>
        )}
        {onFolderSymbolPosition && !folderSymbolPosition && (
          <button
            type="button"
            onClick={() => onFolderSymbolPosition({ x: 0.85, y: 0.1 })}
            className="px-2.5 py-1 text-xs bg-smoke-800 border border-doom-gold/30 text-doom-gold/70 rounded hover:text-doom-gold hover:border-doom-gold/60 transition-colors"
          >
            Place symbol
          </button>
        )}
        {onFolderSymbolPosition && folderSymbolPosition && (
          <button
            type="button"
            onClick={() => onFolderSymbolPosition(null)}
            className="px-2.5 py-1 text-xs text-doom-gold/50 hover:text-doom-gold/80 transition-colors"
          >
            Remove symbol handle
          </button>
        )}
        {points.length === 0 && (
          <p className="text-[10px] text-smoke-600">Click on the canvas to add points, or pick a preset above</p>
        )}
        {points.length > 0 && points.length < 3 && !closed && (
          <p className="text-[10px] text-smoke-600">
            Add {3 - points.length} more point{3 - points.length > 1 ? "s" : ""} to close
          </p>
        )}
      </div>

      {/* ── Smoothing slider ──────────────────────────────────────────────────── */}
      {closed && points.length >= 3 && (
        <div className="flex flex-col gap-1">
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-smoke-500 uppercase tracking-wider">Smoothing</span>
            <span className="text-[10px] text-smoke-400 font-mono tabular-nums">{smoothing}</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={smoothing}
            onChange={(e) => onSmoothing(Number(e.target.value))}
            className="w-full accent-doom-gold"
          />
        </div>
      )}

      {/* ── Edge percent display ──────────────────────────────────────────────── */}
      {closed && (
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-smoke-500 uppercase tracking-wider">Left</span>
            <span className="text-[10px] text-smoke-400 font-mono tabular-nums">{leftOffset}%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-smoke-500 uppercase tracking-wider">Right</span>
            <span className="text-[10px] text-smoke-400 font-mono tabular-nums">{widthPercent}%</span>
          </div>
        </div>
      )}

      {/* ── Save as preset form ───────────────────────────────────────────────── */}
      {!hidePresets && savePromptOpen && (
        <div className="flex gap-1.5 items-center">
          <input
            type="text"
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSaveAsPreset()
              if (e.key === "Escape") { setSavePromptOpen(false); setSaveName("") }
            }}
            placeholder="Preset name…"
            autoFocus
            className="flex-1 bg-smoke-900 border border-smoke-600 text-smoke-200 text-xs px-2 py-1 rounded focus:border-doom-gold/50 outline-none"
          />
          <button
            type="button"
            onClick={handleSaveAsPreset}
            disabled={!saveName.trim()}
            className="px-2 py-1 text-xs bg-doom-gold text-navy-950 rounded hover:bg-doom-gold/80 disabled:opacity-40 transition-colors"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => { setSavePromptOpen(false); setSaveName("") }}
            className="px-2 py-1 text-xs text-smoke-400 hover:text-smoke-200 transition-colors"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}
