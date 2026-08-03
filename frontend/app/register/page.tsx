"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import Link from "next/link";
import { Check, X } from "lucide-react";

function getPasswordChecks(password: string) {
  return [
    { label: "At least 8 characters", valid: password.length >= 8 },
    { label: "One uppercase letter", valid: /[A-Z]/.test(password) },
    { label: "One number", valid: /[0-9]/.test(password) },
  ];
}

export default function Register() {
  const router = useRouter();
  const { register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);

  const passwordChecks = useMemo(() => getPasswordChecks(password), [password]);
  const passwordValid = passwordChecks.every((c) => c.valid);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setPasswordTouched(true);
    if (!passwordValid) {
      setError("Please meet all password requirements below.");
      return;
    }
    setLoading(true);
    try {
      await register(email, password, name);
      router.push("/setup");
    } catch (err: any) {
      setError(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-display font-bold text-neutral-900 mb-2">Create your account</h1>
          <p className="text-neutral-500">Start practicing with AI-powered interviews</p>
        </div>

        <div className="glass rounded-2xl p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm text-neutral-500 mb-1.5 font-mono">FULL NAME</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full rounded-xl px-4 py-3 border border-neutral-200 focus:outline-none focus:border-accent/50 transition-colors"
                placeholder="Jane Smith"
              />
            </div>

            <div>
              <label className="block text-sm text-neutral-500 mb-1.5 font-mono">EMAIL</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-xl px-4 py-3 border border-neutral-200 focus:outline-none focus:border-accent/50 transition-colors"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="block text-sm text-neutral-500 mb-1.5 font-mono">PASSWORD</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onBlur={() => setPasswordTouched(true)}
                required
                className="w-full rounded-xl px-4 py-3 border border-neutral-200 focus:outline-none focus:border-accent/50 transition-colors"
                placeholder="Min. 8 characters, 1 uppercase, 1 number"
              />
              {(passwordTouched || password.length > 0) && (
                <ul className="mt-2 space-y-1">
                  {passwordChecks.map((check) => (
                    <li
                      key={check.label}
                      className={`flex items-center gap-1.5 text-xs ${check.valid ? "text-success-500" : "text-neutral-500"}`}
                    >
                      {check.valid ? <Check size={12} /> : <X size={12} />}
                      {check.label}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {error && (
              <div className="bg-error-500/10 border border-error-500/20 rounded-xl px-4 py-3">
                <p className="text-error-500 text-sm">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-accent hover:bg-accent-light disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium transition-colors"
            >
              {loading ? "Creating account..." : "Create Account"}
            </button>
          </form>

          <p className="text-center text-neutral-500 text-sm mt-6">
            Already have an account?{" "}
            <Link href="/login" className="text-accent hover:text-accent-light transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}