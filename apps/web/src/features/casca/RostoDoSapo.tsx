/** O rosto do sapo da marca. */
export function RostoDoSapo({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true" className={className}>
      <ellipse cx="20" cy="26" rx="15" ry="11" fill="#8fe05a" />
      <circle cx="12" cy="13" r="7" fill="#8fe05a" />
      <circle cx="28" cy="13" r="7" fill="#8fe05a" />
      <circle cx="12" cy="13" r="4" fill="#fff" />
      <circle cx="28" cy="13" r="4" fill="#fff" />
      <circle cx="12.5" cy="13.5" r="2" fill="#1f2a24" />
      <circle cx="28.5" cy="13.5" r="2" fill="#1f2a24" />
      <path d="M14 25q6 4 12 0" stroke="#1f2a24" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  );
}
