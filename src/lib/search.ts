/** lowercase + strip accents, so "koln" finds "Köln" and "odegaard" finds "Ødegaard". */
export const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ø/g, "o")
    .replace(/æ/g, "ae")
    .replace(/å/g, "a")
    .replace(/ß/g, "ss")
    .replace(/ł/g, "l");

/** Every word of the query must appear somewhere in the text. */
export const matchesQuery = (text: string, query: string) => norm(query).split(/\s+/).filter(Boolean).every((t) => text.includes(t));
