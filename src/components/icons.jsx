// lucide-react에 없는(또는 버전마다 이름이 다른) 아이콘은 직접 그립니다.

const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  viewBox: '0 0 24 24',
};

export function MoreIcon({ className = 'w-5 h-5' }) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <circle cx="5" cy="12" r="1.4" fill="currentColor" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" />
      <circle cx="19" cy="12" r="1.4" fill="currentColor" />
    </svg>
  );
}

export function InOutIcon({ className = 'w-5 h-5' }) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M7 4v13M4 14l3 3 3-3M17 20V7M14 10l3-3 3 3" />
    </svg>
  );
}

export function ListIcon({ className = 'w-5 h-5' }) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h10" />
    </svg>
  );
}

export function BottleIcon({ className = 'w-6 h-12' }) {
  return (
    <svg viewBox="0 0 22 50" fill="none" stroke="currentColor" strokeWidth="1.5" className={className} aria-hidden="true">
      <path d="M8 2h6v12c0 2 5 4 5 10v22a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V24c0-6 5-8 5-10z" />
      <path d="M3 30h16" />
    </svg>
  );
}

export function SortIcon({ className = 'w-3.5 h-3.5' }) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M7 4v16M4 17l3 3 3-3M14 6h7M14 12h5M14 18h3" />
    </svg>
  );
}
