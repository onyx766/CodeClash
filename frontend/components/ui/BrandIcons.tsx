type IconProps = { size?: number; className?: string };

export function GithubIcon({ size = 16, className = "" }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M12 .5C5.73.5.9 5.34.9 11.62c0 4.9 3.17 9.05 7.57 10.52.55.1.75-.24.75-.53l-.01-1.86c-3.08.67-3.73-1.49-3.73-1.49-.5-1.29-1.23-1.63-1.23-1.63-1.01-.69.08-.67.08-.67 1.11.08 1.7 1.15 1.7 1.15.99 1.7 2.6 1.21 3.23.93.1-.72.39-1.21.7-1.49-2.46-.28-5.05-1.23-5.05-5.49 0-1.21.43-2.2 1.14-2.98-.11-.28-.5-1.41.11-2.94 0 0 .93-.3 3.05 1.14a10.5 10.5 0 0 1 5.56 0c2.12-1.44 3.05-1.14 3.05-1.14.61 1.53.23 2.66.11 2.94.71.78 1.14 1.77 1.14 2.98 0 4.27-2.6 5.21-5.07 5.48.4.35.76 1.03.76 2.08l-.01 3.08c0 .3.2.64.76.53 4.4-1.47 7.56-5.62 7.56-10.52C23.1 5.34 18.27.5 12 .5Z" />
    </svg>
  );
}

export function XIcon({ size = 16, className = "" }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M17.53 3h3.24l-7.08 8.09L22 21h-6.52l-5.11-6.68L4.53 21H1.28l7.57-8.65L2 3h6.69l4.62 6.11L17.53 3Zm-1.14 16.06h1.8L7.7 4.85H5.77l10.62 14.21Z" />
    </svg>
  );
}

export function LinkedinIcon({ size = 16, className = "" }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M4.98 3.5A2.5 2.5 0 1 1 0 3.5a2.5 2.5 0 0 1 4.98 0ZM.24 8.25h4.5V24H.24V8.25ZM8.36 8.25h4.31v2.15h.06c.6-1.14 2.07-2.34 4.26-2.34 4.56 0 5.4 3 5.4 6.9V24h-4.5v-7.95c0-1.9-.03-4.34-2.64-4.34-2.65 0-3.05 2.07-3.05 4.2V24h-4.5V8.25Z" />
    </svg>
  );
}

export function DiscordIcon({ size = 16, className = "" }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M20.32 4.57A19.8 19.8 0 0 0 15.43 3l-.24.44c1.6.4 2.94 1 4.15 1.85a13.9 13.9 0 0 0-4.87-1.16 15.1 15.1 0 0 0-6.1.63c-.72.24-1.4.51-2.05.83 1.24-.87 2.63-1.5 4.28-1.9L10.36 3a19.8 19.8 0 0 0-4.9 1.57C2.4 9.16 1.57 13.62 2 18.02A19.8 19.8 0 0 0 8 21l1.22-1.68c-1-.35-1.9-.79-2.72-1.34l.55-.42a13.9 13.9 0 0 0 11.9 0l.55.42c-.82.55-1.73 1-2.72 1.34L18 21a19.8 19.8 0 0 0 6-2.98c.5-5.1-.85-9.52-3.68-13.45ZM8.63 15.43c-1.17 0-2.13-1.07-2.13-2.39s.94-2.39 2.13-2.39c1.2 0 2.15 1.08 2.13 2.39 0 1.32-.94 2.39-2.13 2.39Zm6.74 0c-1.17 0-2.13-1.07-2.13-2.39s.94-2.39 2.13-2.39c1.2 0 2.15 1.08 2.13 2.39 0 1.32-.93 2.39-2.13 2.39Z" />
    </svg>
  );
}

export function YoutubeIcon({ size = 16, className = "" }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M23.5 6.85a3 3 0 0 0-2.11-2.13C19.5 4.2 12 4.2 12 4.2s-7.5 0-9.39.52A3 3 0 0 0 .5 6.85 31.3 31.3 0 0 0 0 12a31.3 31.3 0 0 0 .5 5.15 3 3 0 0 0 2.11 2.13c1.89.52 9.39.52 9.39.52s7.5 0 9.39-.52a3 3 0 0 0 2.11-2.13A31.3 31.3 0 0 0 24 12a31.3 31.3 0 0 0-.5-5.15ZM9.6 15.57V8.43L15.82 12 9.6 15.57Z" />
    </svg>
  );
}

export function GoogleIcon({ size = 16, className = "" }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
    >
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46a5.53 5.53 0 0 1-2.4 3.62v3.01h3.88c2.27-2.09 3.58-5.17 3.58-8.82Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.08 7.94-2.91l-3.88-3.01c-1.08.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.95H1.28v3.11A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.29 14.28a7.2 7.2 0 0 1 0-4.56V6.61H1.28a12 12 0 0 0 0 10.78l4.01-3.11Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.76 0 3.34.61 4.59 1.8l3.44-3.44C17.95 1.18 15.23 0 12 0A12 12 0 0 0 1.28 6.61l4.01 3.11C6.23 6.87 8.88 4.75 12 4.75Z"
      />
    </svg>
  );
}
