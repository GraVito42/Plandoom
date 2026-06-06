ALTER TABLE "public"."User"
  ADD COLUMN IF NOT EXISTS "seendoTokensUsed"    INT       NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "seendoTokensResetAt" TIMESTAMP;
