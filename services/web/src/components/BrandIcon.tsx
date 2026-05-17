export function BrandIcon({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden
    >
      <path d="M12 3L2 8.5l10 5.5 10-5.5L12 3z" strokeLinejoin="round" strokeLinecap="round" />
      <path d="M6.5 11.2v4.3c0 1.2 2.4 2.5 5.5 2.5s5.5-1.3 5.5-2.5v-4.3" strokeLinecap="round" />
      <path d="M21 8.5v5" strokeLinecap="round" />
    </svg>
  );
}
