import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { login } from "@/lib/auth";
import { getToken } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import aimployLogo from "@/assets/aimploy-logo.png";
import hrmsBg from "@/assets/hrms-bg.png";
import { Eye, EyeOff, ArrowRight, ShieldCheck, Zap, BarChart3 } from "lucide-react";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign in — Aimploy HRMS" }] }),
  beforeLoad: () => {
    if (getToken()) throw redirect({ to: "/dashboard" });
  },
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success("Welcome back");
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex relative overflow-hidden bg-background">
      {/* Left side - background image with overlay */}
      <div className="hidden lg:flex lg:w-1/2 relative">
        <img
          src={hrmsBg}
          alt="HRMS Background"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(135deg, oklch(0.2 0.05 260 / 0.92), oklch(0.15 0.04 265 / 0.85))" }}
        />
        <div className="relative z-10 flex flex-col justify-between p-12 text-white w-full">
          <div>
            <img src={aimployLogo} alt="Aimploy" className="h-10 w-auto brightness-0 invert" />
          </div>
          <div className="space-y-8">
            <div className="space-y-4">
              <h2 className="text-3xl font-bold leading-tight">
                Streamline Your Workforce
              </h2>
              <p className="text-white/70 text-lg max-w-md leading-relaxed">
                The all-in-one HR platform that empowers your team, simplifies operations, and drives growth.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <FeatureIcon icon={ShieldCheck} label="Secure" />
              <FeatureIcon icon={Zap} label="Fast" />
              <FeatureIcon icon={BarChart3} label="Analytics" />
            </div>
          </div>
          <p className="text-white/40 text-sm">© {new Date().getFullYear()} Aimploy. All rights reserved.</p>
        </div>
      </div>

      {/* Right side - login form */}
      <div className="flex-1 flex items-center justify-center p-6 md:p-12 relative">
        {/* Floating decorative orbs */}
        <div
          className="absolute -top-40 -right-40 h-80 w-80 rounded-full opacity-20 blur-3xl pointer-events-none"
          style={{ background: "var(--gradient-brand)" }}
        />
        <div
          className="absolute -bottom-40 -left-20 h-80 w-80 rounded-full opacity-15 blur-3xl pointer-events-none"
          style={{ background: "var(--gradient-brand)" }}
        />

        <div className="w-full max-w-sm relative z-10 space-y-8">
          {/* Logo for mobile */}
          <div className="lg:hidden text-center space-y-2">
            <img src={aimployLogo} alt="Aimploy" className="h-8 w-auto mx-auto" />
          </div>

          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Welcome back
            </h1>
            <p className="text-sm text-muted-foreground">
              Sign in to your Aimploy workspace
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">
                Email address
              </Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 bg-muted/50 border-border/60 focus-visible:ring-primary/20"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-sm font-medium">
                  Password
                </Label>
                <button
                  type="button"
                  className="text-xs text-primary hover:text-primary/80 font-medium transition-colors"
                  onClick={() => toast.info("Contact your admin to reset your password.")}
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 bg-muted/50 border-border/60 pr-10 focus-visible:ring-primary/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-11 text-white font-semibold border-0 shadow-[var(--shadow-brand)] hover:opacity-90 group"
              style={{ background: "var(--gradient-brand)" }}
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in…
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Sign in
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                </span>
              )}
            </Button>
          </form>

          <div className="text-center">
            <p className="text-xs text-muted-foreground">
              Don&apos;t have an account?{" "}
              <button
                type="button"
                onClick={() => toast.info("Contact your HR admin for workspace access.")}
                className="text-primary font-medium hover:text-primary/80 transition-colors"
              >
                Request access
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureIcon({ icon: Icon, label }: { icon: typeof ShieldCheck; label: string }) {
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <div className="h-10 w-10 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/10">
        <Icon className="h-5 w-5 text-white/90" />
      </div>
      <span className="text-xs text-white/60 font-medium">{label}</span>
    </div>
  );
}
