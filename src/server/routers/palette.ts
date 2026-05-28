// Server-side palette operation types — REST routes live in src/app/api/palettes/.

export type PaletteCreateInput = {
  name: string
  type: "institution" | "personal" | "arrangeable"
  colors: string[]   // ordered array of hex colour strings
}

export type PaletteUpdateInput = Partial<PaletteCreateInput>
