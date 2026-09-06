export function WelcomeHeader({ name }: { name: string }) {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl dark:text-slate-50">
        Welcome back, {name}
      </h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Here is your survey operations snapshot for today.
      </p>
    </div>
  )
}
