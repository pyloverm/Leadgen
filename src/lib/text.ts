/** Lowercase, strip accents and punctuation: "Tasca do Zé, Lda." → "tasca do ze lda". */
export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " e ")
    .replace(/['’`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export const digitsOnly = (s: string) => s.replace(/\D/g, "");

/** Last 9 digits of a Portuguese phone number (drops +351 / 00351). */
export function phoneKey(phone: string | undefined): string | null {
  const d = digitsOnly(phone ?? "");
  return d.length >= 9 ? d.slice(-9) : null;
}

/** Portuguese / English / French articles and prepositions that carry no identity. */
export const STOP_WORDS = new Set([
  "o", "a", "os", "as", "do", "da", "dos", "das", "de", "e", "em", "no", "na", "nos", "nas", "ao", "aos",
  "the", "and", "of", "le", "la", "les", "du", "des", "l", "d", "y", "el", "lda", "unipessoal", "sa", "ltd",
]);

/** Business-type words: useful in a domain ("restauranteopescador.pt") but not distinctive. */
export const GENERIC_WORDS = new Set([
  "restaurante", "restaurant", "rest", "snack", "bar", "snackbar", "cafe", "cafetaria", "pastelaria", "padaria",
  "confeitaria", "churrasqueira", "marisqueira", "cervejaria", "taberna", "tasca", "tasquinha", "pizzaria",
  "pizzeria", "hamburgueria", "gelataria", "hotel", "hostel", "guesthouse", "guest", "house", "alojamento",
  "local", "residencial", "pensao", "apartamentos", "apartments", "villa", "villas", "casa", "quinta",
  "cabeleireiro", "cabeleireira", "cabeleireiros", "barbearia", "barber", "barbershop", "shop", "salao",
  "estetica", "beauty", "spa", "clinica", "consultorio", "medica", "dentaria", "farmacia", "oficina", "auto",
  "loja", "store", "boutique", "mercearia", "minimercado", "supermercado", "talho", "peixaria", "florista",
  "imobiliaria", "atelier", "studio", "estudio", "escola", "ginasio", "gym", "fitness", "lavandaria",
  "papelaria", "livraria", "optica", "otica", "garrafeira", "frutaria", "sapataria", "drogaria", "centro",
]);

export function nameTokens(name: string): { all: string[]; distinctive: string[] } {
  const all = normalizeText(name).split(" ").filter(Boolean);
  const distinctive = all.filter((t) => !STOP_WORDS.has(t) && !GENERIC_WORDS.has(t) && t.length >= 3);
  return { all, distinctive };
}
