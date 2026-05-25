import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { ClerkProvider, SignInButton, SignUpButton, Show, UserButton } from "@clerk/nextjs"
import "./globals.css"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "PlanDoom",
  description: "L'apocalisse dell'event management",
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="it"
      className={`${geistSans.variable} ${geistMono.variable} antialiased`}
    >
      <body className="h-screen flex flex-col bg-navy-950 text-smoke-100 overflow-hidden">
        <ClerkProvider>
          {/* Topbar globale */}
          <header className="shrink-0 flex items-center justify-between px-6 py-3 border-b border-smoke-800 bg-navy-950 z-20">
            <span className="text-lg font-bold tracking-[0.25em] text-doom-gold select-none">
              PLANDOOM
            </span>
            <div className="flex items-center gap-3">
              <Show when="signed-out">
                <SignInButton />
                <SignUpButton />
              </Show>
              <Show when="signed-in">
                <UserButton />
              </Show>
            </div>
          </header>

          {/* Area principale sotto l'header */}
          <div className="flex-1 overflow-hidden">
            {children}
          </div>
        </ClerkProvider>
      </body>
    </html>
  )
}
