import Hero from "../components/home/Hero";
import Intro from "../components/home/Intro";
import HowItWorks from "../components/home/HowItWorks";
import Features from "../components/home/Features";
import Stats from "../components/home/Stats";
import FinalCta from "../components/home/FinalCta";

export default function Home(){
  return (
    <div>
      <Hero />
      <Intro />
      <main className="section">
        <div className="cc-container">
          <HowItWorks />
        </div>
      </main>
      <section className="section">
        <div className="cc-container">
          <Features />
        </div>
      </section>
      <section className="section">
        <div className="cc-container">
          <Stats />
        </div>
      </section>
      <FinalCta />
    </div>
  );
}
