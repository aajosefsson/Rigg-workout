import { normName } from "./progress";

// ─── Exercise library: name -> instruction video ───────────────────────────────
// Videos live on Google Drive (shared as "anyone with the link") or YouTube. We only store the link.

// Document id for an exercise name, so importing the same name again updates instead of duplicating
export const exerciseId = (name) => {
  const slug = normName(name)
    .replace(/[^a-z0-9åäöé]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug.slice(0, 80) || "exercise";
};

// A link the player can show, or null when it isn't a Drive/YouTube link we understand
export const embedUrl = (link) => {
  const s = String(link || "").trim();
  if (!/^https:\/\//i.test(s)) return null;
  let m = s.match(/drive\.google\.com\/file\/d\/([\w-]+)/i);
  if (!m) m = s.match(/drive\.google\.com\/(?:open|uc)\?(?:[^#]*&)?id=([\w-]+)/i);
  if (m) return `https://drive.google.com/file/d/${m[1]}/preview`;
  m = s.match(/(?:youtube\.com\/(?:watch\?(?:[^#]*&)?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/i);
  if (m) return `https://www.youtube.com/embed/${m[1]}`;
  return null;
};

// Pasted text, one exercise per line: "Name | link" (tab, semicolon or comma also work).
// Returns [{ name, url, error }]; error is set for lines that can't be imported.
export const parseLibraryList = (text) =>
  String(text || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const m = line.match(/^(.*?)\s*(?:\||\t|;|,)\s*(https:\/\/\S+)\s*$/i);
      if (!m) return { name: line, url: "", error: "No link found" };
      const name = m[1].trim();
      if (!name) return { name: "", url: m[2], error: "No name" };
      if (name.length > 80) return { name, url: m[2], error: "Name too long" };
      if (!embedUrl(m[2])) return { name, url: m[2], error: "Not a Drive or YouTube link" };
      return { name, url: m[2], error: "" };
    });

// [{ name, videoUrl }] -> lookup by exercise name (case-insensitive)
export const videoLookup = (list) => {
  const map = new Map();
  list.forEach((e) => map.set(normName(e.name), e.videoUrl));
  return (name) => map.get(normName(name)) || null;
};
