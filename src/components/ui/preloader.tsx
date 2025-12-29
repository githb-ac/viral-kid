"use client";

interface PreloaderProps {
  isLoaded: boolean;
}

export function Preloader({ isLoaded }: PreloaderProps) {
  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        backgroundColor: "#0a0a0a",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        opacity: isLoaded ? 0 : 1,
        pointerEvents: isLoaded ? "none" : "auto",
        transition: "opacity 0.8s ease-out",
      }}
    >
      <h1 className="logo-rainbow select-none font-[family-name:var(--font-logo)] text-[0.9rem] tracking-tight md:text-5xl">
        Viral Kid
      </h1>
    </div>
  );
}
