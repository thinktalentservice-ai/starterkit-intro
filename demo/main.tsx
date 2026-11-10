import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { IntroAutoStartSwitch, IntroHelpButton, IntroProvider } from "../src";
import "../styles.css";

function App() {
  return (
    <IntroProvider pathname="/" baseUrl="/intro" onEvent={(e) => ((window as unknown as { __introEvents?: unknown[] }).__introEvents ??= []).push(e)}>
      <header>
        <h1>Intro demo</h1>
        <div className="tools">
          <IntroAutoStartSwitch />
          <IntroHelpButton />
        </div>
        <button type="button" className="alerts" data-intro="alerts">
          Alerts
        </button>
      </header>
      <main>
        <section data-intro="hero">
          <h2>Hero</h2>
          <p>The first thing visitors see.</p>
        </section>
        <section data-intro="features">
          <h2>Features</h2>
          <p>What the product does.</p>
        </section>
        <section data-intro="pricing">
          <h2>Pricing</h2>
          <p>What it costs.</p>
        </section>
        <section data-intro="settings">
          <h2>Settings</h2>
          <p>Where the knobs are.</p>
        </section>
      </main>
    </IntroProvider>
  );
}

createRoot(document.getElementById("app")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
