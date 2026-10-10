"use client"

import { useEffect, useRef, useState } from "react"
import { ImageReveal } from "@/landing/ui/image-reveal"

export function ProjectsSection() {
  const [isVisible, setIsVisible] = useState(false)
  const [activeProject, setActiveProject] = useState(0)
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

  const projects = [
    {
      id: 1,
      title: "Cascade Retreat",
      location: "Snoqualmie Valley, WA",
      year: "2023",
      area: "4,200 sq ft",
      image: "/images/project-1.jpg",
      description: "A weekend sanctuary for a family of five, designed to frame views of the Cascade foothills while providing intimate spaces for rest and reconnection. The home's linear form follows the ridge, with living spaces opening to a protected courtyard.",
      awards: ["AIA Northwest Honor Award", "Dwell Design Award Finalist"]
    },
    {
      id: 2,
      title: "Puget Overlook",
      location: "Bainbridge Island, WA", 
      year: "2022",
      area: "3,800 sq ft",
      image: "/images/project-2.jpg",
      description: "Perched on a bluff above Puget Sound, this residence celebrates the horizontal—long, low roof planes and bands of glazing that emphasize the endless water views. Native plantings blur the boundary between garden and surrounding forest.",
      awards: ["Western Living Design Award", "AIA Seattle Citation"]
    },
    {
      id: 3,
      title: "Forest House",
      location: "Woodinville, WA",
      year: "2021", 
      area: "5,100 sq ft",
      image: "/images/project-3.jpg",
      description: "Set within a second-growth Douglas fir forest, this home is organized around a double-height living space that brings the canopy inside. Cedar siding weathers to match the surrounding tree bark, embedding the house into its context.",
      awards: ["Residential Architect Design Award"]
    }
  ]

  return (
    <section 
      ref={sectionRef}
      id="projects"
      className="relative py-32 md:py-48 overflow-hidden"
    >
      <div className="max-w-[1800px] mx-auto px-6 md:px-12 lg:px-20">
        {/* Section Header */}
        <div className="grid lg:grid-cols-12 gap-16 lg:gap-20 mb-20 md:mb-32">
          <div className="lg:col-span-2">
            <div 
              className="flex items-center gap-4"
              style={{
                opacity: isVisible ? 1 : 0,
                transform: isVisible ? "translateX(0)" : "translateX(-20px)",
                transition: "all 0.8s cubic-bezier(0.16, 1, 0.3, 1)",
              }}
            >
              <span className="text-xs tracking-[0.3em] uppercase text-muted-foreground">(05)</span>
              <div className="w-8 h-px bg-border" />
              <span className="text-xs tracking-[0.3em] uppercase text-muted-foreground">Work</span>
            </div>
          </div>
          
          <div className="lg:col-span-10">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-8">
              <h2 
                className="font-serif text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-light leading-[1.1] tracking-[-0.01em] text-foreground max-w-2xl text-pretty"
                style={{
                  opacity: isVisible ? 1 : 0,
                  transform: isVisible ? "translateY(0)" : "translateY(40px)",
                  transitionProperty: "all",
                  transitionDuration: "0.8s",
                  transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
                  transitionDelay: "0.1s"
                }}
              >
                Selected projects
              </h2>
              <a 
                href="#contact"
                className="inline-flex items-center gap-3 text-sm tracking-[0.1em] uppercase text-muted-foreground hover:text-foreground transition-colors duration-300 group"
                style={{
                  opacity: isVisible ? 1 : 0,
                  transform: isVisible ? "translateY(0)" : "translateY(20px)",
                  transitionProperty: "all",
                  transitionDuration: "0.8s",
                  transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
                  transitionDelay: "0.2s"
                }}
              >
                <span>View all projects</span>
                <svg className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </a>
            </div>
          </div>
        </div>

        {/* Featured Project Display */}
        <div 
          className="grid lg:grid-cols-12 gap-8 lg:gap-12"
          style={{
            opacity: isVisible ? 1 : 0,
            transform: isVisible ? "translateY(0)" : "translateY(40px)",
            transitionProperty: "all",
            transitionDuration: "0.8s",
            transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
            transitionDelay: "0.3s"
          }}
        >
          {/* Main Image */}
          <div className="lg:col-span-8 relative">
            <div className="relative aspect-[4/3] overflow-hidden bg-secondary">
              {projects.map((project, index) => (
                <div
                  key={project.id}
                  className="absolute inset-0 transition-opacity duration-700"
                  style={{ opacity: activeProject === index ? 1 : 0 }}
                >
                  {activeProject === index ? (
                    <ImageReveal
                      src={project.image || "/placeholder.svg"}
                      alt={project.title}
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, 66vw"
                      priority={index === 0}
                      delay={300}
                    />
                  ) : (
                    <img src={project.image || "/placeholder.svg"} alt={project.title} className="absolute inset-0 h-full w-full object-cover" />
                  )}
                </div>
              ))}
              
              {/* Image Overlay Info */}
              <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10 bg-gradient-to-t from-primary/90 to-transparent">
                <div className="text-primary-foreground">
                  <div className="flex items-center gap-4 mb-4">
                    <span className="text-xs tracking-[0.2em] uppercase opacity-70">
                      {projects[activeProject].location}
                    </span>
                    <div className="w-8 h-px bg-primary-foreground/30" />
                    <span className="text-xs tracking-[0.2em] uppercase opacity-70">
                      {projects[activeProject].year}
                    </span>
                  </div>
                  <h3 className="font-serif text-3xl md:text-4xl lg:text-5xl font-light">
                    {projects[activeProject].title}
                  </h3>
                </div>
              </div>
            </div>
          </div>

          {/* Project Info */}
          <div className="lg:col-span-4 flex flex-col justify-between">
            {/* Description */}
            <div className="space-y-6 mb-8 lg:mb-0">
              <div className="flex items-center gap-4 text-sm">
                <span className="text-muted-foreground">Area</span>
                <div className="flex-1 h-px bg-border" />
                <span className="text-foreground">{projects[activeProject].area}</span>
              </div>
              
              <p className="text-muted-foreground leading-relaxed">
                {projects[activeProject].description}
              </p>

              {/* Awards */}
              <div className="space-y-3">
                <span className="text-xs tracking-[0.2em] uppercase text-muted-foreground">Recognition</span>
                <ul className="space-y-2">
                  {projects[activeProject].awards.map((award) => (
                    <li key={award} className="flex items-start gap-3 text-sm text-foreground/80">
                      <span className="w-1 h-1 mt-2 bg-accent shrink-0" />
                      {award}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Project Navigation */}
            <div className="space-y-4 pt-8 border-t border-border">
              {projects.map((project, index) => (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => setActiveProject(index)}
                  className={`w-full text-left py-3 px-4 transition-all duration-300 ${
                    activeProject === index 
                      ? "bg-primary text-primary-foreground" 
                      : "hover:bg-secondary"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <span className="font-mono text-xs opacity-50">0{index + 1}</span>
                      <span className="font-serif text-lg">{project.title}</span>
                    </div>
                    <svg 
                      className={`w-4 h-4 transition-transform duration-300 ${
                        activeProject === index ? "translate-x-0 opacity-100" : "-translate-x-2 opacity-0"
                      }`} 
                      fill="none" 
                      viewBox="0 0 24 24" 
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
