"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

export function Header() {
  const [isScrolled, setIsScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50)
    }
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-700 ease-out",
        isScrolled
          ? "bg-background/95 backdrop-blur-sm border-b border-border"
          : "bg-transparent"
      )}
    >
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 md:px-12 lg:px-20">
        <div className="flex items-center justify-between gap-3 h-14 sm:h-20 md:h-24">
          <a href="/" className="relative min-w-0 group">
            <span className="block truncate font-serif text-base sm:text-2xl md:text-3xl font-light tracking-[0.08em] sm:tracking-[0.2em] text-foreground">
              AR ECOSYS
            </span>
            <span className="absolute -bottom-1 left-0 w-0 h-px bg-foreground transition-all duration-500 group-hover:w-full" />
          </a>

          <a
            href="/auth"
            className="inline-flex shrink-0 items-center gap-1 px-2.5 py-1.5 text-[10px] leading-none tracking-[0.06em] uppercase text-primary-foreground bg-primary hover:bg-primary/90 transition-all duration-300 sm:gap-2 sm:px-5 sm:py-3 sm:text-sm sm:tracking-[0.1em]"
          >
            <span>Go to dashboard</span>
            <svg
              className="h-3 w-3 sm:h-4 sm:w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </a>
        </div>
      </div>
    </header>
  )
}
