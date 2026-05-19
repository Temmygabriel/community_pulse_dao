"use client";
// app/page.tsx
// Must be a Client Component for dynamic({ ssr: false }) to work in Next.js 15 App Router.

import dynamic from "next/dynamic";

const App = dynamic(() => import("./App"), { ssr: false });

export default function Page() {
  return <App />;
}
