import type { SeendoBudgetStatus } from "@/types"

// Data di reset: 1° del mese successivo
export function getSeendoResetDate(): Date {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth() + 1, 1)
}

// Restituisce lo stato del budget per l'utente dato.
// Per ora sempre 'active' — la logica reale verrà aggiunta quando
// il sistema di tracking dei token sarà in produzione.
export async function getSeendoBudgetStatus(
  _userId: string
): Promise<SeendoBudgetStatus> {
  return "active"
}
