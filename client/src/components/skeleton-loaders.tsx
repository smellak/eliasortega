import { Card } from "@/components/ui/card";

/** Calendar week grid skeleton */
export function CalendarSkeleton() {
  return (
    <Card className="p-4">
      {/* View selector */}
      <div className="flex items-center justify-between mb-4">
        <div className="h-8 w-32 bg-muted rounded animate-pulse" />
        <div className="flex gap-2">
          <div className="h-8 w-20 bg-muted rounded animate-pulse" />
          <div className="h-8 w-20 bg-muted rounded animate-pulse" />
        </div>
      </div>
      {/* Day headers */}
      <div className="grid grid-cols-6 gap-2 mb-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-6 bg-muted rounded animate-pulse" />
        ))}
      </div>
      {/* Time rows */}
      {Array.from({ length: 3 }).map((_, row) => (
        <div key={row} className="grid grid-cols-6 gap-2 mb-2">
          {Array.from({ length: 6 }).map((_, col) => (
            <div
              key={col}
              className="h-16 bg-muted rounded animate-pulse"
              style={{ animationDelay: `${(row * 6 + col) * 50}ms` }}
            />
          ))}
        </div>
      ))}
    </Card>
  );
}

/** Appointment card list skeleton */
export function AppointmentsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="p-4 border-l-4 border-l-muted rounded-xl">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-6 w-40 bg-muted rounded animate-pulse" style={{ animationDelay: `${i * 100}ms` }} />
                <div className="h-5 w-16 bg-muted rounded-full animate-pulse" style={{ animationDelay: `${i * 100 + 50}ms` }} />
                <div className="h-5 w-20 bg-muted rounded-full animate-pulse" style={{ animationDelay: `${i * 100 + 100}ms` }} />
              </div>
              <div className="flex gap-4">
                <div className="h-4 w-36 bg-muted rounded animate-pulse" style={{ animationDelay: `${i * 100 + 150}ms` }} />
                <div className="h-4 w-24 bg-muted rounded animate-pulse" style={{ animationDelay: `${i * 100 + 200}ms` }} />
                <div className="h-4 w-24 bg-muted rounded animate-pulse" style={{ animationDelay: `${i * 100 + 250}ms` }} />
              </div>
            </div>
            <div className="flex gap-2">
              <div className="h-8 w-8 bg-muted rounded animate-pulse" />
              <div className="h-8 w-8 bg-muted rounded animate-pulse" />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

/** Table with rows skeleton (for docks, audit, etc.) */
export function TableSkeleton({ rows = 3, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <Card className="premium-table">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              {Array.from({ length: cols }).map((_, i) => (
                <th key={i} className="p-3 text-left">
                  <div className="h-4 w-20 bg-muted rounded animate-pulse" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, row) => (
              <tr key={row} className="border-t border-border/50">
                {Array.from({ length: cols }).map((_, col) => (
                  <td key={col} className="p-3">
                    <div
                      className="h-4 bg-muted rounded animate-pulse"
                      style={{
                        width: col === 0 ? "60%" : "40%",
                        animationDelay: `${(row * cols + col) * 60}ms`,
                      }}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/** KPI cards skeleton */
export function KPISkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="p-4">
          <div className="space-y-2">
            <div className="h-3 w-16 bg-muted rounded animate-pulse" style={{ animationDelay: `${i * 80}ms` }} />
            <div className="h-7 w-12 bg-muted rounded animate-pulse" style={{ animationDelay: `${i * 80 + 40}ms` }} />
          </div>
        </Card>
      ))}
    </div>
  );
}
