"use client";

import dynamic from "next/dynamic";
import { useState, useEffect } from "react";

const ShaderGradientCanvas = dynamic(
  () => import("@shadergradient/react").then((mod) => mod.ShaderGradientCanvas),
  { ssr: false }
);

const ShaderGradientComponent = dynamic(
  () => import("@shadergradient/react").then((mod) => mod.ShaderGradient),
  { ssr: false }
);

export function ShaderBackground() {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Wait for WebGL canvas to fully initialize and render first frame
    const timer = setTimeout(() => setIsLoaded(true), 300);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        zIndex: 0,
        pointerEvents: "none",
        opacity: isLoaded ? 1 : 0,
        transition: "opacity 1s ease-out",
      }}
    >
      <ShaderGradientCanvas
        style={{
          width: "100%",
          height: "100%",
        }}
        pixelDensity={1}
        fov={45}
      >
        <ShaderGradientComponent
          type="sphere"
          animate="on"
          uAmplitude={3.2}
          uDensity={0.8}
          uSpeed={0.3}
          uStrength={0.3}
          uFrequency={5.5}
          uTime={0}
          cAzimuthAngle={270}
          cDistance={0.5}
          cPolarAngle={180}
          cameraZoom={15.1}
          positionX={-0.1}
          positionY={0}
          positionZ={0}
          rotationX={0}
          rotationY={130}
          rotationZ={70}
          color1="#73bfc4"
          color2="#ff810a"
          color3="#8da0ce"
          brightness={0.8}
          reflection={0.4}
          wireframe={false}
          grain="on"
          lightType="env"
          envPreset="city"
        />
      </ShaderGradientCanvas>
    </div>
  );
}
