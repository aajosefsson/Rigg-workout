// ─── Invite helpers ────────────────────────────────────────────────────────────
export const roleLabel = (r) => (r === "member" ? "client" : r);
export const readInviteParam = () => {
  try {
    return new URLSearchParams(window.location.search).get("invite") || "";
  } catch {
    return "";
  }
};
export const normCode = (c) => (c || "").toLowerCase().replace(/[^a-z0-9]/g, "");
export const makeCode = () => {
  const chars = "abcdefghijkmnpqrstuvwxyz23456789"; // 32 symbols, no look-alikes (l, o, 0, 1)
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
};
export const prettyCode = (c) => (c.match(/.{1,5}/g) || []).join("-");
export const looksLikeEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
// Opens the coach's own mail app with the invitation already written (sent from their address)
export const inviteMailto = ({
  email,
  firstName,
  orgName,
  inviterName,
  role,
  link,
}) => {
  const subject = `Din inbjudan till ${orgName}`;
  const body =
    `Hej ${firstName || ""}!\n\n${inviterName} har bjudit in dig till ${orgName} som ${role === "member" ? "klient" : "coach"}.\n\n` +
    `Skapa ditt konto här (länken gäller i 7 dagar och kan bara användas en gång):\n${link}\n\n` +
    `Du väljer ett eget lösenord när du registrerar dig. Använd samma e-postadress som det här mejlet skickades till.\n\nVälkommen!\n${inviterName}`;
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
};
