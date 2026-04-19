import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Cloud, Lock, Shield } from "lucide-react";
import type { AuthState } from "@/App";

const loginSchema = z.object({
  identifier: z.string().min(1, "Email or username required"),
  password: z.string().min(1, "Password required"),
});
const registerSchema = z.object({
  email: z.string().email("Invalid email"),
  username: z.string().min(3, "At least 3 characters").max(32, "Max 32 characters"),
  password: z.string().min(8, "At least 8 characters"),
});

type LoginForm = z.infer<typeof loginSchema>;
type RegisterForm = z.infer<typeof registerSchema>;

export default function AuthPage({ onLogin }: { onLogin: (token: string, user: AuthState["user"]) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const loginForm = useForm<LoginForm>({ resolver: zodResolver(loginSchema), defaultValues: { identifier: "", password: "" } });
  const registerForm = useForm<RegisterForm>({ resolver: zodResolver(registerSchema), defaultValues: { email: "", username: "", password: "" } });

  const handleLogin = async (data: LoginForm) => {
    setLoading(true);
    try {
      const res = await apiRequest("POST", "/api/auth/login", data);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Login failed");
      onLogin(json.token, json.user);
      toast({ title: "Welcome back", description: `Signed in as ${json.user.username}` });
    } catch (e: any) {
      toast({ title: "Login failed", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (data: RegisterForm) => {
    setLoading(true);
    try {
      const res = await apiRequest("POST", "/api/auth/register", data);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Registration failed");
      toast({ title: "Account created", description: "Please sign in with your credentials." });
      setMode("login");
      loginForm.setValue("identifier", data.email);
    } catch (e: any) {
      toast({ title: "Registration failed", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      {/* Background grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.03] dark:opacity-[0.06]"
        style={{ backgroundImage: "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)", backgroundSize: "40px 40px" }}
      />

      <div className="relative w-full max-w-sm flex flex-col gap-6">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center shadow-lg">
            <svg viewBox="0 0 32 32" fill="none" className="w-9 h-9">
              <path d="M4 22a6 6 0 0 1 0-12 1 1 0 0 1 .1 0A7 7 0 0 1 20 10a6 6 0 0 1 5.88 4.8A5 5 0 0 1 25 25H4Z" fill="white" opacity="0.95" />
            </svg>
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold">CloudDrive</h1>
            <p className="text-xs text-muted-foreground">Secure cloud-native file storage</p>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">{mode === "login" ? "Sign in" : "Create account"}</CardTitle>
            <CardDescription className="text-xs">
              {mode === "login" ? "Enter your credentials to access CloudDrive" : "Set up a new CloudDrive account"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {mode === "login" ? (
              <Form {...loginForm}>
                <form onSubmit={loginForm.handleSubmit(handleLogin)} className="flex flex-col gap-4">
                  <FormField control={loginForm.control} name="identifier" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Email or username</FormLabel>
                      <FormControl>
                        <Input data-testid="input-identifier" placeholder="alice@clouddrive.io" {...field} />
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )} />
                  <FormField control={loginForm.control} name="password" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Password</FormLabel>
                      <FormControl>
                        <Input data-testid="input-password" type="password" placeholder="••••••••" {...field} />
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )} />
                  <Button type="submit" disabled={loading} data-testid="button-login" className="w-full">
                    {loading ? "Signing in…" : "Sign in"}
                  </Button>
                </form>
              </Form>
            ) : (
              <Form {...registerForm}>
                <form onSubmit={registerForm.handleSubmit(handleRegister)} className="flex flex-col gap-4">
                  <FormField control={registerForm.control} name="email" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Email</FormLabel>
                      <FormControl><Input data-testid="input-email" placeholder="you@example.com" {...field} /></FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )} />
                  <FormField control={registerForm.control} name="username" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Username</FormLabel>
                      <FormControl><Input data-testid="input-username" placeholder="username" {...field} /></FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )} />
                  <FormField control={registerForm.control} name="password" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Password</FormLabel>
                      <FormControl><Input data-testid="input-register-password" type="password" placeholder="Min 8 chars" {...field} /></FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )} />
                  <Button type="submit" disabled={loading} data-testid="button-register" className="w-full">
                    {loading ? "Creating…" : "Create account"}
                  </Button>
                </form>
              </Form>
            )}

            <div className="mt-4 text-center">
              <button
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setMode(mode === "login" ? "register" : "login")}
                data-testid="button-toggle-auth-mode"
              >
                {mode === "login" ? "Don't have an account? Register" : "Already have an account? Sign in"}
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Demo credentials hint */}
        <Card className="border-dashed">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start gap-2">
              <Shield className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
              <div className="text-xs text-muted-foreground space-y-1">
                <div className="font-medium text-foreground">Demo accounts</div>
                <div>admin: <span className="font-mono">alice / password123</span></div>
                <div>user: <span className="font-mono">bob / password123</span></div>
                <div>attacker: <span className="font-mono">mallory / password123</span></div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-center gap-4 text-[10px] text-muted-foreground">
          <div className="flex items-center gap-1"><Lock className="w-3 h-3" />JWT Auth</div>
          <div className="flex items-center gap-1"><Cloud className="w-3 h-3" />AWS S3 Presigned URLs</div>
        </div>
      </div>
    </div>
  );
}
