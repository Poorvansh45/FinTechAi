export function StatsStrip() {
  const stats = [
    { value: '10K+', label: 'Stocks Analyzed' },
    { value: '99.8%', label: 'Uptime' },
    { value: '24/7', label: 'Data Updates' },
    { value: 'AI', label: 'Insights Engine' },
  ]
  return (
    <section id="stats" className="w-full py-8 bg-card/30 anchor-offset">
      <div className="container px-4 md:px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {stats.map((s) => (
            <div key={s.label} className="space-y-1">
              <div className="text-2xl md:text-3xl font-bold">{s.value}</div>
              <div className="text-xs md:text-sm text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
