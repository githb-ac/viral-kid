"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { motion } from "framer-motion";
import { Loader2, Lock } from "lucide-react";
import toast from "react-hot-toast";
import { ShaderBackground } from "@/components/ui/shader-background";
import { Preloader } from "@/components/ui/preloader";
import { modalVariants, buttonHoverState } from "@/lib/animations";

export default function LoginPage() {
  const router = useRouter();
  const [isShaderLoaded, setIsShaderLoaded] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleShaderLoad = useCallback(() => {
    setIsShaderLoaded(true);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      toast.error("Please fill in all fields");
      return;
    }

    setIsLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        toast.error("Invalid email or password");
      } else {
        toast.success("Welcome back!");
        router.push("/");
        router.refresh();
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Preloader isLoaded={isShaderLoaded} />
      <main className="relative min-h-screen overflow-hidden">
        <ShaderBackground onLoad={handleShaderLoad} />
        <div className="relative z-10 flex min-h-screen flex-col items-center justify-center p-8">
          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="mb-8 rounded-2xl border border-white/10 px-8 py-4 backdrop-blur-xl"
            style={{
              background:
                "linear-gradient(to bottom, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.03) 100%)",
              boxShadow:
                "0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1), inset 0 -1px 0 rgba(0,0,0,0.2)",
            }}
          >
            <h1 className="logo-rainbow select-none font-[family-name:var(--font-logo)] text-4xl tracking-tight">
              Viral Kid
            </h1>
          </motion.div>

          {/* Login Form */}
          <motion.div
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            className="w-full max-w-md rounded-2xl border backdrop-blur-xl"
            style={{
              background:
                "linear-gradient(to bottom, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%)",
              borderColor: "rgba(255,255,255,0.1)",
              boxShadow:
                "0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1), inset 0 -1px 0 rgba(0,0,0,0.2)",
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-center gap-2 border-b border-white/10 px-6 py-4"
              style={{
                background:
                  "linear-gradient(to bottom, rgba(30,30,30,0.98) 0%, rgba(25,25,25,0.98) 100%)",
                borderRadius: "16px 16px 0 0",
              }}
            >
              <Lock className="h-4 w-4 text-white/70" />
              <h2 className="text-sm font-semibold tracking-wide text-white/90">
                Sign In
              </h2>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6">
              <div className="mb-4">
                <label
                  htmlFor="email"
                  className="mb-2 block text-sm font-semibold tracking-wide text-white/90"
                >
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email..."
                  className="w-full rounded-lg border px-4 py-3 text-white/90 outline-none backdrop-blur-xl transition-all duration-200"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    borderColor: "rgba(255,255,255,0.1)",
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = "rgba(255,255,255,0.3)";
                    e.target.style.background = "rgba(255,255,255,0.08)";
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = "rgba(255,255,255,0.1)";
                    e.target.style.background = "rgba(255,255,255,0.05)";
                  }}
                  disabled={isLoading}
                />
              </div>

              <div className="mb-6">
                <label
                  htmlFor="password"
                  className="mb-2 block text-sm font-semibold tracking-wide text-white/90"
                >
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password..."
                  className="w-full rounded-lg border px-4 py-3 text-white/90 outline-none backdrop-blur-xl transition-all duration-200"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    borderColor: "rgba(255,255,255,0.1)",
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = "rgba(255,255,255,0.3)";
                    e.target.style.background = "rgba(255,255,255,0.08)";
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = "rgba(255,255,255,0.1)";
                    e.target.style.background = "rgba(255,255,255,0.05)";
                  }}
                  disabled={isLoading}
                />
              </div>

              <motion.button
                type="submit"
                disabled={isLoading}
                className="relative flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 font-medium"
                style={{
                  color: isLoading
                    ? "rgba(255,255,255,0.3)"
                    : "rgba(255,255,255,0.9)",
                  backgroundColor: isLoading
                    ? "rgba(255,255,255,0.02)"
                    : "rgba(255,255,255,0.1)",
                  cursor: isLoading ? "not-allowed" : "pointer",
                }}
                whileHover={isLoading ? {} : buttonHoverState}
                whileTap={isLoading ? {} : { scale: 0.98 }}
                transition={{ duration: 0.15 }}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign In"
                )}
              </motion.button>
            </form>
          </motion.div>

          {/* Invite-only notice */}
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-6 text-sm text-white/40"
          >
            This is an invite-only app.
          </motion.p>
        </div>
      </main>
    </>
  );
}
