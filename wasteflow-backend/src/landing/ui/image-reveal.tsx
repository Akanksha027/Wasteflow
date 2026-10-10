"use client"

import { useEffect, useRef, useState } from "react"

interface ImageRevealProps {
  src: string
  alt: string
  fill?: boolean
  priority?: boolean
  className?: string
  sizes?: string
  delay?: number
  width?: number
  height?: number
}

export function ImageReveal({ 
  src, 
  alt, 
  fill = true, 
  className = "", 
  delay = 0,
  width,
  height
}: ImageRevealProps) {
  const [isVisible, setIsVisible] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.1 }
    )

    if (containerRef.current) {
      observer.observe(containerRef.current)
    }

    return () => observer.disconnect()
  }, [])

  return (
    <div 
      ref={containerRef} 
      className="relative overflow-hidden"
      style={{ 
        width: fill ? '100%' : width,
        height: fill ? '100%' : height 
      }}
    >
      {/* Image */}
      {fill ? (
        <img src={src || "/placeholder.svg"} alt={alt} className={`absolute inset-0 h-full w-full ${className}`} />
      ) : (
        <img src={src || "/placeholder.svg"} alt={alt} width={width} height={height} className={className} />
      )}
      
      {/* Mask overlay - expands from top to bottom */}
      <div 
        className="absolute inset-0 bg-background"
        style={{
          transform: isVisible ? "translateY(-100%)" : "translateY(0)",
          transition: `transform 1.2s cubic-bezier(0.77, 0, 0.175, 1) ${delay}ms`,
          zIndex: 10
        }}
      />
      
      {/* Secondary reveal for depth effect */}
      <div 
        className="absolute inset-0 bg-secondary/50"
        style={{
          transform: isVisible ? "translateY(-100%)" : "translateY(0)",
          transition: `transform 1s cubic-bezier(0.77, 0, 0.175, 1) ${delay + 100}ms`,
          zIndex: 9
        }}
      />
    </div>
  )
}
