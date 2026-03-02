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

  // Generate particles for background animation
  const particles = Array.from({ length: 28 }, (_, i) => ({
    left: `${(i * 3.7 + 5) % 100}%`,
    size: 2 + (i % 4),
    duration: 8 + (i % 7) * 2,
    delay: (i % 10) * 1.2,
    opacity: 0.15 + (i % 5) * 0.08,
  }));

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ backgroundColor: '#0a1628' }}
    >
      {/* Radial gradient overlays */}
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse 80% 60% at 20% 30%, rgba(13,71,161,0.35), transparent)',
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse 60% 50% at 75% 70%, rgba(21,101,192,0.2), transparent)',
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse 40% 40% at 50% 50%, rgba(25,118,210,0.12), transparent)',
        }}
      />

      {/* Grid pattern overlay */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      {/* Ascending particles */}
      {particles.map((p, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            left: p.left,
            bottom: '-10px',
            width: `${p.size}px`,
            height: `${p.size}px`,
            backgroundColor: `rgba(66, 165, 245, ${p.opacity})`,
            animation: `particleFloat ${p.duration}s linear ${p.delay}s infinite`,
          }}
        />
      ))}

      <div className="w-full max-w-md animate-fadeIn relative z-10">
        <div
          className="border p-8"
          style={{
            backdropFilter: 'blur(40px)',
            WebkitBackdropFilter: 'blur(40px)',
            background: 'rgba(10, 22, 40, 0.55)',
            borderColor: 'rgba(255, 255, 255, 0.08)',
            borderRadius: '20px',
          }}
        >
          <div className="space-y-4 text-center mb-8">
            <div className="mx-auto w-20 h-20 rounded-2xl overflow-hidden shadow-lg">
              <img
                src="/logo-sanchez.png"
                alt="Centro Hogar Sanchez"
                className="w-full h-full object-contain bg-white p-1 rounded"
              />
            </div>
            {/* Decorative line */}
            <div
              className="mx-auto w-16 h-0.5 rounded-full"
              style={{ background: 'linear-gradient(90deg, transparent, #42A5F5, transparent)' }}
            />
            <div>
              <h1 className="text-2xl font-bold text-white font-heading">Gestión de Citas</h1>
              <p className="text-sm mt-1" style={{ color: '#8ba3c4' }}>Inicia sesión para gestionar el almacén</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label
                htmlFor="email"
                className="font-heading text-xs uppercase"
                style={{ letterSpacing: '1.5px', color: '#8ba3c4' }}
              >
                Correo electrónico
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: '#5a7a9e' }} />
                <Input
                  id="email"
                  type="email"
                  placeholder="usuario@ejemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  data-testid="input-email"
                  className="pl-10 border text-white placeholder:text-white/30"
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    borderColor: 'rgba(255,255,255,0.12)',
                  }}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="password"
                className="font-heading text-xs uppercase"
                style={{ letterSpacing: '1.5px', color: '#8ba3c4' }}
              >
                Contraseña
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: '#5a7a9e' }} />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  data-testid="input-password"
                  className="pl-10 border text-white placeholder:text-white/30"
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    borderColor: 'rgba(255,255,255,0.12)',
                  }}
                />
              </div>
            </div>
            <Button
              type="submit"
              className="w-full text-white border-0 font-heading uppercase"
              style={{
                background: 'linear-gradient(135deg, #1565C0, #1976D2)',
                letterSpacing: '1px',
              }}
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
