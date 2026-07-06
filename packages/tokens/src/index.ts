export const color = {
  ink: '#1a1917',
  paper: '#f5f1e7',
  card: '#ffffff',
  rule: '#d9d2c1',
  mute: '#6b6659',
  muteSoft: '#9c9787',
  ballotBlue: '#274b6e',
  ballotRed: '#a13530',
  independent: '#7a6a4a',
  seal: '#8a5a1a',
  signal: '#3a6c4c',
  warn: '#a86a1f',
  error: '#8a2a20'
} as const;

export const space = {
  '1': '4px',
  '2': '8px',
  '3': '12px',
  '4': '16px',
  '6': '24px',
  '8': '32px',
  '12': '48px',
  '16': '64px',
  '24': '96px'
} as const;

export const radius = {
  chip: '4px',
  card: '6px',
  panel: '10px',
  none: '0'
} as const;

export const type = {
  display: '"Fraunces", "Instrument Sans", ui-sans-serif, system-ui, sans-serif',
  body: '"Instrument Sans", "Segoe UI", ui-sans-serif, system-ui, sans-serif',
  mono: '"JetBrains Mono", "Cascadia Mono", ui-monospace, monospace'
} as const;
