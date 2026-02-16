interface PokeballProps {
  size?: number;
  className?: string;
}

export function Pokeball({ size = 28, className = "" }: PokeballProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
    >
      <circle cx="50" cy="50" r="48" fill="#CC0000" stroke="#FFCB05" strokeWidth="3" />
      <rect x="0" y="48" width="100" height="52" rx="0" fill="#1a1a2e" />
      <circle cx="50" cy="50" r="48" fill="none" stroke="#FFCB05" strokeWidth="3" />
      <rect x="2" y="46" width="96" height="8" fill="#FFCB05" />
      <circle cx="50" cy="50" r="16" fill="#1a1a2e" stroke="#FFCB05" strokeWidth="3" />
      <circle cx="50" cy="50" r="7" fill="#FFCB05" />
    </svg>
  );
}
