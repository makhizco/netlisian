import "@measured/puck/puck.css";
import "@netlisian/softconfig/puck/index.css";
// Use demo styles if any, or general tailwind
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "E2E Test Editor",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
