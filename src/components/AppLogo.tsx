import type { SVGProps } from 'react';

export default function AppLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M10 22v-8" />
      <path d="M6 14v8" />
      <path d="M18 14v8" />
      <path d="M14 10v4" />
      <path d="M10 10v4" />
      <path d="M10 4v2" />
      <path d="M10 8v2" />
      <path d="M18 12V2H6v10Z" />
      <path d="M6 6h12" />
    </svg>
  );
}
