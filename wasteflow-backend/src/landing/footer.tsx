"use client"

const pageLinks = [
  { href: "#vision", label: "Operations" },
  { href: "#philosophy", label: "How we work" },
  { href: "#experience", label: "The day" },
  { href: "#dishes", label: "In the field" },
  { href: "#contact", label: "Staff" },
]

const records = ["QR pickups", "Routes", "Vehicles", "Weights", "Waybills"]

export function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="bg-primary text-primary-foreground">
      <div className="h-px bg-accent" />
      <div className="mx-auto max-w-[1800px] px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-10 sm:px-6 sm:pt-14 md:px-12 md:pt-20 lg:px-20">
        <div className="grid gap-9 sm:gap-12 md:grid-cols-12 md:items-start">
          <div className="md:col-span-5">
            <a href="/" className="inline-block">
              <span className="font-serif text-lg font-light tracking-[0.14em] text-primary-foreground sm:text-2xl sm:tracking-[0.2em] md:text-3xl">
                AR ECOSYS
              </span>
            </a>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-primary-foreground/70 sm:mt-4">
              Municipal and commercial waste collection, tracked from the generator to the plant.
            </p>
          </div>

          <nav aria-label="On this page" className="md:col-span-4">
            <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-primary-foreground/45">
              On this page
            </p>
            <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 sm:mt-4 sm:gap-y-2">
              {pageLinks.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="inline-flex min-h-9 items-center text-sm text-primary-foreground/85 transition-colors duration-300 hover:text-primary-foreground"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="md:col-span-3">
            <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-primary-foreground/45">
              On record
            </p>
            <ul className="mt-3 grid grid-cols-2 gap-2 sm:mt-4 md:flex md:flex-col md:gap-2.5">
              {records.map((item) => (
                <li
                  key={item}
                  className="border border-primary-foreground/15 px-2.5 py-1 text-[11px] uppercase tracking-[0.12em] text-primary-foreground/75 md:border-0 md:px-0 md:py-0 md:text-sm md:normal-case md:tracking-normal"
                >
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-8 flex items-center justify-between gap-3 border-t border-primary-foreground/15 pt-4 sm:mt-12 sm:pt-6">
          <p className="text-[11px] leading-snug text-primary-foreground/55 sm:text-xs">
            © {currentYear} AR ECOSYS
          </p>
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="inline-flex shrink-0 items-center gap-1.5 border border-primary-foreground/20 px-2.5 py-2 text-[10px] uppercase tracking-[0.14em] text-primary-foreground/80 transition-colors duration-300 hover:border-primary-foreground/50 hover:text-primary-foreground sm:px-3 sm:tracking-[0.16em]"
          >
            <span>Top</span>
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 15l7-7 7 7" />
            </svg>
          </button>
        </div>
      </div>
    </footer>
  )
}
