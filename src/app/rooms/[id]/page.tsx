'use client';

import dynamic from 'next/dynamic';

const RoomDetailsClient = dynamic(() => import('./RoomDetailsClient'), { ssr: false });

export default function Page() {
  return <RoomDetailsClient />;
}
