"use client";
import nextDynamic from "next/dynamic";
const PuckEditor = nextDynamic(() => import("./editor"), { ssr: false });

export default function E2ETestPage() {
  return (
    <>
      <PuckEditor isEdit={true} path="/" />
    </>
  );
}
