interface P { size?: number }

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
})

export const Plus = ({ size = 15 }: P) => (
  <svg {...base(size)}><path d="M12 5v14M5 12h14" /></svg>
)

export const Search = ({ size = 14 }: P) => (
  <svg {...base(size)}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2" /></svg>
)

export const X = ({ size = 16 }: P) => (
  <svg {...base(size)}><path d="M18 6 6 18M6 6l12 12" /></svg>
)

export const Clock = ({ size = 11 }: P) => (
  <svg {...base(size)}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
)

export const Alert = ({ size = 11 }: P) => (
  <svg {...base(size)}><path d="M12 3 2 20h20L12 3Z" /><path d="M12 9v5M12 17.5v.01" /></svg>
)

export const Chat = ({ size = 11 }: P) => (
  <svg {...base(size)}><path d="M21 12a8 8 0 0 1-8 8H7l-4 3v-6.5A8 8 0 0 1 11 4h2a8 8 0 0 1 8 8Z" /></svg>
)

export const Text = ({ size = 11 }: P) => (
  <svg {...base(size)}><path d="M4 7h16M4 12h16M4 17h9" /></svg>
)

export const Users = ({ size = 15 }: P) => (
  <svg {...base(size)}>
    <path d="M16 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20" />
    <circle cx="9" cy="7" r="3.2" />
    <path d="M22 20v-1.5a4 4 0 0 0-3-3.85" />
    <path d="M16 4.15a4 4 0 0 1 0 7.7" />
  </svg>
)

export const Tag = ({ size = 15 }: P) => (
  <svg {...base(size)}>
    <path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0l-7.2-7.2A2 2 0 0 1 2.8 12V4.8A2 2 0 0 1 4.8 2.8H12a2 2 0 0 1 1.4.6l7.2 7.2a2 2 0 0 1 0 2.8Z" />
    <path d="M7.5 7.5v.01" />
  </svg>
)

export const Trash = ({ size = 14 }: P) => (
  <svg {...base(size)}>
    <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
  </svg>
)

export const Check = ({ size = 14 }: P) => (
  <svg {...base(size)}><path d="m5 13 4 4L19 7" /></svg>
)
