import { login } from "@/lib/actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <div className="mx-auto mt-24 max-w-sm">
      <div className="panel">
        <h1 className="mb-1 text-xl font-semibold text-slate-100">
          JetSet<span className="text-accent">Rewards</span>
        </h1>
        <p className="mb-6 text-sm text-slate-400">
          Track every credit, every card, before it expires.
        </p>
        <form action={login} className="space-y-4">
          <div>
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoFocus
              className="mt-1 w-full"
            />
          </div>
          {error && (
            <p className="text-sm text-red-400">Wrong password, try again.</p>
          )}
          <button type="submit" className="btn-primary w-full">
            Sign in
          </button>
        </form>
      </div>
    </div>
  );
}
