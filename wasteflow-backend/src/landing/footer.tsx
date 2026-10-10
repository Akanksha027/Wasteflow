"use client"

export function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="relative py-16 md:py-24 border-t border-border">
      <div className="max-w-[1800px] mx-auto px-6 md:px-12 lg:px-20">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-10">
          <div className="space-y-6 max-w-md">
            <a href="/" className="inline-block">
              <span className="font-serif text-xl sm:text-2xl md:text-3xl font-light tracking-[0.12em] sm:tracking-[0.2em] text-foreground">
                AR ECOSYS
              </span>
            </a>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Municipal and commercial waste collection, tracked from the generator to the plant: QR scans, routes, vehicles, diesel and waybills.
            </p>
          </div>
        </div>

        <div className="mt-16 pt-8 border-t border-border flex flex-col md:flex-row items-center justify-between gap-6">
          <p className="text-xs text-muted-foreground">
            © {currentYear} AR ECOSYS. All rights reserved.
          </p>
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="group flex items-center gap-2 text-xs tracking-[0.1em] uppercase text-muted-foreground hover:text-foreground transition-colors duration-300"
          >
            <span>Back to top</span>
            <svg
              className="w-4 h-4 transition-transform duration-300 group-hover:-translate-y-1"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
          </button>
        </div>
      </div>
    </footer>
  )
}
