export type BauProps = { aberto?: boolean; className?: string };

/** Baú do prêmio da meta, fechado ou aberto e cheio de joias. */
export function Bau({ aberto = false, className = 'size-14' }: BauProps) {
  return (
    <svg viewBox="4 3 32 33" role="img" aria-label={aberto ? 'Baú aberto' : 'Baú fechado'} className={`shrink-0 ${className}`}>
      {aberto ? (
        <>
          <path d="M7 15 L10 4 Q20 0 30 4 L33 15z" fill="#C07A45" />
          <path d="M8 14 L10.5 6 Q20 3 29.5 6 L32 14z" fill="#7A4A2A" />
          <ellipse cx="20" cy="18" rx="13" ry="5" fill="#E6D6FF" />
          <path d="M14 13.5l3 1.8v3.4l-3 1.8-3-1.8v-3.4z" fill="#B583FF" stroke="#7B3FE4" strokeWidth=".8" />
          <path d="M20 12l3 1.8v3.4L20 19l-3-1.8v-3.4z" fill="#FF8FC7" stroke="#D9579B" strokeWidth=".8" />
          <path d="M26 13.5l3 1.8v3.4l-3 1.8-3-1.8v-3.4z" fill="#B583FF" stroke="#7B3FE4" strokeWidth=".8" />
          <rect x="5" y="18" width="30" height="17" rx="3" fill="#A0643A" />
          <rect x="10" y="18" width="4" height="17" fill="#8B97A0" opacity=".9" />
          <rect x="26" y="18" width="4" height="17" fill="#8B97A0" opacity=".9" />
          <rect x="16" y="20" width="8" height="8" rx="2" fill="#FFD166" stroke="#E0A93A" strokeWidth="1.5" />
        </>
      ) : (
        <>
          <rect x="5" y="17" width="30" height="18" rx="3" fill="#A0643A" />
          <path d="M5 19c0-7 5-11 15-11s15 4 15 11z" fill="#C07A45" />
          <rect x="5" y="17" width="30" height="4" fill="#7A4A2A" />
          <rect x="10" y="9" width="4" height="26" fill="#8B97A0" opacity=".9" />
          <rect x="26" y="9" width="4" height="26" fill="#8B97A0" opacity=".9" />
          <rect x="16" y="16" width="8" height="10" rx="2" fill="#FFD166" stroke="#E0A93A" strokeWidth="1.5" />
          <circle cx="20" cy="20.5" r="1.6" fill="#7A4A2A" />
        </>
      )}
    </svg>
  );
}
