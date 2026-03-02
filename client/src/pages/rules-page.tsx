import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { PageHero } from '@/components/page-hero';
import { useToast } from "@/hooks/use-toast";
import { rulesApi, type SchedulingRules } from "@/lib/api";
import { Loader2, Save, RotateCcw, Ban, Users, Timer, Truck, BarChart3, Warehouse, Clock, Hourglass, Settings2 } from "lucide-react";

interface RulesPageProps {
  userRole: string;
}

const DEFAULT_RULES: SchedulingRules = {
  avoidConcurrency: { enabled: true, mode: "suggest" },
  maxSimultaneous: { enabled: true, count: 2 },
  dockBuffer: { enabled: true, minutes: 15 },
  sizePriority: { enabled: true, largeSlots: ["08:00", "10:00"], smallSlots: ["14:00", "16:00", "18:00"] },
  dailyConcentration: { enabled: true, threshold: 4 },
  dockDistribution: { enabled: true, largePreferred: "M1", smallPreferred: "M3" },
  categoryPreferredTime: {
    enabled: true,
    map: {
      "Tapiceria": "08:00", "Mobiliario": "08:00", "Electro": "10:00",
      "Colchoneria": "10:00", "PAE": "14:00", "Bano": "14:00",
      "Cocina": "12:00", "Asientos": "08:00", "Climatizacion": "12:00",
    },
  },
  minLeadTime: { enabled: false, hours: 24 },
};

export default function RulesPage({ userRole }: RulesPageProps) {
  const [rules, setRules] = useState<SchedulingRules | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const isAdmin = userRole === "ADMIN";

  useEffect(() => {
    rulesApi.getRules()
      .then(setRules)
      .catch(() => toast({ title: "Error", description: "No se pudieron cargar las reglas", variant: "destructive" }))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    if (!rules) return;
    setSaving(true);
    try {
      const updated = await rulesApi.updateRules(rules);
      setRules(updated);
      toast({ title: "Guardado", description: "Las reglas se han actualizado correctamente" });
    } catch {
      toast({ title: "Error", description: "No se pudieron guardar las reglas", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setSaving(true);
    try {
      const updated = await rulesApi.updateRules(DEFAULT_RULES);
      setRules(updated);
      toast({ title: "Restaurado", description: "Se han restaurado los valores por defecto" });
    } catch {
      toast({ title: "Error", description: "No se pudieron restaurar los valores", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const update = <K extends keyof SchedulingRules>(key: K, partial: Partial<SchedulingRules[K]>) => {
    if (!rules) return;
    setRules({ ...rules, [key]: { ...rules[key], ...partial } });
  };

  const updateCategoryTime = (category: string, time: string) => {
    if (!rules) return;
    setRules({
      ...rules,
      categoryPreferredTime: {
        ...rules.categoryPreferredTime,
        map: { ...rules.categoryPreferredTime.map, [category]: time },
      },
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!rules) return null;

  return (
    <div className="space-y-6 pb-8">
      <PageHero
        icon={Settings2}
        title="Reglas de Programación"
        subtitle="Configura como Elias y el sistema gestionan las citas de descarga"
      />

      <div className="grid gap-4">
        {/* Rule 1: Avoid Concurrency */}
        <RuleCard
          icon={<Ban className="h-5 w-5" />}
          title="Evitar concurrencia"
          description="Distribuir citas en el tiempo para evitar que se apilen multiples descargas a la misma hora"
          enabled={rules.avoidConcurrency.enabled}
          onToggle={(v) => update("avoidConcurrency", { enabled: v })}
          disabled={!isAdmin}
        >
          <div className="space-y-3">
            <Label className="text-sm font-medium">Modo</Label>
            <RadioGroup
              value={rules.avoidConcurrency.mode}
              onValueChange={(v) => update("avoidConcurrency", { mode: v as "suggest" | "enforce" })}
              disabled={!isAdmin}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="suggest" id="concurrency-suggest" />
                <Label htmlFor="concurrency-suggest" className="font-normal">Sugerir (recomienda horario optimo)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="enforce" id="concurrency-enforce" />
                <Label htmlFor="concurrency-enforce" className="font-normal">Forzar (bloquea si hay alternativa disponible)</Label>
              </div>
            </RadioGroup>
          </div>
        </RuleCard>

        {/* Rule 2: Max Simultaneous */}
        <RuleCard
          icon={<Users className="h-5 w-5" />}
          title="Limite de descargas simultaneas"
          description="Maximo de camiones descargando al mismo tiempo"
          enabled={rules.maxSimultaneous.enabled}
          onToggle={(v) => update("maxSimultaneous", { enabled: v })}
          disabled={!isAdmin}
        >
          <div className="flex items-center gap-3">
            <Label className="text-sm">Maximo simultaneo:</Label>
            <Input
              type="number"
              min={1}
              max={10}
              value={rules.maxSimultaneous.count}
              onChange={(e) => update("maxSimultaneous", { count: parseInt(e.target.value) || 2 })}
              className="w-20"
              disabled={!isAdmin}
            />
          </div>
        </RuleCard>

        {/* Rule 3: Dock Buffer */}
        <RuleCard
          icon={<Timer className="h-5 w-5" />}
          title="Buffer entre descargas"
          description="Tiempo de descanso obligatorio entre descargas en el mismo muelle"
          enabled={rules.dockBuffer.enabled}
          onToggle={(v) => update("dockBuffer", { enabled: v })}
          disabled={!isAdmin}
        >
          <div className="flex items-center gap-3">
            <Label className="text-sm">Buffer:</Label>
            <Input
              type="number"
              min={0}
              max={60}
              value={rules.dockBuffer.minutes}
              onChange={(e) => update("dockBuffer", { minutes: parseInt(e.target.value) || 15 })}
              className="w-20"
              disabled={!isAdmin}
            />
            <span className="text-sm text-muted-foreground">minutos</span>
          </div>
        </RuleCard>

        {/* Rule 4: Size Priority */}
        <RuleCard
          icon={<Truck className="h-5 w-5" />}
          title="Prioridad por tamano"
          description="Sugerir primera hora para traileres/entregas grandes y franjas finales para entregas pequenas"
          enabled={rules.sizePriority.enabled}
          onToggle={(v) => update("sizePriority", { enabled: v })}
          disabled={!isAdmin}
        >
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Label className="text-sm min-w-[160px]">Entregas grandes (L):</Label>
              <Input
                value={rules.sizePriority.largeSlots.join(", ")}
                onChange={(e) => update("sizePriority", { largeSlots: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                placeholder="08:00, 10:00"
                className="flex-1"
                disabled={!isAdmin}
              />
            </div>
            <div className="flex items-center gap-3">
              <Label className="text-sm min-w-[160px]">Entregas pequenas (S):</Label>
              <Input
                value={rules.sizePriority.smallSlots.join(", ")}
                onChange={(e) => update("sizePriority", { smallSlots: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                placeholder="14:00, 16:00, 18:00"
                className="flex-1"
                disabled={!isAdmin}
              />
            </div>
          </div>
        </RuleCard>

        {/* Rule 5: Daily Concentration */}
        <RuleCard
          icon={<BarChart3 className="h-5 w-5" />}
          title="Aviso de concentracion diaria"
          description="Avisar cuando un dia acumula demasiadas citas y sugerir dias alternativos mas libres"
          enabled={rules.dailyConcentration.enabled}
          onToggle={(v) => update("dailyConcentration", { enabled: v })}
          disabled={!isAdmin}
        >
          <div className="flex items-center gap-3">
            <Label className="text-sm">Umbral de aviso:</Label>
            <Input
              type="number"
              min={1}
              max={20}
              value={rules.dailyConcentration.threshold}
              onChange={(e) => update("dailyConcentration", { threshold: parseInt(e.target.value) || 4 })}
              className="w-20"
              disabled={!isAdmin}
            />
            <span className="text-sm text-muted-foreground">citas por dia</span>
          </div>
        </RuleCard>

        {/* Rule 6: Dock Distribution */}
        <RuleCard
          icon={<Warehouse className="h-5 w-5" />}
          title="Distribucion de muelles"
          description="Asignar muelles segun el tipo de entrega"
          enabled={rules.dockDistribution.enabled}
          onToggle={(v) => update("dockDistribution", { enabled: v })}
          disabled={!isAdmin}
        >
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Label className="text-sm min-w-[200px]">Entregas grandes (trailer):</Label>
              <Input
                value={rules.dockDistribution.largePreferred}
                onChange={(e) => update("dockDistribution", { largePreferred: e.target.value })}
                placeholder="M1"
                className="w-24"
                disabled={!isAdmin}
              />
            </div>
            <div className="flex items-center gap-3">
              <Label className="text-sm min-w-[200px]">Entregas pequenas (courier):</Label>
              <Input
                value={rules.dockDistribution.smallPreferred}
                onChange={(e) => update("dockDistribution", { smallPreferred: e.target.value })}
                placeholder="M3"
                className="w-24"
                disabled={!isAdmin}
              />
            </div>
          </div>
        </RuleCard>

        {/* Rule 7: Category Preferred Time */}
        <RuleCard
          icon={<Clock className="h-5 w-5" />}
          title="Horario preferente por categoria"
          description="Sugerir horarios segun el tipo de mercancia basado en la experiencia del almacen"
          enabled={rules.categoryPreferredTime.enabled}
          onToggle={(v) => update("categoryPreferredTime", { enabled: v })}
          disabled={!isAdmin}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Object.entries(rules.categoryPreferredTime.map).map(([cat, time]) => (
              <div key={cat} className="flex items-center gap-2">
                <Label className="text-sm min-w-[110px]">{cat}</Label>
                <Input
                  value={time}
                  onChange={(e) => updateCategoryTime(cat, e.target.value)}
                  placeholder="08:00"
                  className="w-24"
                  disabled={!isAdmin}
                />
              </div>
            ))}
          </div>
        </RuleCard>

        {/* Rule 8: Min Lead Time */}
        <RuleCard
          icon={<Hourglass className="h-5 w-5" />}
          title="Antelacion minima"
          description="Requerir un minimo de horas de antelacion para nuevas reservas"
          enabled={rules.minLeadTime.enabled}
          onToggle={(v) => update("minLeadTime", { enabled: v })}
          disabled={!isAdmin}
        >
          <div className="flex items-center gap-3">
            <Label className="text-sm">Antelacion minima:</Label>
            <Input
              type="number"
              min={1}
              max={168}
              value={rules.minLeadTime.hours}
              onChange={(e) => update("minLeadTime", { hours: parseInt(e.target.value) || 24 })}
              className="w-20"
              disabled={!isAdmin}
            />
            <span className="text-sm text-muted-foreground">horas</span>
          </div>
        </RuleCard>
      </div>

      {/* Info note */}
      <Card className="bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
        <CardContent className="pt-4 pb-4">
          <p className="text-sm text-blue-800 dark:text-blue-300">
            Las reglas en modo "Sugerir" no bloquean reservas. Elias comunicara las recomendaciones al proveedor de forma natural. El proveedor siempre tiene la ultima palabra.
          </p>
        </CardContent>
      </Card>

      {/* Action buttons */}
      {isAdmin && (
        <div className="flex items-center gap-3 sticky bottom-0 bg-background/95 backdrop-blur-sm py-4 border-t -mx-6 px-6 lg:-mx-8 lg:px-8">
          <Button onClick={handleSave} disabled={saving} className="gradient-btn text-white border-0">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Guardar cambios
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" disabled={saving}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Restaurar valores por defecto
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Restaurar valores por defecto</AlertDialogTitle>
                <AlertDialogDescription>
                  Esto restablecera todas las reglas a sus valores iniciales. Los cambios realizados se perderan.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleReset}>Restaurar</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </div>
  );
}

// ─── Rule Card Component ─────────────────────────────────────────────

interface RuleCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  disabled?: boolean;
  children: React.ReactNode;
}

function RuleCard({ icon, title, description, enabled, onToggle, disabled, children }: RuleCardProps) {
  return (
    <Card className={`transition-all duration-200 ${enabled ? "border-l-4 border-l-blue-500" : "border-l-4 border-l-muted opacity-75"}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${enabled ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" : "bg-muted text-muted-foreground"}`}>
              {icon}
            </div>
            <div>
              <CardTitle className="text-base">{title}</CardTitle>
              <CardDescription className="text-sm mt-0.5">{description}</CardDescription>
            </div>
          </div>
          <Switch
            checked={enabled}
            onCheckedChange={onToggle}
            disabled={disabled}
            data-testid={`switch-${title.toLowerCase().replace(/\s+/g, "-")}`}
          />
        </div>
      </CardHeader>
      {enabled && (
        <CardContent className="pt-0 animate-fadeIn">
          {children}
        </CardContent>
      )}
    </Card>
  );
}
