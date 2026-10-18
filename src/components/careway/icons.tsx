import type { ReactNode } from "react";

function Svg({
  size = 20,
  children,
}: {
  size?: number;
  children: ReactNode;
}) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
      width={size}
    >
      {children}
    </svg>
  );
}

export function IconHome() {
  return (
    <Svg>
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5.5v-6h-3V21H5a1 1 0 0 1-1-1z" />
    </Svg>
  );
}

export function IconChat() {
  return (
    <Svg>
      <path d="M6 17.5 3.5 20V6.5A2.5 2.5 0 0 1 6 4h12a2.5 2.5 0 0 1 2.5 2.5v8A2.5 2.5 0 0 1 18 17H8z" />
    </Svg>
  );
}

export function IconCalendar() {
  return (
    <Svg>
      <rect height="14" rx="2" width="16" x="4" y="5" />
      <path d="M8 3.5v4M16 3.5v4M4 10h16" />
    </Svg>
  );
}

export function IconUser() {
  return (
    <Svg>
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5.5 19.2a6.5 6.5 0 0 1 13 0" />
    </Svg>
  );
}

export function IconHelp() {
  return (
    <Svg>
      <circle cx="12" cy="12" r="8" />
      <path d="M9.5 9.2a2.5 2.5 0 1 1 3.4 2.3c-.8.4-1.4 1-1.4 1.9V14" />
      <path d="M12 17h.01" />
    </Svg>
  );
}

export function IconBell() {
  return (
    <Svg>
      <path d="M6 16.5h12l-1.2-2V10a4.8 4.8 0 1 0-9.6 0v4.5z" />
      <path d="M10 18.2a2 2 0 0 0 4 0" />
    </Svg>
  );
}

export function IconGlobe() {
  return (
    <Svg size={18}>
      <circle cx="12" cy="12" r="8" />
      <path d="M4 12h16M12 4c2.2 2.4 2.2 13.6 0 16M12 4c-2.2 2.4-2.2 13.6 0 16" />
    </Svg>
  );
}

export function IconPin() {
  return (
    <Svg>
      <path d="M12 21s6-5.2 6-10a6 6 0 1 0-12 0c0 4.8 6 10 6 10z" />
      <circle cx="12" cy="11" r="2" />
    </Svg>
  );
}

export function IconDoc() {
  return (
    <Svg>
      <path d="M7 3.5h7l4 4V20a1.5 1.5 0 0 1-1.5 1.5h-9.5A1.5 1.5 0 0 1 5.5 20V5A1.5 1.5 0 0 1 7 3.5z" />
      <path d="M14 3.8V8h4.2M8.5 12.5h7M8.5 16h5" />
    </Svg>
  );
}

export function IconClock() {
  return (
    <Svg>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4.5l3 2" />
    </Svg>
  );
}

export function IconId() {
  return (
    <Svg>
      <rect height="13" rx="2" width="16" x="4" y="5.5" />
      <circle cx="9" cy="12" r="1.6" />
      <path d="M13 10.5h4M13 13.5h3" />
    </Svg>
  );
}

export function IconCheck({ size = 20 }: { size?: number }) {
  return (
    <Svg size={size}>
      <path d="m5 12.5 4.2 4.2L19 7.5" />
    </Svg>
  );
}

export function IconTooth() {
  return (
    <Svg>
      <path d="M8 4.5c1.2 0 1.8.8 2.4 1.6.4.6.8.6 1.2 0C12.2 5.3 12.8 4.5 14 4.5c2 0 3.5 1.8 3.5 4.2 0 2.2-.6 4.4-1.2 6.2-.5 1.5-1.2 3.6-2.4 3.6-1 0-1.3-1.4-1.9-2.8-.3-.8-.8-.8-1.1 0-.6 1.4-.9 2.8-1.9 2.8-1.2 0-1.9-2.1-2.4-3.6C6.1 13.1 5.5 10.9 5.5 8.7 5.5 6.3 7 4.5 8 4.5z" />
    </Svg>
  );
}

export function IconCard() {
  return (
    <Svg>
      <rect height="13" rx="2" width="16" x="4" y="5.5" />
      <path d="M4 10h16M8 14.5h3" />
    </Svg>
  );
}

export function IconPaperclip() {
  return (
    <Svg size={18}>
      <path d="m8 12.5 6.2-6.2a2.4 2.4 0 0 1 3.4 3.4l-7.4 7.4a3.6 3.6 0 0 1-5.1-5.1l6.8-6.7" />
    </Svg>
  );
}

export function IconSend() {
  return (
    <Svg size={18}>
      <path d="m5 12 14-7-6.2 14-1.6-5.2z" />
    </Svg>
  );
}

export function IconChevron({ size = 16 }: { size?: number }) {
  return (
    <Svg size={size}>
      <path d="m9 6 6 6-6 6" />
    </Svg>
  );
}

export function IconChevronDown() {
  return (
    <Svg size={16}>
      <path d="m6 9 6 6 6-6" />
    </Svg>
  );
}

export function IconClose() {
  return (
    <Svg size={18}>
      <path d="m7 7 10 10M17 7 7 17" />
    </Svg>
  );
}

export function IconBot() {
  return (
    <Svg size={18}>
      <rect height="11" rx="3" width="14" x="5" y="8" />
      <path d="M12 8V5M9.5 13h.01M14.5 13h.01" />
    </Svg>
  );
}

export function LeafMark() {
  return (
    <svg aria-hidden="true" fill="none" height="36" viewBox="0 0 48 40" width="42">
      <path
        d="M24.2 34c.2-7.2 4.6-13.2 12.6-16.2-1.2 8.4-6.4 15-12.6 16.2z"
        fill="#2F7BFF"
      />
      <path
        d="M23.2 34C23 26.8 18.6 20.8 10.6 17.8c1.2 8.4 6.4 15 12.6 16.2z"
        fill="#7EB0FF"
      />
    </svg>
  );
}

export function GoogleMark() {
  return (
    <svg aria-hidden="true" height="18" viewBox="0 0 18 18" width="18">
      <path
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.91c1.7-1.57 2.69-3.88 2.69-6.62z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26c-.81.54-1.84.86-3.05.86-2.34 0-4.33-1.58-5.04-3.71H.96v2.33A9 9 0 0 0 9 18z"
        fill="#34A853"
      />
      <path
        d="M3.96 10.71A5.4 5.4 0 0 1 3.68 9c0-.59.1-1.17.28-1.71V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.04l3-2.33z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.96l3 2.33C4.67 5.16 6.66 3.58 9 3.58z"
        fill="#EA4335"
      />
    </svg>
  );
}

export function Cityscape() {
  return (
    <svg aria-hidden="true" viewBox="0 0 760 210" width="100%">
      <g fill="#f7fbff">
        <circle cx="118" cy="42" r="16" />
        <circle cx="140" cy="38" r="22" />
        <circle cx="166" cy="44" r="14" />
        <circle cx="548" cy="58" r="12" />
        <circle cx="566" cy="52" r="18" />
        <circle cx="588" cy="60" r="11" />
      </g>
      <path d="M0 150c70-34 130-22 200 2 78 26 130 8 210-16 86-26 150-6 230 12 46 12 84 8 120-4v66H0z" fill="#d9e9f8" />
      <path d="M0 176c88-20 150-8 230 6 86 16 150 2 230-14 78-16 160 2 220 16 28 6 54 6 80 0v26H0z" fill="#c5dbf4" />
      <g fill="#8eb6e6">
        <path d="M92 156c0-22 8-34 16-46 8 12 16 24 16 46z" />
        <rect height="16" rx="3" width="6" x="105" y="152" />
        <path d="M176 150c0-26 10-40 18-54 8 14 18 28 18 54z" />
        <rect height="18" rx="3" width="6" x="191" y="146" />
        <path d="M470 158c0-18 7-28 14-38 7 10 14 20 14 38z" />
        <rect height="14" rx="3" width="5" x="482" y="154" />
        <path d="M610 152c0-24 9-36 16-48 7 12 16 24 16 48z" />
        <rect height="16" rx="3" width="6" x="623" y="148" />
        <path d="M690 160c0-16 6-26 12-34 6 8 12 18 12 34z" />
        <rect height="12" rx="2" width="5" x="700" y="156" />
      </g>
      <g fill="#f8fbff" stroke="#d3e3f4" strokeWidth="2">
        <rect height="46" rx="4" width="34" x="286" y="112" />
        <rect height="34" rx="4" width="28" x="316" y="124" />
        <rect height="58" rx="4" width="26" x="340" y="100" />
        <rect height="40" rx="4" width="30" x="362" y="118" />
        <rect height="28" rx="4" width="22" x="388" y="130" />
      </g>
      <g fill="#d5e4f6">
        <rect height="6" rx="1" width="6" x="294" y="122" />
        <rect height="6" rx="1" width="6" x="304" y="122" />
        <rect height="6" rx="1" width="6" x="294" y="134" />
        <rect height="6" rx="1" width="6" x="304" y="134" />
        <rect height="6" rx="1" width="6" x="348" y="112" />
        <rect height="6" rx="1" width="6" x="348" y="124" />
        <rect height="6" rx="1" width="6" x="348" y="136" />
        <rect height="6" rx="1" width="6" x="370" y="128" />
        <rect height="6" rx="1" width="6" x="380" y="128" />
      </g>
    </svg>
  );
}
