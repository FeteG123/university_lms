export function enrollmentSummary(enrolled: number, max: number): string {
  return `${enrolled} / ${max} students`;
}

export function seatsRemaining(enrolled: number, max: number): number {
  return Math.max(0, max - enrolled);
}
