import { Manrope, JetBrains_Mono } from "next/font/google";
import {
  Activity,
  Bike,
  Clock,
  Flame,
  Footprints,
  Heart,
  Mountain,
  Ruler,
  BarChart3,
  Check,
  X,
  Info,
  AlertTriangle,
  ArrowRight,
  Search,
  ChevronRight,
  Gauge,
  Cloud,
  Wind,
  Droplets,
  Zap,
} from "lucide-react";

const display = Manrope({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["300", "400", "500", "600", "700", "800"],
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono-display",
});

export default function DesignPreviewPage() {
  return (
    <div className={`${display.variable} ${mono.variable} flux-demo min-h-screen`}>
      <DemoNav />

      <main className="demo-container py-10 md:py-16 space-y-16 md:space-y-24">
        {/* Hero */}
        <header>
          <p className="demo-eyebrow">Flux · Styleguide</p>
          <h1 className="demo-display">
            Warm, klar,<br />
            <span className="demo-accent">modern.</span>
          </h1>
          <p className="demo-lead">
            Ein Token-basiertes Design-System mit Koralle-Akzent.
            Helle Oberflächen, scharfe Kanten, tabellarische Zahlen.
          </p>
        </header>

        <ActivitySample />

        <Section title="Farben" id="colors">
          <Palette />
        </Section>

        <Section title="Typografie" id="typography">
          <TypographyScale />
        </Section>

        <Section title="Buttons" id="buttons">
          <ButtonsShowcase />
        </Section>

        <Section title="Formular-Elemente" id="forms">
          <FormsShowcase />
        </Section>

        <Section title="Badges & Pills" id="badges">
          <BadgesShowcase />
        </Section>

        <Section title="Cards" id="cards">
          <CardsShowcase />
        </Section>

        <Section title="Listen" id="lists">
          <ListsShowcase />
        </Section>

        <Section title="Alerts" id="alerts">
          <AlertsShowcase />
        </Section>

        <Section title="Tabs" id="tabs">
          <TabsShowcase />
        </Section>

        <Section title="Tabelle" id="table">
          <TableShowcase />
        </Section>

        <Section title="Avatar" id="avatar">
          <AvatarsShowcase />
        </Section>

        <Section title="Tokens" id="tokens">
          <TokensShowcase />
        </Section>
      </main>

      <footer className="demo-container py-10">
        <p className="demo-muted text-xs">
          Styleguide · Token-Set „Coral &amp; Cream" · nicht verbunden
        </p>
      </footer>

      <style>{css}</style>
    </div>
  );
}

/* ─── Nav ───────────────────────────────────────────── */

function DemoNav() {
  return (
    <nav className="demo-nav">
      <div className="demo-container flex items-center justify-between h-14">
        <div className="flex items-center gap-8">
          <a href="#" className="demo-brand">
            <span className="demo-brand-mark" />
            Flux
          </a>
          <div className="hidden md:flex items-center gap-6 text-sm">
            <a href="#" className="demo-nav-link">Aktivitäten</a>
            <a href="#" className="demo-nav-link">
              <BarChart3 className="h-3.5 w-3.5" /> Statistiken
            </a>
            <a href="#" className="demo-nav-link">
              <Heart className="h-3.5 w-3.5" /> Gesundheit
            </a>
          </div>
        </div>
        <div className="demo-avatar">MM</div>
      </div>
    </nav>
  );
}

/* ─── Activity sample ───────────────────────────────── */

function ActivitySample() {
  return (
    <section className="space-y-6">
      <div className="demo-summary">
        <div className="demo-summary-split">
          {/* LEFT: identity + photos + notes */}
          <div className="demo-summary-left">
            <div className="demo-summary-meta">
              <span className="demo-summary-type">
                <Footprints className="h-3 w-3" /> Laufen
              </span>
              <span>Sa · 12.04.2026 · 06:42 · Frick, AG</span>
            </div>
            <h2 className="demo-summary-title">Morgenlauf Wald</h2>
            <InlinePhotos />
            <p className="demo-summary-note">
              Kühler Start, am Ende Sonne über den Baumkronen.
            </p>
          </div>

          {/* Right divider */}
          <div className="demo-summary-divider" aria-hidden />

          {/* RIGHT: cockpit data */}
          <div className="demo-summary-right">
            <div className="demo-summary-hero">
              <HeroStat value="57:12" unit="" label="Bewegungszeit" />
              <HeroStat value="12,4" unit="km" label="Distanz" />
              <HeroStat value="184" unit="m" label="Aufstieg" />
            </div>

            <div className="demo-summary-grid">
              <MiniMetric icon={<Mountain />} label="Abstieg" value="191" unit="m" />
              <MiniMetric icon={<Footprints />} label="Pace" value="4:42" unit="/km" />
              <MiniMetric icon={<Heart />} label="Max Puls" value="176" unit="bpm" />
              <MiniMetric icon={<Heart />} label="Ø Puls" value="152" unit="bpm" />
              <MiniMetric icon={<Gauge />} label="Ø Speed" value="12,7" unit="km/h" />
              <MiniMetric icon={<Footprints />} label="Kadenz" value="178" unit="spm" />
              <MiniMetric icon={<Flame />} label="Kalorien" value="712" unit="kcal" />
              <MiniMetric icon={<Clock />} label="Gesamtzeit" value="58:23" unit="" />
              <MiniMetric icon={<Activity />} label="Cardio Load" value="78" unit="" />
              <MiniMetric icon={<Zap />} label="TRIMP" value="247" unit="" highlight />
              <MiniMetric icon={<Cloud />} label="Temperatur" value="18" unit="°C" />
              <MiniMetric icon={<Wind />} label="Wind" value="14" unit="km/h NW" />
              <MiniMetric icon={<Droplets />} label="Feuchte" value="73" unit="%" />
              <MacroMetric carb={58} fat={32} protein={10} />
            </div>

            <div className="demo-summary-foot">
              <span>Polar Vantage V3</span>
              <span>·</span>
              <span>Leicht bewölkt</span>
              <span>·</span>
              <span>Import 13.04.2026</span>
            </div>
          </div>
        </div>
      </div>

      <TrimpDemoCard />
    </section>
  );
}

function InlinePhotos() {
  const photos = [
    "linear-gradient(135deg, #7FA879 0%, #3E5A3D 100%)",
    "linear-gradient(135deg, #E8C894 0%, #8B7548 100%)",
    "linear-gradient(135deg, #A8C4D8 0%, #4A6F8C 100%)",
    "linear-gradient(135deg, #D4B896 0%, #6B5843 100%)",
    "linear-gradient(135deg, #8FA888 0%, #3F4F3D 100%)",
    "linear-gradient(135deg, #C4A08B 0%, #7B5A48 100%)",
  ];
  const visible = 5;
  return (
    <div className="demo-inline-photos">
      {photos.slice(0, visible).map((bg, i) => (
        <button key={i} className="demo-inline-photo" style={{ background: bg }} type="button" />
      ))}
      {photos.length > visible && (
        <button className="demo-inline-photo demo-inline-photo-more" type="button">
          +{photos.length - visible}
        </button>
      )}
    </div>
  );
}

function MacroMetric({
  carb,
  fat,
  protein,
}: {
  carb: number;
  fat: number;
  protein: number;
}) {
  return (
    <div className="demo-mini demo-macro">
      <span className="demo-mini-icon"><Flame /></span>
      <div className="demo-mini-body">
        <div className="demo-mini-label">KH · Fett · Eiweiss</div>
        <div className="demo-macro-bar">
          <div style={{ width: `${carb}%`, background: "#FFB199" }} />
          <div style={{ width: `${fat}%`, background: "#F0E4D4" }} />
          <div style={{ width: `${protein}%`, background: "#C73A1E" }} />
        </div>
        <div className="demo-macro-pcts demo-mono">
          {carb}/{fat}/{protein}
        </div>
      </div>
    </div>
  );
}

function MiniMetric({
  icon,
  label,
  value,
  unit,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  unit: string;
  highlight?: boolean;
}) {
  return (
    <div className={`demo-mini${highlight ? " demo-mini-highlight" : ""}`}>
      <span className="demo-mini-icon">{icon}</span>
      <div className="demo-mini-body">
        <div className="demo-mini-label">{label}</div>
        <div className="demo-mini-value">
          <span className="demo-num">{value}</span>
          {unit && <span className="demo-mini-unit">{unit}</span>}
        </div>
      </div>
    </div>
  );
}

function HeroStat({
  value,
  unit,
  label,
}: {
  value: string;
  unit: string;
  label: string;
}) {
  return (
    <div className="demo-hero-stat">
      <div className="demo-hero-stat-value">
        {value}
        <span className="demo-hero-stat-unit">{unit}</span>
      </div>
      <div className="demo-hero-stat-label">{label}</div>
    </div>
  );
}


function StatCard({
  icon,
  label,
  value,
  unit,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  unit: string;
}) {
  return (
    <div className="demo-stat">
      <div className="demo-stat-head">
        <span className="demo-stat-icon">{icon}</span>
        <span className="demo-stat-label">{label}</span>
      </div>
      <div className="demo-stat-value">
        <span className="demo-num">{value}</span>
        <span className="demo-stat-unit">{unit}</span>
      </div>
    </div>
  );
}

function TrimpDemoCard() {
  return (
    <div className="demo-card">
      <div className="flex items-center justify-between mb-6">
        <span className="demo-card-label">
          <Activity className="h-3.5 w-3.5" />
          TRIMP · Cardio Load
        </span>
        <span className="demo-badge demo-badge-accent">Hoch</span>
      </div>

      <div className="flex items-end justify-between gap-6 mb-5">
        <div>
          <div className="demo-eyebrow">Gesamtlast</div>
          <div className="demo-num demo-num-xl">247</div>
        </div>
        <div className="text-right">
          <div className="demo-eyebrow">Intensität</div>
          <div className="demo-num demo-num-lg">
            142<span className="demo-num-unit">/h</span>
          </div>
        </div>
      </div>

      <div className="relative">
        <div className="flex h-2 rounded overflow-hidden">
          <div style={{ width: "20%", background: "#FFD9CC" }} />
          <div style={{ width: "20%", background: "#FFB199" }} />
          <div style={{ width: "40%", background: "#FF8466" }} />
          <div style={{ width: "20%", background: "#C73A1E", opacity: 0.35 }} />
        </div>
        <div
          className="absolute -top-1 h-4 w-0.5"
          style={{ left: "49.5%", background: "var(--fg)" }}
        />
      </div>
      <div className="mt-2 flex justify-between demo-mono text-[11px] text-[color:var(--muted)]">
        <span>0</span>
        <span>100</span>
        <span>200</span>
        <span>400</span>
        <span>500+</span>
      </div>
    </div>
  );
}

/* ─── Section ───────────────────────────────────────── */

function Section({
  title,
  id,
  children,
}: {
  title: string;
  id: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id}>
      <div className="demo-section-header">
        <span className="demo-section-num">§</span>
        <h2 className="demo-section-title">{title}</h2>
      </div>
      {children}
    </section>
  );
}

/* ─── Palette ───────────────────────────────────────── */

function Palette() {
  const colors: { name: string; token: string; hex: string }[] = [
    { name: "Background", token: "--bg", hex: "#FDFCFA" },
    { name: "Surface", token: "--surface", hex: "#F7EFE6" },
    { name: "Border", token: "--border", hex: "#ECE2D4" },
    { name: "Foreground", token: "--fg", hex: "#1C1917" },
    { name: "Muted", token: "--muted", hex: "#78716C" },
    { name: "Accent", token: "--accent", hex: "#FF5B3A" },
    { name: "Accent dark", token: "--accent-dark", hex: "#C73A1E" },
    { name: "Accent soft", token: "--accent-soft", hex: "#FFD9CC" },
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {colors.map((c) => (
        <div key={c.token} className="demo-swatch">
          <div
            className="demo-swatch-color"
            style={{
              background: c.hex,
              borderColor: c.hex === "#FDFCFA" ? "var(--border)" : c.hex,
            }}
          />
          <div className="demo-swatch-meta">
            <div className="demo-swatch-name">{c.name}</div>
            <div className="demo-mono text-[11px] demo-muted">{c.hex}</div>
            <div className="demo-mono text-[11px] demo-muted">{c.token}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Typography ────────────────────────────────────── */

function TypographyScale() {
  return (
    <div className="space-y-5">
      <Row label="Display XL">
        <div className="demo-display">Morgenlauf</div>
      </Row>
      <Row label="Display L">
        <div className="demo-display-md">Morgenlauf</div>
      </Row>
      <Row label="Heading 1">
        <div className="demo-h1">Abschnitt</div>
      </Row>
      <Row label="Heading 2">
        <div className="demo-h2">Abschnitt</div>
      </Row>
      <Row label="Body">
        <div className="text-[15px]">
          Ruhige Flächen, grosse Zahlen, viel Luft. Ein einziger Akzent: Koralle.
        </div>
      </Row>
      <Row label="Small">
        <div className="text-[13px] demo-muted">Sekundäre Information.</div>
      </Row>
      <Row label="Number XL">
        <div className="demo-num demo-num-xl">12,4</div>
      </Row>
      <Row label="Number L">
        <div className="demo-num demo-num-lg">58:23</div>
      </Row>
      <Row label="Mono">
        <div className="demo-mono">04:42 · 152 bpm · 184 m ↑</div>
      </Row>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_1fr] items-baseline gap-6 py-2 border-b border-[color:var(--border)]">
      <div className="demo-eyebrow !mb-0">{label}</div>
      <div>{children}</div>
    </div>
  );
}

/* ─── Buttons ───────────────────────────────────────── */

function ButtonsShowcase() {
  return (
    <div className="space-y-6">
      <Group title="Varianten">
        <button className="demo-btn demo-btn-primary">
          Aktivität starten <ArrowRight className="h-4 w-4" />
        </button>
        <button className="demo-btn demo-btn-secondary">Sekundär</button>
        <button className="demo-btn demo-btn-outline">Outline</button>
        <button className="demo-btn demo-btn-ghost">Ghost</button>
        <button className="demo-btn demo-btn-destructive">Löschen</button>
      </Group>
      <Group title="Grössen">
        <button className="demo-btn demo-btn-primary demo-btn-sm">Small</button>
        <button className="demo-btn demo-btn-primary">Default</button>
        <button className="demo-btn demo-btn-primary demo-btn-lg">Large</button>
      </Group>
      <Group title="States">
        <button className="demo-btn demo-btn-primary">Default</button>
        <button className="demo-btn demo-btn-primary" data-hover>Hover</button>
        <button className="demo-btn demo-btn-primary" data-active>Active</button>
        <button className="demo-btn demo-btn-primary" disabled>Disabled</button>
        <button className="demo-btn demo-btn-primary demo-btn-loading">
          <span className="demo-spinner" /> Lädt…
        </button>
      </Group>
      <Group title="Icon-Buttons">
        <button className="demo-icon-btn" aria-label="Suchen"><Search className="h-4 w-4" /></button>
        <button className="demo-icon-btn demo-icon-btn-primary" aria-label="OK"><Check className="h-4 w-4" /></button>
        <button className="demo-icon-btn" aria-label="Schliessen"><X className="h-4 w-4" /></button>
      </Group>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="demo-eyebrow">{title}</div>
      <div className="flex flex-wrap gap-3 items-center">{children}</div>
    </div>
  );
}

/* ─── Forms ─────────────────────────────────────────── */

function FormsShowcase() {
  return (
    <div className="grid md:grid-cols-2 gap-8">
      <div className="space-y-4">
        <Field label="Name">
          <input className="demo-input" defaultValue="Michael Mauch" />
        </Field>
        <Field label="E-Mail" hint="Wir senden nie Werbung.">
          <input className="demo-input" type="email" placeholder="name@beispiel.ch" />
        </Field>
        <Field label="Geschlecht">
          <select className="demo-input">
            <option>Männlich</option>
            <option>Weiblich</option>
          </select>
        </Field>
        <Field label="Notiz">
          <textarea className="demo-input" rows={3} placeholder="Kurze Beschreibung…" />
        </Field>
        <Field label="Fehler" error="Bitte gib eine gültige Zahl ein.">
          <input className="demo-input demo-input-error" defaultValue="abc" />
        </Field>
      </div>
      <div className="space-y-4">
        <div>
          <div className="demo-eyebrow">Checkbox</div>
          <label className="demo-check">
            <input type="checkbox" defaultChecked />
            <span />
            Wetterdaten automatisch laden
          </label>
          <label className="demo-check">
            <input type="checkbox" />
            <span />
            Öffentlich sichtbar
          </label>
        </div>
        <div>
          <div className="demo-eyebrow">Radio</div>
          <label className="demo-radio">
            <input type="radio" name="r" defaultChecked />
            <span />
            Metrisch
          </label>
          <label className="demo-radio">
            <input type="radio" name="r" />
            <span />
            Imperial
          </label>
        </div>
        <div>
          <div className="demo-eyebrow">Switch</div>
          <label className="demo-switch">
            <input type="checkbox" defaultChecked />
            <span />
            Dark Mode
          </label>
        </div>
        <div>
          <div className="demo-eyebrow">Slider</div>
          <input className="demo-range" type="range" defaultValue={70} />
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="demo-field-label">{label}</span>
      {children}
      {hint && !error && <span className="demo-field-hint">{hint}</span>}
      {error && <span className="demo-field-error">{error}</span>}
    </label>
  );
}

/* ─── Badges ────────────────────────────────────────── */

function BadgesShowcase() {
  return (
    <div className="space-y-4">
      <Group title="Status">
        <span className="demo-badge">Standard</span>
        <span className="demo-badge demo-badge-accent">Aktiv</span>
        <span className="demo-badge demo-badge-success">OK</span>
        <span className="demo-badge demo-badge-warning">Warnung</span>
        <span className="demo-badge demo-badge-danger">Fehler</span>
      </Group>
      <Group title="Chips">
        <span className="demo-chip">Laufen</span>
        <span className="demo-chip demo-chip-active">Rad</span>
        <span className="demo-chip">Wandern</span>
        <span className="demo-chip">Schwimmen</span>
      </Group>
    </div>
  );
}

/* ─── Cards ─────────────────────────────────────────── */

function CardsShowcase() {
  return (
    <div className="grid md:grid-cols-3 gap-4">
      <div className="demo-card">
        <div className="demo-card-label mb-2">
          <BarChart3 className="h-3.5 w-3.5" /> Wochenvolumen
        </div>
        <div className="demo-num demo-num-lg">42,3<span className="demo-num-unit">km</span></div>
        <p className="demo-muted text-sm mt-2">4 Aktivitäten · 3 h 48 min</p>
      </div>
      <div className="demo-card demo-card-accent">
        <div className="demo-card-label mb-2">
          <Flame className="h-3.5 w-3.5" /> Streak
        </div>
        <div className="demo-num demo-num-lg">14<span className="demo-num-unit">Tage</span></div>
        <p className="demo-muted text-sm mt-2">Persönlicher Rekord.</p>
      </div>
      <div className="demo-card">
        <div className="demo-card-label mb-2">
          <Heart className="h-3.5 w-3.5" /> Ruhepuls
        </div>
        <div className="demo-num demo-num-lg">52<span className="demo-num-unit">bpm</span></div>
        <p className="demo-muted text-sm mt-2">−3 vs. Vormonat.</p>
      </div>
    </div>
  );
}

/* ─── Lists ─────────────────────────────────────────── */

function ListsShowcase() {
  const items = [
    { icon: <Footprints />, title: "Morgenlauf Wald", meta: "12,4 km · 58:23", day: "Sa" },
    { icon: <Bike />, title: "Rennrad Seetal", meta: "64,2 km · 2:17:40", day: "Do" },
    { icon: <Mountain />, title: "Wanderung Pilatus", meta: "14,8 km · 6:12:00", day: "Mi" },
    { icon: <Footprints />, title: "Intervall 6×800", meta: "8,1 km · 42:11", day: "Mo" },
  ];
  return (
    <ul className="demo-list">
      {items.map((it) => (
        <li key={it.title} className="demo-list-item">
          <span className="demo-list-day">{it.day}</span>
          <span className="demo-list-icon">{it.icon}</span>
          <div className="flex-1 min-w-0">
            <div className="demo-list-title">{it.title}</div>
            <div className="demo-list-meta">{it.meta}</div>
          </div>
          <ChevronRight className="h-4 w-4 text-[color:var(--muted)]" />
        </li>
      ))}
    </ul>
  );
}

/* ─── Alerts ────────────────────────────────────────── */

function AlertsShowcase() {
  return (
    <div className="space-y-3">
      <Alert variant="info" icon={<Info className="h-4 w-4" />} title="Info">
        Neue Aktivität wurde synchronisiert.
      </Alert>
      <Alert variant="success" icon={<Check className="h-4 w-4" />} title="Erfolg">
        Profil gespeichert.
      </Alert>
      <Alert variant="warning" icon={<AlertTriangle className="h-4 w-4" />} title="Warnung">
        HRmax nicht gesetzt — TRIMP nutzt Schätzung.
      </Alert>
      <Alert variant="danger" icon={<X className="h-4 w-4" />} title="Fehler">
        Synchronisation fehlgeschlagen.
      </Alert>
    </div>
  );
}

function Alert({
  variant,
  icon,
  title,
  children,
}: {
  variant: "info" | "success" | "warning" | "danger";
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`demo-alert demo-alert-${variant}`}>
      <span className="demo-alert-icon">{icon}</span>
      <div>
        <div className="demo-alert-title">{title}</div>
        <div className="demo-alert-body">{children}</div>
      </div>
    </div>
  );
}

/* ─── Tabs ──────────────────────────────────────────── */

function TabsShowcase() {
  return (
    <div>
      <div className="demo-tabs">
        <button className="demo-tab demo-tab-active">Überblick</button>
        <button className="demo-tab">Karte</button>
        <button className="demo-tab">Herzfrequenz</button>
        <button className="demo-tab">Splits</button>
      </div>
      <div className="demo-tab-body">Inhalt des aktiven Tabs.</div>
    </div>
  );
}

/* ─── Table ─────────────────────────────────────────── */

function TableShowcase() {
  return (
    <div className="demo-table-wrap">
      <table className="demo-table">
        <thead>
          <tr>
            <th>Datum</th>
            <th>Typ</th>
            <th className="text-right">Distanz</th>
            <th className="text-right">Zeit</th>
            <th className="text-right">Ø Puls</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>12.04.2026</td>
            <td>Laufen</td>
            <td className="demo-mono text-right">12,4 km</td>
            <td className="demo-mono text-right">58:23</td>
            <td className="demo-mono text-right">152</td>
          </tr>
          <tr>
            <td>10.04.2026</td>
            <td>Rad</td>
            <td className="demo-mono text-right">64,2 km</td>
            <td className="demo-mono text-right">2:17:40</td>
            <td className="demo-mono text-right">138</td>
          </tr>
          <tr>
            <td>09.04.2026</td>
            <td>Wandern</td>
            <td className="demo-mono text-right">14,8 km</td>
            <td className="demo-mono text-right">6:12:00</td>
            <td className="demo-mono text-right">119</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/* ─── Avatars ───────────────────────────────────────── */

function AvatarsShowcase() {
  return (
    <Group title="Grössen">
      <span className="demo-avatar demo-avatar-sm">MM</span>
      <span className="demo-avatar">MM</span>
      <span className="demo-avatar demo-avatar-lg">MM</span>
      <span className="demo-avatar demo-avatar-xl">MM</span>
    </Group>
  );
}

/* ─── Tokens ────────────────────────────────────────── */

function TokensShowcase() {
  return (
    <div className="grid md:grid-cols-2 gap-8">
      <div>
        <div className="demo-eyebrow">Radius</div>
        <div className="flex gap-4 items-end">
          {[4, 6, 8, 12, 16].map((r) => (
            <div key={r} className="text-center">
              <div
                className="w-16 h-16 border"
                style={{
                  borderRadius: r,
                  background: "var(--surface)",
                  borderColor: "var(--border)",
                }}
              />
              <div className="demo-mono text-[11px] demo-muted mt-2">{r}px</div>
            </div>
          ))}
        </div>
      </div>
      <div>
        <div className="demo-eyebrow">Shadow</div>
        <div className="flex gap-4 items-end">
          {[
            { name: "sm", v: "var(--shadow-sm)" },
            { name: "md", v: "var(--shadow-md)" },
            { name: "lg", v: "var(--shadow-lg)" },
          ].map((s) => (
            <div key={s.name} className="text-center">
              <div
                className="w-16 h-16"
                style={{
                  background: "var(--bg)",
                  borderRadius: 8,
                  boxShadow: s.v,
                  border: "1px solid var(--border)",
                }}
              />
              <div className="demo-mono text-[11px] demo-muted mt-2">{s.name}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="md:col-span-2">
        <div className="demo-eyebrow">Spacing</div>
        <div className="flex gap-2 items-end">
          {[4, 8, 12, 16, 24, 32, 48, 64].map((s) => (
            <div key={s} className="text-center">
              <div
                style={{
                  width: s,
                  height: 24,
                  background: "var(--accent)",
                  borderRadius: 2,
                }}
              />
              <div className="demo-mono text-[11px] demo-muted mt-1">{s}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── CSS ───────────────────────────────────────────── */

const css = `
.flux-demo {
  --bg: #FDFCFA;
  --surface: #F7EFE6;
  --surface-2: #F0E4D4;
  --border: #ECE2D4;
  --border-strong: #DFD2BF;
  --fg: #1C1917;
  --muted: #78716C;
  --muted-2: #A8A29E;
  --accent: #FF5B3A;
  --accent-dark: #C73A1E;
  --accent-soft: #FFD9CC;
  --success: #0F766E;
  --warning: #B45309;
  --danger: #BE123C;
  --info: #1E40AF;

  --shadow-sm: 0 1px 2px rgba(80, 40, 20, 0.04);
  --shadow-md: 0 1px 2px rgba(80, 40, 20, 0.04), 0 6px 20px rgba(80, 40, 20, 0.06);
  --shadow-lg: 0 2px 4px rgba(80, 40, 20, 0.06), 0 16px 40px rgba(80, 40, 20, 0.08);

  --r-sm: 4px;
  --r-md: 6px;
  --r-lg: 8px;

  background: var(--bg);
  color: var(--fg);
  font-family: var(--font-display), ui-sans-serif, system-ui, sans-serif;
  font-feature-settings: "ss01", "cv11";
  letter-spacing: -0.01em;
  background-image:
    radial-gradient(1000px 500px at 0% -10%, rgba(255, 91, 58, 0.05), transparent 55%),
    radial-gradient(700px 400px at 100% 0%, rgba(255, 160, 130, 0.08), transparent 60%);
  background-attachment: fixed;
  position: relative;
}


/* Container */
.demo-container {
  max-width: 1080px;
  margin: 0 auto;
  padding-left: 20px;
  padding-right: 20px;
}
@media (min-width: 768px) {
  .demo-container { padding-left: 32px; padding-right: 32px; }
}

/* Nav */
.demo-nav {
  position: sticky; top: 0; z-index: 20;
  backdrop-filter: saturate(1.4) blur(10px);
  background: color-mix(in srgb, var(--bg) 85%, transparent);
  border-bottom: 1px solid var(--border);
}
.demo-brand {
  display: inline-flex; align-items: center; gap: 10px;
  font-weight: 700;
  font-size: 18px;
  letter-spacing: -0.03em;
  color: var(--fg);
  text-decoration: none;
}
.demo-brand-mark {
  width: 10px; height: 10px; border-radius: 2px;
  background: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}
.demo-nav-link {
  display: inline-flex; align-items: center; gap: 6px;
  color: var(--muted);
  text-decoration: none;
  font-weight: 500;
  transition: color 0.15s;
}
.demo-nav-link:hover { color: var(--fg); }

/* Typography */
.demo-eyebrow {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--muted);
  margin-bottom: 10px;
}
.demo-display {
  font-weight: 700;
  font-size: clamp(44px, 9vw, 92px);
  line-height: 0.95;
  letter-spacing: -0.045em;
  color: var(--fg);
}
.demo-display-md {
  font-weight: 700;
  font-size: clamp(32px, 5vw, 48px);
  line-height: 1.02;
  letter-spacing: -0.035em;
  color: var(--fg);
}
.demo-h1 {
  font-weight: 700;
  font-size: 28px;
  line-height: 1.15;
  letter-spacing: -0.025em;
}
.demo-h2 {
  font-weight: 600;
  font-size: 20px;
  line-height: 1.2;
  letter-spacing: -0.02em;
}
.demo-accent { color: var(--accent); }
.demo-lead {
  margin-top: 18px;
  max-width: 560px;
  font-size: 17px;
  color: var(--muted);
  line-height: 1.5;
}
.demo-sub { margin-top: 8px; color: var(--muted); font-size: 15px; }

/* Section header */
.demo-section-header {
  display: flex; align-items: center; gap: 12px;
  margin-bottom: 20px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border);
}
.demo-section-num {
  font-family: var(--font-mono-display);
  color: var(--accent);
  font-weight: 500;
}
.demo-section-title {
  font-weight: 600;
  font-size: 15px;
  letter-spacing: 0;
}

/* Numbers */
.demo-num {
  font-family: var(--font-display);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.03em;
  color: var(--fg);
  font-feature-settings: "ss01", "cv11";
}
.demo-num-xl { font-size: clamp(48px, 7vw, 72px); line-height: 0.9; font-weight: 700; }
.demo-num-lg { font-size: 30px; line-height: 1; }
.demo-num-unit {
  font-family: var(--font-display);
  font-weight: 500;
  font-size: 0.45em;
  color: var(--muted);
  margin-left: 6px;
  letter-spacing: 0;
}

/* Mono */
.demo-mono {
  font-family: var(--font-mono-display);
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.01em;
}

/* Stat card */
.demo-stat {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  padding: 16px 16px 14px;
  transition: border-color 0.15s, background 0.15s;
}
.demo-stat:hover { border-color: var(--border-strong); }
.demo-stat-head {
  display: flex; align-items: center; gap: 8px;
  color: var(--muted);
  margin-bottom: 12px;
}
.demo-stat-icon svg { width: 14px; height: 14px; }
.demo-stat-label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.demo-stat-value {
  display: flex; align-items: baseline; gap: 4px;
}
.demo-stat-value .demo-num { font-size: 28px; line-height: 1; }
.demo-stat-unit {
  font-weight: 500;
  font-size: 12px;
  color: var(--muted);
}

/* Generic card */
.demo-card {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  padding: 20px 22px;
}
.demo-card-accent {
  border-color: var(--accent);
  background:
    linear-gradient(180deg, var(--accent-soft) 0%, var(--bg) 40%),
    var(--bg);
}
.demo-card-label {
  display: inline-flex; align-items: center; gap: 8px;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-weight: 600;
  color: var(--muted);
}

/* Buttons */
.demo-btn {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 10px 16px;
  border-radius: var(--r-md);
  font-size: 14px;
  font-weight: 600;
  letter-spacing: -0.005em;
  cursor: pointer;
  border: 1px solid transparent;
  transition: background 0.12s, color 0.12s, border-color 0.12s, transform 0.08s;
  font-family: inherit;
}
.demo-btn:active { transform: scale(0.98); }
.demo-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.demo-btn-sm { padding: 6px 12px; font-size: 13px; }
.demo-btn-lg { padding: 13px 22px; font-size: 15px; }
.demo-btn-primary {
  background: var(--fg);
  color: var(--bg);
}
.demo-btn-primary:hover, .demo-btn-primary[data-hover] {
  background: var(--accent);
}
.demo-btn-primary[data-active] { background: var(--accent-dark); }
.demo-btn-secondary {
  background: var(--surface);
  color: var(--fg);
}
.demo-btn-secondary:hover { background: var(--surface-2); }
.demo-btn-outline {
  background: transparent;
  color: var(--fg);
  border-color: var(--border-strong);
}
.demo-btn-outline:hover { border-color: var(--fg); }
.demo-btn-ghost {
  background: transparent;
  color: var(--fg);
}
.demo-btn-ghost:hover { background: var(--surface); }
.demo-btn-destructive {
  background: transparent;
  color: var(--danger);
  border-color: color-mix(in srgb, var(--danger) 30%, transparent);
}
.demo-btn-destructive:hover { background: color-mix(in srgb, var(--danger) 8%, transparent); border-color: var(--danger); }
.demo-btn-loading { opacity: 0.7; pointer-events: none; }
.demo-spinner {
  width: 12px; height: 12px;
  border: 2px solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  animation: demo-spin 0.7s linear infinite;
}
@keyframes demo-spin { to { transform: rotate(360deg); } }

.demo-icon-btn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 36px; height: 36px;
  border-radius: var(--r-md);
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--fg);
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}
.demo-icon-btn:hover { border-color: var(--fg); }
.demo-icon-btn-primary {
  background: var(--fg);
  color: var(--bg);
  border-color: var(--fg);
}
.demo-icon-btn-primary:hover { background: var(--accent); border-color: var(--accent); }

/* Chips */
.demo-chip {
  display: inline-flex; padding: 6px 12px;
  border-radius: var(--r-md);
  border: 1px solid var(--border);
  font-size: 13px;
  font-weight: 500;
  color: var(--muted);
  background: var(--bg);
  cursor: pointer;
  transition: all 0.15s;
}
.demo-chip:hover { color: var(--fg); border-color: var(--border-strong); }
.demo-chip-active {
  background: var(--fg);
  color: var(--bg);
  border-color: var(--fg);
}

/* Badges */
.demo-badge {
  display: inline-flex;
  padding: 3px 10px;
  border-radius: var(--r-sm);
  background: var(--surface);
  color: var(--fg);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.03em;
}
.demo-badge-accent { background: var(--accent); color: #fff; }
.demo-badge-success {
  background: color-mix(in srgb, var(--success) 12%, transparent);
  color: var(--success);
}
.demo-badge-warning {
  background: color-mix(in srgb, var(--warning) 14%, transparent);
  color: var(--warning);
}
.demo-badge-danger {
  background: color-mix(in srgb, var(--danger) 12%, transparent);
  color: var(--danger);
}

/* Forms */
.demo-field-label {
  display: block;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--muted);
  margin-bottom: 6px;
}
.demo-input {
  width: 100%;
  padding: 10px 12px;
  border-radius: var(--r-md);
  border: 1px solid var(--border-strong);
  background: var(--bg);
  color: var(--fg);
  font-size: 14px;
  font-family: inherit;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.demo-input::placeholder { color: var(--muted-2); }
.demo-input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}
.demo-input-error { border-color: var(--danger); }
.demo-input-error:focus {
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--danger) 20%, transparent);
  border-color: var(--danger);
}
.demo-field-hint, .demo-field-error {
  display: block;
  font-size: 12px;
  margin-top: 6px;
}
.demo-field-hint { color: var(--muted); }
.demo-field-error { color: var(--danger); font-weight: 500; }

/* Check / radio / switch */
.demo-check, .demo-radio, .demo-switch {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 0;
  font-size: 14px;
  cursor: pointer;
  user-select: none;
}
.demo-check input, .demo-radio input, .demo-switch input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}
.demo-check span {
  width: 18px; height: 18px;
  border: 1.5px solid var(--border-strong);
  border-radius: 4px;
  display: inline-flex; align-items: center; justify-content: center;
  transition: all 0.15s;
  background: var(--bg);
}
.demo-check input:checked + span {
  background: var(--fg);
  border-color: var(--fg);
}
.demo-check input:checked + span::after {
  content: "";
  width: 10px; height: 6px;
  border-left: 2px solid var(--bg);
  border-bottom: 2px solid var(--bg);
  transform: rotate(-45deg) translate(1px, -1px);
}
.demo-radio span {
  width: 18px; height: 18px; border-radius: 999px;
  border: 1.5px solid var(--border-strong);
  background: var(--bg);
  transition: all 0.15s;
  position: relative;
}
.demo-radio input:checked + span {
  border-color: var(--fg);
}
.demo-radio input:checked + span::after {
  content: "";
  position: absolute; inset: 3px;
  background: var(--fg);
  border-radius: 999px;
}
.demo-switch span {
  width: 34px; height: 20px;
  background: var(--border-strong);
  border-radius: 999px;
  position: relative;
  transition: background 0.2s;
}
.demo-switch span::after {
  content: ""; position: absolute;
  top: 2px; left: 2px;
  width: 16px; height: 16px;
  background: var(--bg);
  border-radius: 999px;
  transition: transform 0.2s;
}
.demo-switch input:checked + span { background: var(--accent); }
.demo-switch input:checked + span::after { transform: translateX(14px); }

/* Range */
.demo-range {
  width: 100%;
  -webkit-appearance: none;
  appearance: none;
  height: 4px;
  background: var(--border-strong);
  border-radius: 999px;
}
.demo-range::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 18px; height: 18px;
  border-radius: 999px;
  background: var(--fg);
  cursor: pointer;
  border: 3px solid var(--bg);
  box-shadow: 0 0 0 1px var(--fg);
}

/* Avatars */
.demo-avatar {
  display: inline-flex; align-items: center; justify-content: center;
  width: 34px; height: 34px;
  border-radius: var(--r-md);
  background: var(--fg);
  color: var(--bg);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
}
.demo-avatar-sm { width: 24px; height: 24px; font-size: 10px; border-radius: 4px; }
.demo-avatar-lg { width: 48px; height: 48px; font-size: 14px; border-radius: 8px; }
.demo-avatar-xl { width: 72px; height: 72px; font-size: 20px; border-radius: 12px; }

/* Swatch */
.demo-swatch {
  display: flex; gap: 14px; align-items: center;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  background: var(--bg);
}
.demo-swatch-color {
  width: 52px; height: 52px;
  border-radius: var(--r-sm);
  border: 1px solid transparent;
  flex-shrink: 0;
}
.demo-swatch-name { font-weight: 600; font-size: 13px; }

/* List */
.demo-list {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  overflow: hidden;
  list-style: none;
  padding: 0;
  margin: 0;
}
.demo-list-item {
  display: flex; align-items: center; gap: 14px;
  padding: 14px 18px;
  border-bottom: 1px solid var(--border);
  cursor: pointer;
  transition: background 0.12s;
}
.demo-list-item:last-child { border-bottom: 0; }
.demo-list-item:hover { background: var(--surface); }
.demo-list-day {
  font-family: var(--font-mono-display);
  font-size: 12px;
  font-weight: 500;
  color: var(--muted);
  width: 28px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.demo-list-icon {
  width: 34px; height: 34px;
  display: inline-flex; align-items: center; justify-content: center;
  background: var(--surface);
  border-radius: var(--r-sm);
  color: var(--accent-dark);
}
.demo-list-icon svg { width: 16px; height: 16px; }
.demo-list-title { font-weight: 600; font-size: 14px; letter-spacing: -0.01em; }
.demo-list-meta { font-size: 12px; color: var(--muted); margin-top: 2px; font-family: var(--font-mono-display); }

/* Alert */
.demo-alert {
  display: flex; gap: 12px;
  padding: 12px 14px;
  border-radius: var(--r-md);
  border: 1px solid var(--border);
  background: var(--bg);
  align-items: flex-start;
}
.demo-alert-icon {
  flex-shrink: 0;
  width: 28px; height: 28px;
  display: inline-flex; align-items: center; justify-content: center;
  border-radius: var(--r-sm);
}
.demo-alert-title { font-weight: 600; font-size: 14px; }
.demo-alert-body { font-size: 13px; color: var(--muted); margin-top: 2px; }
.demo-alert-info { border-color: color-mix(in srgb, var(--info) 25%, var(--border)); }
.demo-alert-info .demo-alert-icon { background: color-mix(in srgb, var(--info) 12%, transparent); color: var(--info); }
.demo-alert-success { border-color: color-mix(in srgb, var(--success) 25%, var(--border)); }
.demo-alert-success .demo-alert-icon { background: color-mix(in srgb, var(--success) 12%, transparent); color: var(--success); }
.demo-alert-warning { border-color: color-mix(in srgb, var(--warning) 25%, var(--border)); }
.demo-alert-warning .demo-alert-icon { background: color-mix(in srgb, var(--warning) 14%, transparent); color: var(--warning); }
.demo-alert-danger { border-color: color-mix(in srgb, var(--danger) 25%, var(--border)); }
.demo-alert-danger .demo-alert-icon { background: color-mix(in srgb, var(--danger) 12%, transparent); color: var(--danger); }

/* Tabs */
.demo-tabs {
  display: flex; gap: 4px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 18px;
  overflow-x: auto;
}
.demo-tab {
  padding: 10px 14px;
  font-size: 13px;
  font-weight: 600;
  color: var(--muted);
  background: transparent;
  border: 0;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
  font-family: inherit;
  white-space: nowrap;
}
.demo-tab:hover { color: var(--fg); }
.demo-tab-active { color: var(--fg); border-bottom-color: var(--accent); }
.demo-tab-body {
  padding: 20px;
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  background: var(--bg);
  font-size: 14px;
  color: var(--muted);
}

/* Table */
.demo-table-wrap {
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  overflow: hidden;
  background: var(--bg);
}
.demo-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.demo-table th, .demo-table td {
  padding: 12px 16px;
  text-align: left;
  border-bottom: 1px solid var(--border);
}
.demo-table th {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--muted);
  background: var(--surface);
}
.demo-table tbody tr:last-child td { border-bottom: 0; }
.demo-table tbody tr:hover { background: var(--surface); }

/* Inline photo row */
.demo-inline-photos {
  display: flex;
  gap: 4px;
  margin-top: 12px;
  overflow-x: auto;
  scrollbar-width: none;
}
.demo-inline-photos::-webkit-scrollbar { display: none; }
.demo-inline-photo {
  flex: 0 0 auto;
  width: 56px; height: 56px;
  border-radius: 4px;
  border: 0;
  cursor: pointer;
  transition: transform 0.15s, opacity 0.15s;
  padding: 0;
}
.demo-inline-photo:hover { transform: translateY(-1px); opacity: 0.92; }
.demo-inline-photo-more {
  background: var(--surface) !important;
  color: var(--fg);
  font-weight: 700;
  font-size: 12px;
  display: flex; align-items: center; justify-content: center;
  border: 1px solid var(--border);
}

/* Cockpit summary */
.demo-summary {
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  background: var(--bg);
  overflow: hidden;
  font-feature-settings: "ss01", "cv11", "tnum";
}

/* Split layout */
.demo-summary-split {
  display: grid;
  grid-template-columns: 1fr;
}
@media (min-width: 900px) {
  .demo-summary-split {
    grid-template-columns: minmax(280px, 0.8fr) 1px 1.2fr;
  }
}
.demo-summary-left {
  padding: 18px 18px 16px;
  border-bottom: 1px solid var(--border);
}
@media (min-width: 900px) {
  .demo-summary-left { border-bottom: 0; }
}
.demo-summary-divider {
  display: none;
  background: var(--border);
}
@media (min-width: 900px) {
  .demo-summary-divider { display: block; }
}
.demo-summary-right {
  display: flex;
  flex-direction: column;
}
.demo-summary-note {
  margin-top: 12px;
  font-size: 13px;
  color: var(--muted);
  line-height: 1.45;
}

.demo-summary-head {
  padding: 14px 16px 0;
}
.demo-summary-meta {
  display: flex; align-items: center; gap: 8px;
  flex-wrap: wrap;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted);
  margin-bottom: 6px;
}
.demo-summary-type {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 2px 6px;
  border-radius: 3px;
  background: var(--accent-soft);
  color: var(--accent-dark);
  font-size: 10px;
}
.demo-summary-title {
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.025em;
  line-height: 1.15;
  color: var(--fg);
}

/* Hero stats — three big but compact */
.demo-summary-hero {
  padding: 16px 18px 14px;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  border-bottom: 1px solid var(--border);
}
.demo-hero-stat { padding: 2px 0; min-width: 0; }
.demo-hero-stat + .demo-hero-stat {
  border-left: 1px solid var(--border);
  padding-left: 14px;
}
.demo-hero-stat-value {
  font-weight: 700;
  font-size: clamp(22px, 3.2vw, 30px);
  line-height: 1;
  letter-spacing: -0.03em;
  font-variant-numeric: tabular-nums;
  color: var(--fg);
  display: flex;
  align-items: baseline;
  gap: 3px;
}
.demo-hero-stat-unit {
  font-size: 11px;
  font-weight: 500;
  color: var(--muted);
  letter-spacing: 0;
}
.demo-hero-stat-label {
  margin-top: 4px;
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--muted);
}

/* Mini grid — dense cockpit */
.demo-summary-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  border-bottom: 1px solid var(--border);
}
@media (min-width: 520px) {
  .demo-summary-grid { grid-template-columns: repeat(3, 1fr); }
}
@media (min-width: 900px) {
  .demo-summary-grid { grid-template-columns: repeat(4, 1fr); }
}
.demo-mini {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 12px;
  position: relative;
}
.demo-mini::after {
  content: "";
  position: absolute;
  top: 8px; bottom: 8px; right: 0;
  width: 1px;
  background: var(--border);
}
.demo-mini:last-child::after,
.demo-mini:nth-child(2n)::after { display: none; }
@media (min-width: 520px) {
  .demo-mini:nth-child(2n)::after { display: block; }
  .demo-mini:nth-child(3n)::after { display: none; }
}
@media (min-width: 900px) {
  .demo-mini:nth-child(3n)::after { display: block; }
  .demo-mini:nth-child(4n)::after { display: none; }
}
.demo-mini-icon {
  color: var(--muted);
  flex-shrink: 0;
}
.demo-mini-icon svg { width: 12px; height: 12px; }
.demo-mini-body { min-width: 0; }
.demo-mini-label {
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted);
  line-height: 1.2;
}
.demo-mini-value {
  display: flex; align-items: baseline; gap: 2px;
  margin-top: 1px;
}
.demo-mini-value .demo-num {
  font-size: 14px;
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1;
}
.demo-mini-unit {
  font-size: 10px;
  font-weight: 500;
  color: var(--muted);
}
.demo-mini-highlight .demo-mini-icon { color: var(--accent); }
.demo-mini-highlight .demo-mini-value .demo-num { color: var(--accent); }

/* Macro metric tile */
.demo-macro { grid-column: span 2; }
.demo-macro-bar {
  display: flex;
  height: 4px;
  border-radius: 999px;
  overflow: hidden;
  margin-top: 4px;
  background: var(--surface);
}
.demo-macro-bar > div { height: 100%; }
.demo-macro-pcts {
  font-size: 10px;
  color: var(--muted);
  margin-top: 3px;
  letter-spacing: 0;
}

/* Footer meta */
.demo-summary-foot {
  padding: 6px 16px;
  background: color-mix(in srgb, var(--surface) 30%, var(--bg));
  font-family: var(--font-mono-display);
  font-size: 10px;
  color: var(--muted);
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  letter-spacing: 0;
}

/* Utilities */
.demo-muted { color: var(--muted); }
`;
