/**
 * Abbreviates a name to initials.
 * e.g. "John Doe" -> "J.D."
 * e.g. "john.doe" -> "J.D."
 * e.g. "Single" -> "S."
 */
export function abbrName(name: string | null | undefined): string {
  if (!name) return '';
  
  // Split by common delimiters: space, dot, underscore, hyphen
  const parts = name.split(/[ ._\-]/).filter(Boolean);
  
  if (parts.length >= 2) {
    const first = parts[0][0].toUpperCase();
    const last = parts[parts.length - 1][0].toUpperCase();
    return `${first}.${last}.`;
  }
  
  // Handle Chinese names or single names
  if (name.length >= 2 && /[^\x00-\xff]/.test(name)) {
    // Basic support for 2+ char CJK names: take first two characters
    // But user asked for "A.B." format, which implies Western style initials.
    // If it's "张三", maybe "Z.S."? But we only have the string.
    // Let's just follow the "A.B." pattern if possible.
    return name.split('').slice(0, 2).map(c => c.toUpperCase() + '.').join('');
  }

  return name[0].toUpperCase() + '.';
}
