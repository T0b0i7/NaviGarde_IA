export function Skeleton({ style }: { style?: React.CSSProperties }) {
  return <div className="skel" style={style} />;
}

export function KpiSkeleton() {
  return (
    <div className="mock-kpi" style={{ opacity: 0.85 }}>
      <div className="skel" style={{ width: 48, height: 48, borderRadius: 14 }} />
      <div style={{ flex: 1, display: "grid", gap: 8 }}>
        <div className="skel" style={{ height: 11, width: "60%" }} />
        <div className="skel" style={{ height: 18, width: "35%" }} />
        <div className="skel" style={{ height: 10, width: "45%" }} />
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div style={{ display: "grid", gap: 10, padding: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 10 }}>
        {Array.from({ length: cols }).map((_, i) => <div key={i} className="skel" style={{ height: 14 }} />)}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 10 }}>
          {Array.from({ length: cols }).map((_, c) => <div key={c} className="skel" style={{ height: 22 }} />)}
        </div>
      ))}
    </div>
  );
}

export function ChartSkeleton({ height = 220 }: { height?: number }) {
  return <div className="skel" style={{ height, borderRadius: 14 }} />;
}

export function ErrorState({ message, onRetry, lang }: { message: string; onRetry?: () => void; lang?: string }) {
  return (
    <div style={{ padding: "1.6rem", textAlign: "center", display: "grid", gap: 10, justifyItems: "center", color: "var(--ng-crit-strong)" }}>
      <div style={{ fontSize: 13, fontWeight: 700, background: "var(--ng-crit-bg)", border: "1px solid var(--ng-crit-border)", borderRadius: 10, padding: "10px 14px" }}>{message}</div>
      {onRetry && (
        <button className="btn-outline-blue" style={{ width: "auto", padding: "0 16px", height: 36 }} onClick={onRetry}>
          Réessayer
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div style={{ padding: "2.2rem 1rem", textAlign: "center", color: "var(--ng-faint)", display: "grid", gap: 8, justifyItems: "center" }}>
      <div style={{ fontSize: 14, fontWeight: 800, color: "var(--ng-ink)" }}>{title}</div>
      {hint && <div style={{ fontSize: 13, maxWidth: 420 }}>{hint}</div>}
      {action && <div style={{ marginTop: 8 }}>{action}</div>}
    </div>
  );
}
