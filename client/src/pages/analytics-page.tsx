import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PredictionScatter } from "@/components/analytics/prediction-scatter";
import { CategoryTable } from "@/components/analytics/category-table";
import { ProviderTable } from "@/components/analytics/provider-table";
import { CalibrationPanel } from "@/components/analytics/calibration-panel";
import { analyticsApi } from "@/lib/api";
import { Target, TrendingUp, AlertTriangle, BarChart3 } from "lucide-react";
import type { UserRole } from "@shared/types";

export default function AnalyticsPage({ userRole }: { userRole: UserRole }) {
  const { data: accuracy = [], isLoading: loadingAccuracy } = useQuery({
    queryKey: ["prediction-accuracy"],
    queryFn: () => analyticsApi.getPredictionAccuracy(),
  });

  const { data: providers = [], isLoading: loadingProviders } = useQuery({
    queryKey: ["provider-profiles"],
    queryFn: () => analyticsApi.getProviderProfiles(),
  });

  // KPIs
  const totalSamples = accuracy.reduce((s, a) => s + a.sampleSize, 0);
  const weightedMae = totalSamples > 0
    ? accuracy.reduce((s, a) => s + a.mae * a.sampleSize, 0) / totalSamples
    : 0;
  const weightedBias = totalSamples > 0
    ? accuracy.reduce((s, a) => s + a.bias * a.sampleSize, 0) / totalSamples
    : 0;
  const bestCat = accuracy.length > 0
    ? accuracy.reduce((best, a) => (a.mae < best.mae ? a : best))
    : null;
  const worstCat = accuracy.length > 0
    ? accuracy.reduce((worst, a) => (a.mae > worst.mae ? a : worst))
    : null;

  const isLoading = loadingAccuracy || loadingProviders;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Precision IA</h1>
        <p className="text-muted-foreground">Analisis de la calidad de las estimaciones de tiempo</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Descargas monitorizadas</p>
            </div>
            <p className="text-2xl font-bold">{totalSamples}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-1">
              <Target className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">MAE global</p>
            </div>
            <p className="text-2xl font-bold">{weightedMae.toFixed(1)} <span className="text-sm font-normal text-muted-foreground">min</span></p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Sesgo global</p>
            </div>
            <p className={`text-2xl font-bold ${weightedBias > 5 ? "text-red-500" : weightedBias < -5 ? "text-blue-500" : ""}`}>
              {weightedBias > 0 ? "+" : ""}{weightedBias.toFixed(1)} <span className="text-sm font-normal text-muted-foreground">min</span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Peor / Mejor</p>
            </div>
            {worstCat && bestCat ? (
              <p className="text-sm">
                <span className="text-red-500 font-semibold">{worstCat.category}</span>
                {" / "}
                <span className="text-green-500 font-semibold">{bestCat.category}</span>
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Sin datos</p>
            )}
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 bg-muted/50 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : totalSamples === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-1">Sin datos de precision todavia</h3>
            <p className="text-muted-foreground">
              Registra tiempos reales de descarga en la pagina <span className="font-medium">Almacen</span> para ver la precision de las estimaciones.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="categories" className="space-y-4">
          <TabsList>
            <TabsTrigger value="categories">Por categoria</TabsTrigger>
            <TabsTrigger value="providers">Por proveedor</TabsTrigger>
            {userRole === "ADMIN" && <TabsTrigger value="calibration">Calibracion</TabsTrigger>}
          </TabsList>

          <TabsContent value="categories" className="space-y-4">
            {/* Scatter plot */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Estimado vs Real (media por categoria)</CardTitle>
              </CardHeader>
              <CardContent>
                <PredictionScatter data={accuracy} />
              </CardContent>
            </Card>

            {/* Category table */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Precision por categoria</CardTitle>
              </CardHeader>
              <CardContent>
                <CategoryTable data={accuracy} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="providers">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Perfiles de proveedor</CardTitle>
              </CardHeader>
              <CardContent>
                <ProviderTable data={providers} />
              </CardContent>
            </Card>
          </TabsContent>

          {userRole === "ADMIN" && (
            <TabsContent value="calibration">
              <CalibrationPanel />
            </TabsContent>
          )}
        </Tabs>
      )}
    </div>
  );
}
