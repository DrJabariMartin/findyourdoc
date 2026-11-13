import type { Metadata } from "next";
import Link from "next/link";
import localFont from "next/font/local";
import { currentUser } from "@/lib/session";
import { logout } from "./actions/auth";
import "./globals.css";

// Self-hosted so builds never depend on fonts.googleapis.com (and no visitor IP goes to Google).
const inter = localFont({ src: "./fonts/inter.woff2", weight: "100 900", variable: "--font-inter", display: "swap" });
const manrope = localFont({ src: "./fonts/manrope.woff2", weight: "200 800", variable: "--font-manrope", display: "swap" });

export const metadata: Metadata = {
  title: "FindYourDoc",
  description: "A verified safe haven for medical professionals, with transparent jobs and direct hiring.",
};

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5 text-ink no-underline">
      <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true">
        <path d="M16 3 L27 7 V15 C27 22 22 27 16 29 C10 27 5 22 5 15 V7 Z" fill="#0B6E69" />
        <path d="M16 10 V21 M10.5 15.5 H21.5" stroke="#FFFFFF" strokeWidth="2.6" strokeLinecap="round" />
      </svg>
      <span className="font-display font-extrabold text-xl">FindYourDoc</span>
    </Link>
  );
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  return (
    <html lang="en" className={`${inter.variable} ${manrope.variable}`}>
      <body className="min-h-screen font-sans">
        <header className="bg-white border-b border-line">
          <nav aria-label="Main" className="max-w-6xl mx-auto px-6 py-4 flex flex-wrap items-center gap-x-8 gap-y-3">
            <Logo />
            <div className="flex flex-wrap gap-x-6 gap-y-2 flex-1 font-medium text-[15px]">
              <Link href="/find" className="py-2">Find care</Link>
              <Link href="/lounge" className="py-2">The Lounge</Link>
              <Link href="/jobs" className="py-2">Jobs and locums</Link>
              <Link href="/practice" className="py-2">For practices</Link>
              <Link href="/pricing" className="py-2">Pricing</Link>
              {user?.clinician?.status === "VERIFIED" && <Link href="/schedule" className="py-2">My bookings</Link>}
              {user?.role === "ADMIN" && <Link href="/admin" className="py-2">Verification queue</Link>}
              {user?.role === "ADMIN" && <Link href="/admin/waitlist" className="py-2">Waitlist</Link>}
            </div>
            {user ? (
              <form action={logout} className="flex items-center gap-3 text-sm text-ink-2">
                <span>{user.name}{user.clinician?.status === "VERIFIED" ? " · Verified" : ""}</span>
                <button className="underline cursor-pointer">Log out</button>
              </form>
            ) : (
              <div className="flex items-center gap-4 text-sm">
                <Link href="/login">Log in</Link>
                <Link href="/signup" className="btn !py-2">Join free</Link>
              </div>
            )}
          </nav>
        </header>
        <main className="max-w-6xl mx-auto px-6 py-8 pb-16">{children}</main>
      </body>
    </html>
  );
}
