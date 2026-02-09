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
      <path d="M12 2L2 7v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7L12 2z" />
      <path d="M16 11a4 4 0 1 1-8 0 4 4 0 0 1 8 0z" />
    </svg>
  );
}
