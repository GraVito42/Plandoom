import { auth, currentUser } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { db } from "./db"
import type { User } from "@prisma/client"

/**
 * Restituisce il record User del DB per l'utente autenticato.
 * Alla prima visita lo crea automaticamente (upsert).
 * Lancia un errore se l'utente non è autenticato.
 */
export async function ensureUser(): Promise<User> {
  const { userId } = await auth()
  if (!userId) throw new Error("Non autenticato")

  // Ricerca veloce: se esiste già, evitiamo la chiamata a Clerk
  const existing = await db.user.findUnique({ where: { clerkId: userId } })
  if (existing) return existing

  // Prima visita: recupera i dati da Clerk e crea il record
  const clerkUser = await currentUser()
  if (!clerkUser) throw new Error("Utente Clerk non trovato")

  const email = clerkUser.emailAddresses[0]?.emailAddress ?? ""
  const name =
    [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || null

  // Upsert per gestire eventuali race condition
  return db.user.upsert({
    where: { clerkId: userId },
    create: { clerkId: userId, email, name },
    update: { email, name },
  })
}

/**
 * Come ensureUser, ma verifica che il ruolo sia "admin".
 * Restituisce una NextResponse 403 se non lo è (da ritornare direttamente dalla route).
 */
export async function ensureAdmin(): Promise<User | NextResponse> {
  const user = await ensureUser()
  if (user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  return user
}
