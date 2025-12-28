"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";

const ShaderGradientCanvas = dynamic(
  () => import("@shadergradient/react").then((mod) => mod.ShaderGradientCanvas),
  { ssr: false }
);

const ShaderGradientComponent = dynamic(
  () => import("@shadergradient/react").then((mod) => mod.ShaderGradient),
  { ssr: false }
);

interface ShaderBackgroundProps {
  onLoad?: () => void;
}

export function ShaderBackground({ onLoad }: ShaderBackgroundProps) {
  useEffect(() => {
    // Wait for WebGL canvas to fully initialize, start animating, and render several frames
    // This ensures the animation is already in motion before revealing
    const timer = setTimeout(() => {
      onLoad?.();
    }, 1200);
    return () => clearTimeout(timer);
  }, [onLoad]);

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
          color1="#0a0a1f"
          color2="#1a1a3d"
          color3="#2d1b4e"
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
