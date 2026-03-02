import { type ReactNode, type ComponentType } from 'react';
import { type LucideProps } from 'lucide-react';

interface PageHeroProps {
  icon: ComponentType<LucideProps>;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children?: ReactNode;
}

export function PageHero({ icon: Icon, title, subtitle, actions, children }: PageHeroProps) {
  return (
    <div className="-mx-6 lg:-mx-8 -mt-6 lg:-mt-8 mb-6">
      <div
        className="relative overflow-hidden px-6 lg:px-8 py-6"
        style={{
          background: 'linear-gradient(135deg, #0D47A1 0%, #1565C0 40%, #1976D2 70%, #1A237E 100%)',
        }}
      >
        {/* Dot pattern overlay */}
        <div className="absolute inset-0 dot-pattern opacity-40" />

        <div className="relative z-10 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="h-11 w-11 rounded-xl flex items-center justify-center bg-white/15 border border-white/20 backdrop-blur-sm">
              <Icon className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white font-heading tracking-tight">
                {title}
              </h1>
              {subtitle && (
                <p className="text-white/70 text-sm mt-0.5">{subtitle}</p>
              )}
            </div>
          </div>
          {actions && (
            <div className="flex items-center gap-2 flex-wrap">
              {actions}
            </div>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}
