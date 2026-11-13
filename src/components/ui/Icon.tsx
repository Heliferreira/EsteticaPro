const PATHS: Record<string, string> = {
  home: 'M3 11.5 12 4l9 7.5M5.5 10v9.5h13V10M10 19.5v-5h4v5',
  clipboard: 'M9 4h6l1 2h3v14H5V6h3l1-2ZM9 11h6M9 15h4',
  users: 'M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-3A3.5 3.5 0 0 0 6 17.5V19M11 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM18 19v-1a3 3 0 0 0-2-2.8M16 5.3a3 3 0 0 1 0 5.4',
  car: 'M4 16v-4l1.8-4.5A2 2 0 0 1 7.7 6h8.6a2 2 0 0 1 1.9 1.5L20 12v4M4 16h16M4 16v2.5h3V16M17 16v2.5h3V16M7.5 12.5h.01M16.5 12.5h.01',
  wrench: 'M14.7 6.3a4 4 0 0 0-5.4 5l-5 5a1.8 1.8 0 0 0 2.5 2.5l5-5a4 4 0 0 0 5-5.4l-2.4 2.4-2.1-.5-.5-2.1 2.4-2.4Z',
  box: 'M4 8l8-4 8 4v8l-8 4-8-4V8Zm0 0 8 4m0 0 8-4m-8 4v8',
  team: 'M12 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM5 20v-1a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v1',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM5 20a7 7 0 0 1 14 0',
  handshake: 'M3 12l4-4 4 2 3-2 7 6M3 12l5 5a2 2 0 0 0 3 0l1-1M12 16l2 2a2 2 0 0 0 3 0l3-3',
  report: 'M6 3h9l4 4v14H6V3ZM14 3v5h5M9 13h7M9 17h5',
  logout: 'M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M10 16l-4-4 4-4M6 12h10',
  search: 'M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14ZM20 20l-4-4',
  plus: 'M12 5v14M5 12h14',
  arrow: 'M7 17 17 7M9 7h8v8',
};

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}
