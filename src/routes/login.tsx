import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { login } from "@/lib/auth";
import { getToken } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import teamImg from "@/assets/team-collaboration.jpg";
import { AimwearLogo } from "@/components/aimwear-logo";
import {
  Eye,
  EyeOff,
  User,
  Lock,
  Calendar,
  Leaf,
  CreditCard,
  Users,
  Search,
  FileText,
  Globe,
  ChevronDown,
} from "lucide-react";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign In — Aimwear HRMS" }] }),
  beforeLoad: () => {
    if (getToken()) throw redirect({ to: "/dashboard" });
  },
  component: LoginPage,
});

const FEATURES = [
  {
    icon: Calendar,
    title: "Attendance",
    subtitle: "& GPS Tracking",
    bgColor: "bg-purple-100",
    iconColor: "text-purple-600",
  },
  {
    icon: Leaf,
    title: "Leave",
    subtitle: "Management",
    bgColor: "bg-emerald-100",
    iconColor: "text-emerald-600",
  },
  {
    icon: CreditCard,
    title: "Payroll",
    subtitle: "& Compliance",
    bgColor: "bg-orange-100",
    iconColor: "text-orange-600",
  },
  {
    icon: Users,
    title: "Employee",
    subtitle: "Management",
    bgColor: "bg-blue-100",
    iconColor: "text-blue-600",
  },
  {
    icon: Search,
    title: "Recruitment",
    subtitle: "& Hiring",
    bgColor: "bg-rose-100",
    iconColor: "text-rose-600",
  },
  {
    icon: FileText,
    title: "Documents",
    subtitle: "& Policies",
    bgColor: "bg-teal-100",
    iconColor: "text-teal-600",
  },
];

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const savedEmail = localStorage.getItem("aimwear_remembered_email");
    if (savedEmail) {
      setEmail(savedEmail);
    }
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      toast.error("Please enter your email and password");
      return;
    }

    setLoading(true);
    try {
      await login(email.trim(), password);
      localStorage.setItem("aimwear_remembered_email", email.trim());
      toast.success("Welcome back! Redirecting to workspace...");
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Login failed. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[100dvh] lg:h-[100dvh] w-full flex items-center justify-center bg-[#EBE8FC] p-3 sm:p-5 lg:p-6 font-sans select-none overflow-y-auto lg:overflow-hidden">
      {/* Soft Background Canvas Card Container - Screen-filling */}
      <div className="w-full max-w-6xl xl:max-w-7xl lg:h-[88vh] lg:max-h-[860px] bg-gradient-to-br from-[#F6F4FE] via-[#FAF9FF] to-[#EAE6FC] rounded-2xl sm:rounded-3xl shadow-xl shadow-indigo-900/10 border border-white/80 p-5 sm:p-7 lg:p-8 relative overflow-hidden flex flex-col justify-between my-auto">
        
        {/* Ambient Organic Curve Shapes */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-purple-200/40 via-indigo-100/30 to-transparent rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-80 h-80 bg-gradient-to-tr from-purple-200/30 via-pink-100/20 to-transparent rounded-full blur-3xl pointer-events-none" />

        {/* Top Header Row: Compatible Aimwear Brand Logo */}
        <div className="relative z-10 flex items-center justify-between w-full mb-3 lg:mb-4">
          <AimwearLogo size="lg" variant="light" />

          {/* Language Selector */}
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-white/80 hover:bg-white px-3 py-1.5 rounded-full border border-slate-200/60 shadow-2xs backdrop-blur-sm cursor-pointer transition-all">
            <Globe className="h-4 w-4 text-slate-500" />
            <span>English</span>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
          </div>
        </div>

        {/* Main 2-Column Content */}
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-center flex-1 my-auto">
          
          {/* Left Hero Column */}
          <div className="lg:col-span-7 xl:col-span-7 flex flex-col justify-center space-y-4 lg:space-y-5">
            {/* Pill Badge */}
            <div className="w-fit">
              <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#E5DDFE] text-[#5432D3] text-xs font-bold tracking-wide">
                All-in-one HR Management
              </span>
            </div>

            {/* Subtitle */}
            <p className="text-sm sm:text-base text-slate-600 max-w-xl font-medium leading-relaxed">
              Simplify HR operations, empower your people, and build a better workplace with Aimwear HRMS.
            </p>

            {/* 6 Features Grid (2 columns x 3 rows on small, 3 cols on medium/large) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
              {FEATURES.map((item) => (
                <div
                  key={item.title}
                  className="flex items-center gap-2.5 p-1.5 rounded-lg"
                >
                  <div
                    className={`h-8 w-8 rounded-lg ${item.bgColor} ${item.iconColor} flex items-center justify-center shrink-0 shadow-2xs`}
                  >
                    <item.icon className="h-4 w-4" />
                  </div>
                  <div className="text-xs font-bold text-slate-800 leading-tight">
                    <div>{item.title}</div>
                    <div className="text-slate-500 font-medium text-[10px] sm:text-[11px]">{item.subtitle}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Bottom Testimonial / Team Photo Card */}
            <div className="pt-1">
              <div className="bg-white/85 backdrop-blur-md rounded-xl p-3 sm:p-3.5 border border-white/90 shadow-sm shadow-purple-900/5 flex flex-col sm:flex-row items-center justify-between gap-3 max-w-lg">
                <div className="space-y-1.5 text-left">
                  <p className="text-xs sm:text-sm font-bold text-slate-800 leading-snug">
                    “A smarter workplace<br />for a brighter tomorrow.”
                  </p>
                  <div className="h-0.5 w-6 bg-[#5432D3] rounded-full" />
                </div>
                <div className="w-full sm:w-40 h-16 sm:h-18 rounded-lg overflow-hidden shadow-inner shrink-0">
                  <img
                    src={teamImg}
                    alt="Aimwear Team"
                    className="w-full h-full object-cover object-center"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right Login Card Column */}
          <div className="lg:col-span-5 xl:col-span-5 flex justify-center lg:justify-end">
            <div className="w-full max-w-md bg-white rounded-2xl p-6 sm:p-7 lg:p-8 shadow-xl shadow-purple-900/10 border border-slate-100 space-y-4">
              
              {/* Card Header */}
              <div className="space-y-1">
                <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                  Welcome Back
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 font-medium">
                  Sign in to your Aimwear HRMS account
                </p>
              </div>

              {/* Login Form */}
              <form onSubmit={onSubmit} className="space-y-3.5 pt-1">
                {/* Email or Mobile Number */}
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs font-bold text-slate-800">
                    Email or Mobile Number
                  </Label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                      <User className="h-4 w-4" />
                    </div>
                    <Input
                      id="email"
                      type="text"
                      autoComplete="username"
                      placeholder="Enter your email or mobile number"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-10 pl-9 rounded-lg bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-[#5432D3] focus:ring-2 focus:ring-purple-500/10 text-xs sm:text-sm font-medium transition-all"
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-xs font-bold text-slate-800">
                    Password
                  </Label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                      <Lock className="h-4 w-4" />
                    </div>
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      placeholder="Enter your password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-10 pl-9 pr-10 rounded-lg bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-[#5432D3] focus:ring-2 focus:ring-purple-500/10 text-xs sm:text-sm font-medium transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1"
                      tabIndex={-1}
                      title={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Forgot password */}
                <div className="flex justify-end pt-0.5">
                  <button
                    type="button"
                    onClick={() =>
                      toast.info("Please contact your Aimwear system administrator to reset your password.")
                    }
                    className="text-xs font-semibold text-[#5432D3] hover:text-[#4321B8] transition-colors"
                  >
                    Forgot password?
                  </button>
                </div>

                {/* Sign In Button */}
                <div className="pt-1">
                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full h-10 rounded-lg bg-[#5432D3] hover:bg-[#4524BD] text-white font-bold text-xs sm:text-sm shadow-sm shadow-purple-500/20 transition-all cursor-pointer"
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="h-3.5 w-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                        <span>Signing In...</span>
                      </span>
                    ) : (
                      <span>Sign In</span>
                    )}
                  </Button>
                </div>
              </form>

              {/* Bottom Footer Note */}
              <div className="text-center pt-2.5 border-t border-slate-100">
                <p className="text-xs text-slate-500 font-medium">
                  New to Aimwear HRMS?{" "}
                  <button
                    type="button"
                    onClick={() =>
                      toast.info("Please request your HR Manager or System Administrator to grant access.")
                    }
                    className="text-[#5432D3] font-bold hover:underline transition-colors"
                  >
                    Contact administrator
                  </button>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;

