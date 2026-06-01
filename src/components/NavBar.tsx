"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

const NAV_LINKS = [
  { href: "/week", label: "Week" },
  { href: "/personal", label: "Personal" },
  { href: "/seendo", label: "Seendo" },
]

export default function NavBar() {
  const pathname = usePathname()

  return (
    <nav className="shrink-0 h-9 border-b border-smoke-800 bg-navy-950 flex items-center gap-0.5 px-3">
      {NAV_LINKS.map(({ href, label }) => {
        const active = pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            className={`px-3 py-1 text-xs rounded transition-colors ${
              active
                ? "text-doom-gold bg-navy-800"
                : "text-smoke-500 hover:text-smoke-200 hover:bg-navy-800/60"
            }`}
          >
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
