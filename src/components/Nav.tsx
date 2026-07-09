import Link from "next/link";
import { logout } from "@/lib/actions";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/inbox", label: "Inbox" },
  { href: "/wallet", label: "Wallet" },
  { href: "/admin", label: "Catalog" },
];

export default function Nav() {
  return (
    <header className="sticky top-0 z-10 border-b border-edge bg-ink/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-lg font-semibold text-accent">
          JetSet<span className="text-slate-200">Rewards</span>
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-slate-400 hover:text-accent"
            >
              {l.label}
            </Link>
          ))}
          <form action={logout}>
            <button className="text-slate-500 hover:text-slate-300" type="submit">
              Sign out
            </button>
          </form>
        </nav>
      </div>
    </header>
  );
}
