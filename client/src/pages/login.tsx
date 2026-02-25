import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Lock, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface LoginPageProps {
  onLogin: (email: string, password: string) => Promise<void>;
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await onLogin(email, password);
    } catch (error: any) {
      toast({
        title: "Error de inicio de sesión",
        description: error.message || "Credenciales incorrectas. Por favor, verifica tu email y contraseña.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 via-blue-500 to-cyan-400 p-4 relative overflow-hidden">
      <div
        className="absolute top-[-10%] left-[-5%] w-72 h-72 rounded-full opacity-20 animate-float"
        style={{ background: "radial-gradient(circle, rgba(255,255,255,0.3), transparent 70%)", animationDuration: "7s" }}
      />
      <div
        className="absolute bottom-[-8%] right-[-3%] w-96 h-96 rounded-full opacity-15 animate-float"
        style={{ background: "radial-gradient(circle, rgba(255,255,255,0.25), transparent 70%)", animationDelay: "2s", animationDuration: "9s" }}
      />
      <div
        className="absolute top-[20%] right-[15%] w-48 h-48 rounded-full opacity-10 animate-float"
        style={{ background: "radial-gradient(circle, rgba(255,255,255,0.4), transparent 70%)", animationDelay: "4s", animationDuration: "8s" }}
      />
      <div
        className="absolute bottom-[30%] left-[10%] w-32 h-32 rounded-full opacity-15 animate-float"
        style={{ background: "radial-gradient(circle, rgba(255,255,255,0.35), transparent 70%)", animationDelay: "1s", animationDuration: "6s" }}
      />

      <div className="w-full max-w-md animate-fadeIn relative z-10">
        <div className="backdrop-blur-xl bg-white/90 dark:bg-gray-900/90 border border-white/20 shadow-2xl rounded-2xl p-8">
          <div className="space-y-4 text-center mb-8">
            <div className="mx-auto w-20 h-20 rounded-2xl overflow-hidden shadow-lg">
              <img
                src="/logo-sanchez.png"
                alt="Centro Hogar Sanchez"
                className="w-full h-full object-contain bg-white dark:bg-gray-800 p-1 rounded"
              />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Gestión de Citas</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Inicia sesión para gestionar el almacén</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-gray-700 dark:text-gray-300">Correo electrónico</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="usuario@ejemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  data-testid="input-email"
                  className="pl-10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-gray-700 dark:text-gray-300">Contraseña</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  data-testid="input-password"
                  className="pl-10"
                />
              </div>
            </div>
            <Button
              type="submit"
              className="w-full gradient-btn text-white border-0"
              disabled={isLoading}
              data-testid="button-login"
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Iniciar sesión
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
