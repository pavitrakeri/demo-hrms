import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { login } from "@/lib/auth";
import { getToken } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import aimployLogo from "@/assets/aimploy-logo.png";
import loginBg from "@/assets/login-bg.png";
import { Eye, EyeOff, ArrowRight, ShieldCheck, Sparkles } from "lucide-react";

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
  const [rememberMe, setRememberMe] = useState(true);

  useEffect(() => {
    const savedEmail = localStorage.getItem("aimploy_remembered_email");
    if (savedEmail) {
      setEmail(savedEmail);
    }
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      toast.error("Please enter both email and password.");
      return;
    }

    setLoading(true);
    try {
      await login(email.trim(), password);
      if (rememberMe) {
        localStorage.setItem("aimploy_remembered_email", email.trim());
      } else {
        localStorage.removeItem("aimploy_remembered_email");
      }
      toast.success("Welcome back to Aimploy HRMS!");
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Login failed. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <style>{`
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        .animate-blob {
          animation: blob 10s infinite alternate cubic-bezier(0.4, 0, 0.2, 1);
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
        .glass-card {
          background: rgba(255, 255, 255, 0.78);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border: 1px solid rgba(255, 255, 255, 0.85);
          box-shadow: 0 25px 60px -15px rgba(109, 40, 217, 0.15), 0 0 1px 1px rgba(255, 255, 255, 0.7);
        }
        .dark .glass-card {
          background: rgba(20, 20, 26, 0.75);
          border: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.1);
        }
        .glass-input {
          background: rgba(255, 255, 255, 0.65) !important;
          border: 1px solid rgba(139, 92, 246, 0.18) !important;
          color: #1e1b4b !important;
          transition: all 0.25s ease;
        }
        .dark .glass-input {
          background: rgba(15, 15, 20, 0.45) !important;
          border: 1px solid rgba(255, 255, 255, 0.12) !important;
          color: white !important;
        }
        .glass-input:focus {
          border-color: rgba(124, 58, 237, 0.6) !important;
          box-shadow: 0 0 0 4px rgba(124, 58, 237, 0.12) !important;
          background: rgba(255, 255, 255, 0.95) !important;
        }
        @keyframes shimmer {
          100% { transform: translateX(100%); }
        }
      `}</style>

      <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-slate-50 dark:bg-[#07060F]">
        {/* Fullscreen Tech AI Background Image */}
        <div
          className="absolute inset-0 w-full h-full"
          style={{
            backgroundImage: `url(${loginBg})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            opacity: 0.92,
          }}
        />

        {/* Ambient Subtle Grid & Glow */}
        <div className="absolute inset-0 bg-gradient-to-tr from-purple-900/10 via-transparent to-indigo-900/10 pointer-events-none" />
        <div
          className="absolute inset-0 opacity-[0.04] dark:opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />

        {/* Floating Ambient Blobs */}
        <div className="absolute top-1/4 -left-20 w-80 h-80 bg-purple-400/20 rounded-full blur-3xl animate-blob pointer-events-none" />
        <div className="absolute bottom-1/4 -right-20 w-80 h-80 bg-indigo-400/20 rounded-full blur-3xl animate-blob animation-delay-2000 pointer-events-none" />

        {/* Login Card */}
        <div className="w-full max-w-md relative z-10 px-5 sm:px-0 my-8">
          <div className="glass-card rounded-3xl p-7 sm:p-10 overflow-hidden relative">
            {/* Subtle top glare highlight */}
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-purple-300/40 to-transparent" />

            <div className="text-center space-y-4 mb-7">
              {/* AiMPLOY Logo */}
              <div className="flex justify-center items-center">
                <img
                  src={aimployLogo}
                  alt="AiMPLOY"
                  className="h-9 sm:h-10 w-auto object-contain drop-shadow-xs"
                />
              </div>

              {/* Title & Badge */}
              <div className="space-y-1.5 pt-1">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-purple-100/80 text-purple-700 text-[11px] font-semibold tracking-wide">
                  <Sparkles className="h-3 w-3 text-purple-600" />
                  <span>Next-Gen HR & Operations</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                  Welcome back
                </h1>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 font-medium">
                  Enter your credentials to access your workspace
                </p>
              </div>
            </div>

            <form onSubmit={onSubmit} className="space-y-4.5">
              {/* Email Field */}
              <div className="space-y-1.5">
                <Label
                  htmlFor="email"
                  className="text-xs font-bold text-slate-700 dark:text-slate-300 ml-1"
                >
                  Email address
                </Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="name@company.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11 rounded-xl glass-input placeholder:text-slate-400 font-medium text-sm"
                />
              </div>

              {/* Password Field */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between ml-1 mr-1">
                  <Label
                    htmlFor="password"
                    className="text-xs font-bold text-slate-700 dark:text-slate-300"
                  >
                    Password
                  </Label>
                  <button
                    type="button"
                    className="text-xs text-purple-600 dark:text-purple-400 hover:text-purple-700 font-semibold transition-colors cursor-pointer"
                    onClick={() =>
                      toast.info("Please contact your Aimploy System Administrator to reset your password.")
                    }
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
                    className="h-11 rounded-xl glass-input pr-11 placeholder:text-slate-400 font-medium text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-purple-600 transition-colors p-1 cursor-pointer"
                    tabIndex={-1}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4.5 w-4.5" />
                    ) : (
                      <Eye className="h-4.5 w-4.5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Remember Me Checkbox */}
              <div className="flex items-center justify-between pt-0.5 px-1">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-600 dark:text-slate-400">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-slate-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                  />
                  <span>Remember my email</span>
                </label>
                <div className="flex items-center gap-1 text-[11px] text-slate-500">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Secure SSL</span>
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <Button
                  type="submit"
                  className="w-full h-11 text-white font-bold rounded-xl border-0 shadow-[0_4px_20px_rgba(124,58,237,0.3)] hover:shadow-[0_6px_26px_rgba(124,58,237,0.45)] group transition-all duration-300 overflow-hidden relative cursor-pointer"
                  style={{ background: "linear-gradient(135deg, #7C3AED, #6366F1)" }}
                  disabled={loading}
                >
                  <div className="absolute inset-0 -translate-x-[150%] group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12" />

                  {loading ? (
                    <span className="flex items-center gap-2 relative z-10 text-sm">
                      <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Authenticating...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2 relative z-10 text-sm font-semibold">
                      Sign in to Aimploy
                      <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                    </span>
                  )}
                </Button>
              </div>
            </form>

            {/* Bottom Footer Note */}
            <div className="mt-7 text-center pt-5 border-t border-slate-200/60 dark:border-slate-800">
              <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                New to Aimploy HRMS?{" "}
                <button
                  type="button"
                  onClick={() =>
                    toast.info("Please request your HR Manager or System Administrator to grant access.")
                  }
                  className="text-purple-600 dark:text-purple-400 font-bold hover:underline transition-colors cursor-pointer"
                >
                  Request access
                </button>
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
