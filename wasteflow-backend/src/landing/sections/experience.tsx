"use client"

import { useEffect, useRef, useState } from "react"
import { ImageReveal } from "@/landing/ui/image-reveal"
import { photos } from "@/landing/photos"

export function ExperienceSection() {
  const [isVisible, setIsVisible] = useState(false)
  const [activeStep, setActiveStep] = useState(0)
  const sectionRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
        }
      },
      { threshold: 0.1 }
    )

    if (sectionRef.current) {
      observer.observe(sectionRef.current)
    }

    return () => observer.disconnect()
  }, [])

  const steps = [
    {
      course: "Pickup",
      timing: "On the street",
      title: "Collect the stop",
      description: "The crew reaches the generator or street point, loads bags and bins, and marks the stop once the waste is on the truck.",
      details: ["QR scan at the generator", "Bags and bins loaded", "Stop marked complete", "Next point on the route"]
    },
    {
      course: "Haul",
      timing: "On the road", 
      title: "Move with the vehicle",
      description: "The assigned truck follows the route. Supervisors can see progress instead of waiting for a call at the end of the shift.",
      details: ["Vehicle on the trip", "Stops in order", "Diesel logged", "Delays visible"]
    },
    {
      course: "Plant",
      timing: "At the yard",
      title: "Unload and sort",
      description: "The load is tipped at the facility and separated into streams such as paper, plastic and mixed waste.",
      details: ["Tip at the plant", "Material sorted", "Recoverable streams", "Residue recorded"]
    },
    {
      course: "Record",
      timing: "In the office",
      title: "Close the trip",
      description: "Waybills, weights and reports stay with the trip so the day can be reviewed without rebuilding it from memory.",
      details: ["Waybill issued", "Weights entered", "Trip history", "Reports for leadership"]
    }
  ]

  return (
    <section 
      ref={sectionRef}
      id="experience"
      className="relative py-32 md:py-48 overflow-hidden"
    >
      <div className="max-w-[1800px] mx-auto px-6 md:px-12 lg:px-20">
        <div className="grid lg:grid-cols-12 lg:gap-20">
          {/* Section Label */}
          <div className="lg:col-span-2">
            <div 
              className="flex items-center gap-4 lg:sticky lg:top-32"
              style={{
                opacity: isVisible ? 1 : 0,
                transform: isVisible ? "translateX(0)" : "translateX(-20px)",
                transition: "all 0.8s cubic-bezier(0.16, 1, 0.3, 1)",
              }}
            >
              <span className="text-xs tracking-[0.3em] uppercase text-muted-foreground">(03)</span>
              <div className="w-8 h-px bg-border" />
              <span className="text-xs tracking-[0.3em] uppercase text-muted-foreground">The day</span>
            </div>
          </div>

          {/* Content */}
          <div className="lg:col-span-10">
            {/* Section Header */}
            <div className="mb-20 md:mb-32 max-w-3xl">
              <h2 
                className="font-serif text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-light leading-[1.1] tracking-[-0.01em] text-foreground mb-8 text-pretty"
              style={{
                opacity: isVisible ? 1 : 0,
                transform: isVisible ? "translateY(0)" : "translateY(40px)",
                transitionProperty: "all",
                transitionDuration: "0.8s",
                transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
                transitionDelay: "0.1s"
              }}
              >
                From the street to the plant, in four steps
              </h2>
              <p 
                className="text-lg text-muted-foreground leading-relaxed"
              style={{
                opacity: isVisible ? 1 : 0,
                transform: isVisible ? "translateY(0)" : "translateY(30px)",
                transitionProperty: "all",
                transitionDuration: "0.8s",
                transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
                transitionDelay: "0.2s"
              }}
              >
                A trip starts at the generator, moves with the vehicle, ends at the plant, and closes with a record the office can trust.
              </p>
            </div>

            {/* Experience Image */}
            <div 
              className="relative aspect-[16/9] mb-20 md:mb-32 overflow-hidden"
              style={{
                opacity: isVisible ? 1 : 0,
                transform: isVisible ? "translateY(0)" : "translateY(40px)",
                transitionProperty: "all",
                transitionDuration: "0.8s",
                transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
                transitionDelay: "0.25s"
              }}
            >
              <ImageReveal
                src={photos.plant}
                alt="Collection truck tipping a load of waste at the AR ECOSYS plant"
                className="object-cover"
                sizes="(max-width: 1400px) 100vw, 1400px"
                delay={250}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background/40 to-transparent" />
            </div>

            {/* Experience Steps */}
            <div className="space-y-0">
              {steps.map((step, index) => (
                <div 
                  key={step.course}
                  className="group border-t border-border"
                  style={{
                    opacity: isVisible ? 1 : 0,
                    transform: isVisible ? "translateY(0)" : "translateY(30px)",
                    transitionProperty: "all",
                    transitionDuration: "0.8s",
                    transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
                    transitionDelay: `${0.3 + index * 0.1}s`
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setActiveStep(activeStep === index ? -1 : index)}
                    className="w-full py-8 md:py-12 text-left"
                    aria-expanded={activeStep === index}
                  >
                    <div className="grid md:grid-cols-12 gap-4 md:gap-8 items-start">
                      {/* Course Number & Name */}
                      <div className="md:col-span-3 flex items-center gap-4">
                        <span className="font-mono text-xs tracking-wider text-muted-foreground">
                          0{index + 1}
                        </span>
                        <span className="font-serif text-xl md:text-2xl text-foreground group-hover:text-accent transition-colors duration-300">
                          {step.course}
                        </span>
                      </div>

                      {/* Title */}
                      <div className="md:col-span-6">
                        <h3 className="text-lg md:text-xl text-foreground/80 group-hover:text-foreground transition-colors duration-300">
                          {step.title}
                        </h3>
                      </div>

                      {/* Timing & Toggle */}
                      <div className="md:col-span-3 flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">
                          {step.timing}
                        </span>
                        <div className="w-6 h-6 flex items-center justify-center">
                          <span 
                            className="text-lg text-muted-foreground transition-transform duration-300"
                            style={{ transform: activeStep === index ? "rotate(45deg)" : "rotate(0)" }}
                          >
                            +
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>

                  {/* Expanded Content */}
                  <div 
                    className="overflow-hidden transition-all duration-500 ease-out"
                    style={{ 
                      maxHeight: activeStep === index ? "400px" : "0",
                      opacity: activeStep === index ? 1 : 0
                    }}
                  >
                    <div className="pb-12 md:pb-16 grid md:grid-cols-12 gap-8">
                      <div className="md:col-span-3" />
                      <div className="md:col-span-6 space-y-6">
                        <p className="text-muted-foreground leading-relaxed">
                          {step.description}
                        </p>
                        <ul className="grid grid-cols-2 gap-3">
                          {step.details.map((detail) => (
                            <li key={detail} className="flex items-center gap-2 text-sm text-foreground/70">
                              <span className="w-1 h-1 bg-accent" />
                              {detail}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              <div className="border-t border-border" />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
