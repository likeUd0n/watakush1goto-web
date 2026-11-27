// v19 モックの SVG アイコン(24×24、線のみ)。Android 版 ui/icons/AppIcons.kt と同じ形

const circle = (cx: number, cy: number, r: number) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0z`

interface IconDef {
  d: string[]
  width?: number
  filled?: string[]
}

export const icons = {
  rec: { d: ['M5 4h14v16H5z', 'M9 9h6M9 13h6M9 17h3'] },
  visit: { d: ['M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z', 'M8.5 12h2l1-2 1.5 4 1-2h1.5'] },
  moon: { d: ['M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z'] },
  smile: { d: [circle(12, 12, 9), 'M9 10h.01M15 10h.01M8.5 14.5a4.5 4.5 0 0 0 7 0'] },
  talk: { d: ['M5 5h14v10H10l-4 4v-4H5z', 'M9 9h6M9 12h4'] },
  plus: { d: ['M12 5v14M5 12h14'], width: 2 },
  check: { d: ['M5 12l5 5 9-10'], width: 2.2 },
  trash: { d: ['M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13'] },
  gear: {
    d: [
      'M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z',
      'M19.4 13.5l1.6 1.2-2 3.4-1.9-.7a7 7 0 0 1-1.7 1l-.3 2H11l-.3-2a7 7 0 0 1-1.7-1l-1.9.7-2-3.4 1.6-1.2a7 7 0 0 1 0-2L5 10.3l2-3.4 1.9.7a7 7 0 0 1 1.7-1l.3-2h4.1l.3 2a7 7 0 0 1 1.7 1l1.9-.7 2 3.4-1.6 1.2a7 7 0 0 1 0 2z',
    ],
  },
  help: { d: [circle(12, 12, 9), 'M9.5 9.5a2.5 2.5 0 0 1 5 .5c0 1.5-2.5 2-2.5 3.5'], filled: [circle(12, 17, 0.6)] },
  cal: { d: ['M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z', 'M8 3v4M16 3v4M4 10h16'] },
  left: { d: ['M15 5l-7 7 7 7'], width: 2 },
  right: { d: ['M9 5l7 7-7 7'], width: 2 },
  ai: { d: ['M5 6h14M5 12h9M5 18h6', 'M17 14l1 2 2 1-2 1-1 2-1-2-2-1 2-1z'] },
  list: { d: ['M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01'] },
  chart: { d: ['M4 19h16', 'M5 14l4-4 4 3 6-7'] },
  close: { d: ['M6 6l12 12M18 6L6 18'], width: 2 },
  star: { d: ['M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.3-4.1 5.9-.9z'] },
} satisfies Record<string, IconDef>

export type IconName = keyof typeof icons

export function Icon({ name, size = 24, class: cls }: { name: IconName; size?: number; class?: string }) {
  const def: IconDef = icons[name]
  return (
    <svg
      class={cls}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width={def.width ?? 1.8}
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      {def.d.map((d) => (
        <path d={d} />
      ))}
      {def.filled?.map((d) => (
        <path d={d} fill="currentColor" stroke="none" />
      ))}
    </svg>
  )
}
