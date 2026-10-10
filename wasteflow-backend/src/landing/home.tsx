import { Header } from "@/landing/header";
import { HeroSection } from "@/landing/sections/hero";
import { VisionSection } from "@/landing/sections/vision";
import { PhilosophySection } from "@/landing/sections/philosophy";
import { ExperienceSection } from "@/landing/sections/experience";
import { DishesSection } from "@/landing/sections/dishes";
import { ContactSection } from "@/landing/sections/contact";
import { Footer } from "@/landing/footer";
import "./essence.css";

export function LandingHome() {
  return (
    <div className="essence">
      <main className="min-h-screen bg-background">
        <Header />
        <HeroSection />
        <VisionSection />
        <PhilosophySection />
        <ExperienceSection />
        <DishesSection />
        <ContactSection />
        <Footer />
      </main>
    </div>
  );
}
