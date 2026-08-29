'use client';

/**
 * @deprecated Deploy button removed per design request. This component now
 * renders only the GitHub link to https://github.com/Gourab775/content-workspace
 * for backward compatibility. Prefer using the inline GitHub link in app/page.tsx.
 */
interface DeployButtonsProps {
  githubUrl?: string;
  templateSlug?: string;
}

export function DeployButtons({ githubUrl = "https://github.com/Gourab775/content-workspace" }: DeployButtonsProps) {
  return (
    <a
      href={githubUrl}
      target="_blank"
      rel="noopener noreferrer"
      title="GitHub — Gourab775/content-workspace"
      aria-label="GitHub repository"
      className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-gray-500/30 opacity-70 hover:opacity-100 transition-opacity"
    >
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 .5C5.73.5.5 5.74.5 12.02c0 5.1 3.29 9.42 7.86 10.96.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.53-1.34-1.3-1.7-1.3-1.7-1.06-.72.08-.71.08-.71 1.17.08 1.78 1.2 1.78 1.2 1.04 1.78 2.73 1.27 3.4.97.1-.75.41-1.27.74-1.56-2.56-.29-5.26-1.28-5.26-5.7 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.1 11.1 0 0 1 5.8 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.43-2.7 5.41-5.27 5.69.42.36.8 1.08.8 2.18v3.23c0 .31.21.67.8.56A11.53 11.53 0 0 0 23.5 12.02C23.5 5.74 18.27.5 12 .5z" />
      </svg>
    </a>
  );
}
