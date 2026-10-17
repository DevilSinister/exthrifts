// Pakistani mobile numbers: 03XX XXXXXXX locally, +92 3XX XXXXXXX internationally.
// Orders store the +92 form so search and customer grouping use one key.

export function normalizePkPhone(input: string): string | null {
  let digits = input.replace(/[\s\-().]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  if (!/^\d+$/.test(digits)) return null;
  if (digits.startsWith("0092")) digits = digits.slice(2);

  let national: string;
  if (digits.startsWith("92") && digits.length === 12) national = digits.slice(2);
  else if (digits.startsWith("0") && digits.length === 11) national = digits.slice(1);
  else if (digits.length === 10) national = digits;
  else return null;

  // Mobile numbers start with 3 (3XX operator prefix).
  if (!/^3\d{9}$/.test(national)) return null;
  return `+92${national}`;
}

/** "+923001234567" -> "0300 1234567" */
export function displayPhone(stored: string): string {
  const match = stored.match(/^\+92(3\d{2})(\d{7})$/);
  return match ? `0${match[1]} ${match[2]}` : stored;
}

/** wa.me link for a stored number, optionally with a prefilled message. */
export function whatsappLink(stored: string, text?: string): string {
  const number = stored.replace(/^\+/, "").replace(/\D/g, "");
  const query = text ? `?text=${encodeURIComponent(text)}` : "";
  return `https://wa.me/${number}${query}`;
}
