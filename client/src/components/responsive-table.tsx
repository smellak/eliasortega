import { useRef, useState, useEffect } from "react";

interface ResponsiveTableProps {
  children: React.ReactNode;
  className?: string;
}

export function ResponsiveTable({ children, className = "" }: ResponsiveTableProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [canScroll, setCanScroll] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const check = () => {
      setCanScroll(el.scrollWidth > el.clientWidth + 2);
    };
    check();

    const observer = new ResizeObserver(check);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div className={`relative ${className}`}>
      <div
        ref={containerRef}
        className="overflow-x-auto"
      >
        {children}
      </div>
      {canScroll && (
        <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-white/80 to-transparent dark:from-gray-900/80 sm:hidden" />
      )}
    </div>
  );
}
