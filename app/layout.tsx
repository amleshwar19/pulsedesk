import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PulseDesk",
  description: "Autonomous Multi-Agent Triage",
  icons: {
    icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Ctext y='52' font-size='52'%3E%F0%9F%9B%8E%EF%B8%8F%3C/text%3E%3C/svg%3E"
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
