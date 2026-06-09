import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { login } from "@/lib/auth";
import { getToken } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import aimployLogo from "@/assets/aimploy-logo.png";
import loginBg from "@/assets/login-bg.png";
import { Eye, EyeOff, ArrowRight } from "lucide-react";

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
          background: rgba(255, 255, 255, 0.7);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border: 1px solid rgba(0, 0, 0, 0.1);
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.6);
        }
        .dark .glass-card {
          background: rgba(20, 20, 22, 0.65);
          border: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1);
        }
        .glass-input {
          background: rgba(255, 255, 255, 0.5) !important;
          border: 1px solid rgba(0, 0, 0, 0.1) !important;
          color: black !important;
          transition: all 0.3s ease;
        }
        .dark .glass-input {
          background: rgba(0, 0, 0, 0.3) !important;
          border: 1px solid rgba(255, 255, 255, 0.1) !important;
          color: white !important;
        }
        .glass-input:focus {
          border-color: rgba(139, 92, 246, 0.5) !important;
          box-shadow: 0 0 0 4px rgba(139, 92, 246, 0.1) !important;
        }
        @keyframes shimmer {
          100% { transform: translateX(100%); }
        }
      `}</style>

      <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-slate-50 dark:bg-[#050505]">
        {/* Fullscreen Background Image */}
        <div 
          className="absolute inset-0 w-full h-full"
          style={{
            backgroundImage: `url(${loginBg})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            opacity: 0.95
          }}
        />
        
        {/* Subtle overlay to ensure the card stands out */}
        <div className="absolute inset-0 bg-slate-50/20 dark:bg-black/50 pointer-events-none" />

        {/* Ambient Grid Background */}
        <div 
          className="absolute inset-0 opacity-[0.05] dark:opacity-[0.03] pointer-events-none" 
          style={{ backgroundImage: 'linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)', backgroundSize: '50px 50px' }}
        />

        <div className="w-full max-w-md relative z-10 px-6 sm:px-0">
          <div className="glass-card rounded-[2rem] p-8 sm:p-12 overflow-hidden relative">
            {/* Subtle top glare */}
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-black/10 dark:via-white/20 to-transparent"></div>
            
            <div className="text-center space-y-6 mb-8">
              <div className="mb-4">
                <img src={aimployLogo} alt="Aimploy" className="h-8 w-auto dark:brightness-0 dark:invert mx-auto" />
              </div>
              
              <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">
                  Welcome back
                </h1>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 font-medium">
                  Enter your credentials to access your workspace
                </p>
              </div>
            </div>

            <form onSubmit={onSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium text-zinc-700 dark:text-zinc-300 ml-1">
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
                  className="h-12 rounded-xl glass-input placeholder:text-zinc-600"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between ml-1 mr-1">
                  <Label htmlFor="password" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Password
                  </Label>
                  <button
                    type="button"
                    className="text-xs text-purple-400 hover:text-purple-300 font-medium transition-colors"
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
                    className="h-12 rounded-xl glass-input pr-11 placeholder:text-zinc-600"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors p-1"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  className="w-full h-12 text-white font-bold rounded-xl border-0 shadow-[0_0_20px_rgba(139,92,246,0.25)] hover:shadow-[0_0_30px_rgba(139,92,246,0.4)] group transition-all duration-300 overflow-hidden relative"
                  style={{ background: "linear-gradient(135deg, #8B5CF6, #6366F1)" }}
                  disabled={loading}
                >
                  {/* Subtle shine effect on button */}
                  <div className="absolute inset-0 -translate-x-[150%] group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12"></div>
                  
                  {loading ? (
                    <span className="flex items-center gap-2 relative z-10">
                      <span className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Authenticating...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2 relative z-10 text-[15px]">
                      Sign in to Aimploy
                      <ArrowRight className="h-[18px] w-[18px] group-hover:translate-x-1 transition-transform" />
                    </span>
                  )}
                </Button>
              </div>
            </form>

            <div className="mt-8 text-center">
              <p className="text-sm text-zinc-600 dark:text-zinc-500">
                Don&apos;t have an account?{" "}
                <button
                  type="button"
                  onClick={() => toast.info("Contact your HR admin for workspace access.")}
                  className="text-zinc-900 dark:text-white font-medium hover:text-purple-600 dark:hover:text-purple-400 transition-colors decoration-purple-500/50 dark:decoration-purple-400 decoration-2 underline-offset-4 hover:underline"
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
