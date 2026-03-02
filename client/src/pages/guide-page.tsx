import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { PageHero } from '@/components/page-hero';
import {
  BookOpen, ChevronDown, ChevronUp, MessageSquare, Calendar, ClipboardCheck,
  Gauge, Warehouse, Package, Bell, Shield, BarChart3, Settings2, Users,
  Truck, Clock, Zap, ArrowRight, HelpCircle,
} from "lucide-react";

const sections = [
  { id: "what", title: "Que es esto?", icon: HelpCircle },
  { id: "process", title: "El proceso: de la llamada a la descarga", icon: ArrowRight },
  { id: "points", title: "Sistema de puntos y capacidad", icon: Gauge },
  { id: "times", title: "Calculo de tiempos", icon: Clock },
  { id: "precision", title: "Precision IA — aprendizaje continuo", icon: BarChart3 },
  { id: "docks", title: "Muelles de descarga", icon: Warehouse },
  { id: "providers", title: "Proveedores", icon: Package },
  { id: "emails", title: "Emails y notificaciones", icon: Bell },
  { id: "audit", title: "Auditoria", icon: Shield },
  { id: "pages", title: "Mapa de paginas", icon: Calendar },
];

export default function GuidePage() {
  const [openSections, setOpenSections] = useState<Set<string>>(
    () => new Set(sections.map((s) => s.id))
  );

  const toggleSection = (id: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allOpen = openSections.size === sections.length;
  const toggleAll = () => {
    if (allOpen) setOpenSections(new Set());
    else setOpenSections(new Set(sections.map((s) => s.id)));
  };

  return (
    <div className="space-y-6 pb-8">
      <PageHero
        icon={BookOpen}
        title="Guía de Uso"
        subtitle="Todo lo que necesitas saber para usar Elias y gestionar el almacen"
        actions={
          <Button variant="outline" size="sm" onClick={toggleAll} className="hero-btn-ghost border-0">
            {allOpen ? <ChevronUp className="h-4 w-4 mr-1" /> : <ChevronDown className="h-4 w-4 mr-1" />}
            {allOpen ? "Colapsar todo" : "Expandir todo"}
          </Button>
        }
      />

      {/* Section 1: What is this? */}
      <GuideSection id="what" title={sections[0].title} icon={sections[0].icon} open={openSections.has("what")} onToggle={toggleSection}>
        <p>
          Centro Hogar Sanchez recibe mercancia de decenas de proveedores cada semana.
          Este sistema gestiona las <strong>citas de descarga del almacen</strong> para que:
        </p>
        <ul className="list-disc pl-5 space-y-1 mt-3">
          <li>Los proveedores puedan reservar hora de descarga hablando con <strong>Elias</strong>, nuestro asistente IA, por chat</li>
          <li>El equipo de almacen vea todas las descargas del dia/semana/mes organizadas en el calendario</li>
          <li>No se acumulen demasiados camiones a la misma hora</li>
          <li>Se calcule automaticamente cuanto tiempo lleva cada descarga</li>
        </ul>
        <div className="grid sm:grid-cols-2 gap-3 mt-4">
          <InfoBox icon={MessageSquare} title="Chat publico" text="Donde los proveedores hablan con Elias para reservar hora de descarga." />
          <InfoBox icon={Calendar} title="Panel admin (este panel)" text="Donde el equipo gestiona calendario, citas, proveedores y configuracion." />
        </div>
      </GuideSection>

      {/* Section 2: Process */}
      <GuideSection id="process" title={sections[1].title} icon={sections[1].icon} open={openSections.has("process")} onToggle={toggleSection}>
        <div className="flex flex-wrap items-center justify-center gap-2 py-4">
          <ProcessStep icon={MessageSquare} label="Proveedor contacta por chat" />
          <ArrowRight className="h-4 w-4 text-muted-foreground hidden sm:block" />
          <ProcessStep icon={Zap} label="Elias calcula y reserva" />
          <ArrowRight className="h-4 w-4 text-muted-foreground hidden sm:block" />
          <ProcessStep icon={Calendar} label="Cita creada en calendario" />
          <ArrowRight className="h-4 w-4 text-muted-foreground hidden sm:block" />
          <ProcessStep icon={Truck} label="Descarga real + check-in" />
        </div>
        <ol className="list-decimal pl-5 space-y-1.5 text-sm mt-2">
          <li>El proveedor entra al chat y dice que trae</li>
          <li>Elias le pregunta: mercancia, unidades, dia preferido</li>
          <li>Elias calcula cuanto tiempo necesita la descarga</li>
          <li>Busca hueco en el calendario y lo reserva</li>
          <li>El proveedor recibe confirmacion por email (opcional)</li>
          <li>El dia de la descarga, el operario hace check-in y check-out</li>
          <li>El sistema aprende de los tiempos reales para mejorar</li>
        </ol>
      </GuideSection>

      {/* Section 3: Points & Capacity */}
      <GuideSection id="points" title={sections[2].title} icon={sections[2].icon} open={openSections.has("points")} onToggle={toggleSection}>
        <p>
          El calendario se divide en <strong>franjas horarias</strong> (por defecto de 2h).
          Cada franja tiene una capacidad maxima medida en &ldquo;puntos&rdquo;.
        </p>
        <Card className="mt-4 bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
          <CardContent className="pt-4 space-y-3">
            <h4 className="font-semibold text-sm">Que son los puntos?</h4>
            <p className="text-sm">
              Los puntos miden cuanto &ldquo;ocupa&rdquo; una descarga en la franja.
              Una franja tipica tiene <strong>6 puntos</strong> de capacidad maxima.
            </p>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 border-0">S</Badge>
                <span><strong>Pequena</strong> = 1 punto — hasta 45 min (PAE, bano, entregas rapidas)</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-0">M</Badge>
                <span><strong>Mediana</strong> = 2 puntos — 45 a 90 min (electro, tapiceria mediana)</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border-0">L</Badge>
                <span><strong>Grande</strong> = 3 puntos — mas de 90 min (trailer completo, colchoneria grande)</span>
              </div>
            </div>
            <div className="text-sm mt-2">
              <p className="font-medium">Ejemplo: Franja 08:00-10:00 con 6 puntos</p>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex h-3 w-40 rounded-full overflow-hidden bg-muted">
                  <div className="bg-red-500 w-1/2" />
                  <div className="bg-amber-500 w-1/3" />
                </div>
                <span className="text-xs text-muted-foreground">1 grande (3pts) + 1 mediana (2pts) = 5/6</span>
              </div>
            </div>
          </CardContent>
        </Card>
        <div className="mt-4 text-sm space-y-1">
          <p><strong>Lunes a Viernes:</strong> 6 franjas x 6 pts = 34 pts/dia (18:00 = 4pts)</p>
          <p><strong>Sabado:</strong> 2 franjas x 4 pts = 8 pts/dia</p>
          <p><strong>Domingo:</strong> cerrado</p>
        </div>
      </GuideSection>

      {/* Section 4: Time Calculation */}
      <GuideSection id="times" title={sections[3].title} icon={sections[3].icon} open={openSections.has("times")} onToggle={toggleSection}>
        <p>
          El sistema calcula automaticamente cuanto durara cada descarga basandose en:
        </p>
        <ul className="list-disc pl-5 space-y-1 mt-2 text-sm">
          <li><strong>Tipo de mercancia</strong> (tapiceria es mas lenta que PAE)</li>
          <li><strong>Numero de unidades</strong> (mas bultos = mas tiempo)</li>
          <li><strong>Numero de albaranes</strong> (cada albaran requiere verificacion)</li>
          <li><strong>Numero de lineas</strong> (mas referencias = mas verificacion)</li>
        </ul>
        <p className="text-sm mt-3 text-muted-foreground">
          Los coeficientes estan calibrados con datos reales de 293 entregas historicas del almacen.
        </p>
        <Card className="mt-4">
          <CardContent className="pt-4">
            <h4 className="font-semibold text-sm mb-3">Tiempos maximos por categoria</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
              <TimeChip label="Tapiceria" time="max 3h" />
              <TimeChip label="Electro" time="max 3h 50m" />
              <TimeChip label="Mobiliario" time="max 4h 30m" />
              <TimeChip label="Colchoneria" time="max 2h 40m" />
              <TimeChip label="Asientos" time="max 5h 50m" />
              <TimeChip label="Cocina" time="max 2h 20m" />
              <TimeChip label="PAE" time="max 1h" />
              <TimeChip label="Bano" time="max 1h" />
            </div>
          </CardContent>
        </Card>
      </GuideSection>

      {/* Section 5: AI Precision */}
      <GuideSection id="precision" title={sections[4].title} icon={sections[4].icon} open={openSections.has("precision")} onToggle={toggleSection}>
        <p>
          Cada vez que un operario hace check-in y check-out de una descarga, el sistema compara:
        </p>
        <ul className="list-disc pl-5 space-y-1 mt-2 text-sm">
          <li><strong>Tiempo estimado</strong> por Elias (prediccion IA)</li>
          <li><strong>Tiempo real</strong> (check-out - check-in)</li>
        </ul>
        <p className="mt-3 text-sm">Con estos datos, el sistema:</p>
        <ol className="list-decimal pl-5 space-y-1 mt-1 text-sm">
          <li>Calcula el error medio (MAE) por categoria</li>
          <li>Detecta si tiende a sobreestimar o subestimar</li>
          <li>Permite recalibrar los coeficientes automaticamente</li>
        </ol>
        <p className="mt-3 text-sm">
          La pagina &ldquo;Precision IA&rdquo; muestra graficos de rendimiento.
          Cuantas mas descargas se monitorizan, mas preciso se vuelve.
        </p>
        <Card className="mt-3 bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
          <CardContent className="pt-3 pb-3 text-sm text-amber-800 dark:text-amber-300">
            Con pocas descargas (&lt;10 por categoria), los datos no son estadisticamente significativos. No te preocupes si los numeros parecen altos al principio — mejoran con el uso.
          </CardContent>
        </Card>
      </GuideSection>

      {/* Section 6: Docks */}
      <GuideSection id="docks" title={sections[5].title} icon={sections[5].icon} open={openSections.has("docks")} onToggle={toggleSection}>
        <p>
          El almacen tiene varios muelles (M1, M2, M3...). El sistema asigna automaticamente
          el mejor muelle para cada descarga:
        </p>
        <ul className="list-disc pl-5 space-y-1 mt-2 text-sm">
          <li>Reparte la carga entre muelles</li>
          <li>Respeta el buffer entre descargas (15 min por defecto)</li>
          <li>Si no hay muelle libre, ajusta la hora de inicio</li>
        </ul>
        <p className="text-sm mt-3 text-muted-foreground">
          Puedes configurar muelles (activar/desactivar, horarios) desde la pagina &ldquo;Muelles&rdquo;.
        </p>
      </GuideSection>

      {/* Section 7: Providers */}
      <GuideSection id="providers" title={sections[6].title} icon={sections[6].icon} open={openSections.has("providers")} onToggle={toggleSection}>
        <p>
          El sistema reconoce a 78 proveedores habituales extraidos de 12.000+ emails historicos.
          Cuando un proveedor conocido habla con Elias, el sistema:
        </p>
        <ul className="list-disc pl-5 space-y-1 mt-2 text-sm">
          <li>Lo reconoce automaticamente por nombre o alias</li>
          <li>Sabe que tipo de mercancia suele traer</li>
          <li>Conoce su frecuencia de entrega habitual</li>
          <li>Puede sugerir parametros basados en entregas anteriores</li>
        </ul>
        <p className="text-sm mt-3 text-muted-foreground">
          Si un proveedor es nuevo, Elias le pide toda la informacion necesaria sin asumir nada.
        </p>
      </GuideSection>

      {/* Section 8: Emails */}
      <GuideSection id="emails" title={sections[7].title} icon={sections[7].icon} open={openSections.has("emails")} onToggle={toggleSection}>
        <p>El sistema envia dos tipos de emails:</p>
        <div className="grid sm:grid-cols-2 gap-3 mt-3">
          <Card>
            <CardContent className="pt-4 text-sm space-y-2">
              <h4 className="font-semibold">A proveedores</h4>
              <ul className="list-disc pl-4 space-y-1">
                <li>Confirmacion de cita (al reservar)</li>
                <li>Recordatorio (48h antes de la cita)</li>
              </ul>
              <p className="text-xs text-muted-foreground">El proveedor puede confirmar o cancelar desde el email.</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-sm space-y-2">
              <h4 className="font-semibold">Al equipo</h4>
              <ul className="list-disc pl-4 space-y-1">
                <li>Resumen diario (cada manana a las 07:00)</li>
                <li>Alerta de nueva cita</li>
                <li>Alerta de cita modificada</li>
                <li>Alerta de cita cancelada</li>
              </ul>
            </CardContent>
          </Card>
        </div>
        <p className="text-sm mt-3 text-muted-foreground">Todo configurable desde &ldquo;Notificaciones&rdquo;.</p>
      </GuideSection>

      {/* Section 9: Audit */}
      <GuideSection id="audit" title={sections[8].title} icon={sections[8].icon} open={openSections.has("audit")} onToggle={toggleSection}>
        <p>
          Cada accion importante queda registrada: quien hizo que, cuando, y que cambio.
          Util para resolver disputas o entender que paso con una cita.
        </p>
      </GuideSection>

      {/* Section 10: Pages Map */}
      <GuideSection id="pages" title={sections[9].title} icon={sections[9].icon} open={openSections.has("pages")} onToggle={toggleSection}>
        <div className="space-y-2">
          <PageEntry icon={Calendar} label="Calendario" desc="Vista diaria/semanal/mensual de citas" />
          <PageEntry icon={ClipboardCheck} label="Citas" desc="Lista de todas las citas con filtros" />
          <PageEntry icon={Warehouse} label="Almacen" desc="Check-in y check-out de descargas del dia" />
          <PageEntry icon={MessageSquare} label="Elias" desc="Asistente IA para consultas internas" />
          <PageEntry icon={Gauge} label="Capacidad" desc="Configurar franjas, puntos y horarios" />
          <PageEntry icon={Settings2} label="Reglas" desc="Reglas de programacion inteligente" />
          <PageEntry icon={Warehouse} label="Muelles" desc="Gestionar muelles de descarga" />
          <PageEntry icon={Package} label="Proveedores" desc="Base de datos de proveedores y contactos" />
          <PageEntry icon={Bell} label="Notificaciones" desc="Emails a proveedores y equipo" />
          <PageEntry icon={Users} label="Usuarios" desc="Gestion de accesos y roles" />
          <PageEntry icon={Shield} label="Auditoria" desc="Registro de actividad" />
          <PageEntry icon={BarChart3} label="Precision IA" desc="Rendimiento del calculo de tiempos" />
          <PageEntry icon={BookOpen} label="Guia" desc="Esta pagina" />
        </div>
      </GuideSection>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────

function GuideSection({
  id,
  title,
  icon: Icon,
  open,
  onToggle,
  children,
}: {
  id: string;
  title: string;
  icon: React.ElementType;
  open: boolean;
  onToggle: (id: string) => void;
  children: React.ReactNode;
}) {
  return (
    <Collapsible open={open} onOpenChange={() => onToggle(id)}>
      <Card>
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-accent/30 transition-colors rounded-t-lg">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                <Icon className="h-5 w-5" />
              </div>
              <h2 className="font-semibold">{title}</h2>
            </div>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 shrink-0 ${open ? "rotate-180" : ""}`} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 pb-5 text-sm leading-relaxed">
            {children}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

function InfoBox({ icon: Icon, title, text }: { icon: React.ElementType; title: string; text: string }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border bg-card">
      <Icon className="h-5 w-5 text-primary shrink-0 mt-0.5" />
      <div>
        <p className="font-medium text-sm">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{text}</p>
      </div>
    </div>
  );
}

function ProcessStep({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5 p-3 rounded-lg border bg-card min-w-[80px] text-center">
      <div className="p-2 rounded-full bg-primary/10">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <span className="text-xs font-medium leading-tight">{label}</span>
    </div>
  );
}

function TimeChip({ label, time }: { label: string; time: string }) {
  return (
    <div className="flex items-center justify-between gap-1 px-2 py-1.5 rounded-md border bg-card">
      <span className="text-xs font-medium">{label}</span>
      <span className="text-xs text-muted-foreground">{time}</span>
    </div>
  );
}

function PageEntry({ icon: Icon, label, desc }: { icon: React.ElementType; label: string; desc: string }) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
      <span className="font-medium text-sm min-w-[110px]">{label}</span>
      <span className="text-sm text-muted-foreground">{desc}</span>
    </div>
  );
}
