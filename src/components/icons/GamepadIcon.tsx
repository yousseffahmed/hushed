type GamepadIconProps = {
  className?: string;
};

export function GamepadIcon({ className = "" }: GamepadIconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M6 12h4" />
      <path d="M8 10v4" />
      <path d="M15 13h.01" />
      <path d="M18 11h.01" />
      <path d="M5.5 17.5c-1.7 0-3-1.3-3-3v-1c0-2.5 2-4.5 4.5-4.5h10c2.5 0 4.5 2 4.5 4.5v1c0 1.7-1.3 3-3 3-.9 0-1.7-.4-2.2-1.1l-1-1.4H8.2l-1 1.4c-.5.7-1.3 1.1-1.7 1.1Z" />
    </svg>
  );
}
