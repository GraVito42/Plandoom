import { NextResponse } from "next/server"

type NominatimResult = {
  name: string
  display_name: string
  lat: string
  lon: string
  address: Record<string, string>
}

function shortName(r: NominatimResult): string {
  const a = r.address
  const candidate =
    a.amenity ?? a.building ?? a.tourism ?? a.leisure ??
    a.shop ?? a.office ?? a.natural ?? r.name
  return (candidate || r.display_name.split(",")[0]).trim()
}

function shortAddress(r: NominatimResult): string {
  const a = r.address
  const parts: string[] = []
  if (a.road) parts.push(a.road)
  const city = a.city ?? a.town ?? a.village ?? a.county
  if (city) parts.push(city)
  if (a.country) parts.push(a.country)
  return parts.join(", ") || r.display_name
}

// GET /api/maps/places?q=...
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = (searchParams.get("q") ?? "").trim()
  if (q.length < 2) return NextResponse.json([])

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=5&addressdetails=1`,
      {
        headers: {
          "User-Agent": "PlanDoom/1.0",
          "Accept-Language": "en",
        },
        cache: "no-store",
      }
    )
    if (!res.ok) return NextResponse.json([])

    const raw = (await res.json()) as NominatimResult[]
    return NextResponse.json(
      raw.map((r) => ({
        name: shortName(r),
        fullAddress: shortAddress(r),
        mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.display_name)}`,
      }))
    )
  } catch {
    return NextResponse.json([])
  }
}
