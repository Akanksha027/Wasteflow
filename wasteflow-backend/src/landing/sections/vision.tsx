"use client"

import { useEffect, useRef, useState } from "react"

export function VisionSection() {
  const [isVisible, setIsVisible] = useState(false)
  const sectionRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
        }
      },
      { threshold: 0.2 }
    )

    if (sectionRef.current) {
      observer.observe(sectionRef.current)
    }

    return () => observer.disconnect()
  }, [])

  return (
    <section 
      ref={sectionRef}
      id="vision"
      className="relative py-32 md:py-48 lg:py-64 overflow-hidden"
    >
      {/* Background Pattern */}
      <div className="absolute inset-0 pointer-events-none">
        <svg className="absolute top-0 left-0 w-full h-full opacity-[0.03]" viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs>
            <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
              <path d="M 10 0 L 0 0 0 10" fill="none" stroke="currentColor" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      <div className="max-w-[1800px] mx-auto px-6 md:px-12 lg:px-20">
        <div className="grid lg:grid-cols-12 gap-16 lg:gap-20">
          {/* Section Label */}
          <div className="lg:col-span-2">
            <div 
              className="flex items-center gap-4"
              style={{
                opacity: isVisible ? 1 : 0,
                transform: isVisible ? "translateX(0)" : "translateX(-20px)",
                transition: "all 0.8s cubic-bezier(0.16, 1, 0.3, 1)",
              }}
            >
              <span className="text-xs tracking-[0.3em] uppercase text-muted-foreground">(01)</span>
              <div className="w-8 h-px bg-border" />
              <span className="text-xs tracking-[0.3em] uppercase text-muted-foreground">Operations</span>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-10">
            <div className="space-y-16 md:space-y-24">
              {/* Large Statement */}
              <div className="overflow-hidden">
                <h2 
                  className="font-serif text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-light leading-[1.1] tracking-[-0.01em] text-foreground max-w-5xl text-pretty"
                  style={{
                    opacity: isVisible ? 1 : 0,
                    transform: isVisible ? "translateY(0)" : "translateY(60px)",
                    transitionProperty: "all",
                    transitionDuration: "1s",
                    transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
                    transitionDelay: "0.1s"
                  }}
                >
                  Waste should not disappear without a record—every stop, weight and vehicle should be visible to the people who run the city.
                </h2>
              </div>

              {/* Supporting Content */}
              <div className="grid md:grid-cols-2 gap-12 md:gap-20">
                <div 
                  className="space-y-6"
                  style={{
                    opacity: isVisible ? 1 : 0,
                    transform: isVisible ? "translateY(0)" : "translateY(40px)",
                    transitionProperty: "all",
                    transitionDuration: "0.8s",
                    transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
                    transitionDelay: "0.3s"
                  }}
                >
                  <p className="text-lg md:text-xl leading-relaxed text-foreground/80">
                    Crews collect from generators and streets, load the truck, and move material to the plant. AR ECOSYS keeps that work on a route, with a QR scan, a GPS point and a timestamp.
                  </p>
                </div>
                <div 
                  className="space-y-6"
                  style={{
                    opacity: isVisible ? 1 : 0,
                    transform: isVisible ? "translateY(0)" : "translateY(40px)",
                    transitionProperty: "all",
                    transitionDuration: "0.8s",
                    transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
                    transitionDelay: "0.4s"
                  }}
                >
                  <p className="text-lg md:text-xl leading-relaxed text-foreground/80">
                    Supervisors see which stops are done. Admins see vehicles, diesel and waybills. Drivers and field workers record the pickup instead of leaving it on paper.
                  </p>
                </div>
              </div>

              {/* Stats */}
              <div 
                className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12 pt-8 border-t border-border"
                style={{
                  opacity: isVisible ? 1 : 0,
                  transform: isVisible ? "translateY(0)" : "translateY(30px)",
                  transitionProperty: "all",
                  transitionDuration: "0.8s",
                  transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
                  transitionDelay: "0.5s"
                }}
              >
                {[
                  { value: "QR", label: "Verified pickups" },
                  { value: "GPS", label: "Timestamped stops" },
                  { value: "Live", label: "Route boards" },
                  { value: "4", label: "Staff roles" },
                ].map((stat, index) => (
                  <div key={stat.label} className="my-0 space-x-0 leading-5">
                    <span className="text-4xl md:text-5xl font-light text-foreground font-sans lg:text-8xl">
                      {stat.value}
                    </span>
                    <p className="text-xs tracking-[0.15em] uppercase text-muted-foreground">
                      {stat.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Decorative Line */}
      <div 
        className="absolute bottom-0 left-6 md:left-12 lg:left-20 right-6 md:right-12 lg:right-20 h-px bg-border"
        style={{
          transform: isVisible ? "scaleX(1)" : "scaleX(0)",
          transformOrigin: "left",
          transitionProperty: "transform",
          transitionDuration: "1.5s",
          transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
          transitionDelay: "0.6s"
        }}
      />
    </section>
  )
}
