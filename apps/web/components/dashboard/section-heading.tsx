export function SectionHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-base font-semibold tracking-tight text-slate-900 dark:text-slate-50">{title}</h2>
      <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
    </div>
  )
}
