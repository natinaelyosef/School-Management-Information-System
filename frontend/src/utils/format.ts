export function formatCurrency(amount: number, currency = 'ETB'): string {
  return `${currency} ${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function initials(name: string): string {
  return name
    .split(' ')
    .map((p) => p.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function letterGrade(score: number): string {
  if (score >= 90) return 'A+';
  if (score >= 80) return 'A';
  if (score >= 70) return 'B';
  if (score >= 60) return 'C';
  if (score >= 50) return 'D';
  return 'F';
}

/** "Grade 8-A" from either the relation object or a plain string. */
export function classLabel(
  grade?: { id: number; name: string } | string | null,
  section?: { id: number; name: string } | string | null,
): string {
  const g = typeof grade === 'string' ? grade : (grade?.name ?? '');
  const s = typeof section === 'string' ? section : (section?.name ?? '');
  return [g, s].filter(Boolean).join('-');
}
