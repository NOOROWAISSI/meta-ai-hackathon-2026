import { z } from "zod";

const schema = z.object({
  language: z.enum(["ar", "en"]),
  sourceRevision: z.string(),
  translationKind: z.enum(["original", "ai_translation"]),
  items: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      summary: z.string(),
      verificationNote: z.string(),
    }),
  ),
});
export const isCatalogTranslationEnabled = () =>
  import.meta.env["VITE_ENABLE_META_TRANSLATION"] === "true";

export async function translateCatalog(language: "ar" | "en", signal?: AbortSignal) {
  if (!isCatalogTranslationEnabled())
    throw new Error(
      "Catalog translation awaits the separately reviewed Meta integration. Original content is preserved.",
    );
  const options = {
    method: "POST",
    credentials: "same-origin" as const,
    headers: { "Content-Type": "application/json", "X-NextStep-Request": "1" },
    ...(signal ? { signal } : {}),
  };
  const session = await fetch("/api/session", options);
  if (!session.ok) throw new Error("Could not start translation session");
  const response = await fetch("/api/localization/catalog", {
    ...options,
    body: JSON.stringify({ language }),
  });
  if (!response.ok)
    throw new Error("Content translation is unavailable. Original content is preserved.");
  return schema.parse(await response.json());
}
