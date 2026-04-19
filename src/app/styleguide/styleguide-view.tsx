"use client";

import {
  Activity,
  ArrowLeft,
  BarChart3,
  Bike,
  Calendar,
  Camera,
  CameraOff,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Cloud,
  Download,
  Droplets,
  Flame,
  Footprints,
  Gauge,
  Heart,
  HeartPulse,
  HelpCircle,
  Home,
  Hourglass,
  Image as ImageIcon,
  Loader2,
  Lock,
  LogOut,
  MapPin,
  Medal,
  Menu,
  Minus,
  Moon,
  MoreVertical,
  Mountain,
  Pencil,
  Plus,
  RefreshCw,
  Route,
  Ruler,
  Satellite,
  Scale,
  Send,
  Sun,
  Sunrise,
  Target,
  Thermometer,
  Trash2,
  TrendingDown,
  TrendingUp,
  Trophy,
  Wind,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
} from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

import { BentoTile } from "../components/bento/bento-tile";
import { SevenSegDisplay } from "../components/bento/seven-seg";
import { LedValue } from "../components/bento/led-value";
import { ActivityMetric } from "../components/activity-metric";
import { TrophyIcon } from "../components/trophy-icon";
import { SPORT_COLORS } from "@/lib/sport-colors";
import { activityTypeIcon } from "@/lib/activity-icon";
import { activityTypeColor, activityTypeLabel } from "@/lib/activity-types";
import { SportChip } from "../components/sport-chip";
import { ActivityLottie } from "../components/activity-lottie";
import { ActivityMonthHeader } from "../activities/activity-month-header";

const SECTIONS: { id: string; label: string }[] = [
  { id: "colors", label: "Farben" },
  { id: "sport-colors", label: "Sport-Palette" },
  { id: "typography", label: "Typografie" },
  { id: "radii", label: "Radien" },
  { id: "icons", label: "Icons" },
  { id: "buttons", label: "Buttons" },
  { id: "badges", label: "Badges" },
  { id: "avatars", label: "Avatars" },
  { id: "cards", label: "Cards" },
  { id: "separator", label: "Separator" },
  { id: "dropdown", label: "Dropdown" },
  { id: "alert-dialog", label: "Alert Dialog" },
  { id: "seven-seg", label: "7-Segment" },
  { id: "led-value", label: "LED Value" },
  { id: "activity-metric", label: "Activity Metric" },
  { id: "bento-tile", label: "Bento Tile" },
  { id: "trophy-icons", label: "Trophy Icons" },
  { id: "sport-chips", label: "Sport Chips" },
  { id: "sport-icons", label: "Sport Icons" },
  { id: "month-header", label: "Month Header" },
];

const TOKEN_COLORS: { name: string; varName: string }[] = [
  { name: "background", varName: "--background" },
  { name: "foreground", varName: "--foreground" },
  { name: "surface", varName: "--surface" },
  { name: "surface-2", varName: "--surface-2" },
  { name: "card", varName: "--card" },
  { name: "popover", varName: "--popover" },
  { name: "primary", varName: "--primary" },
  { name: "primary-foreground", varName: "--primary-foreground" },
  { name: "secondary", varName: "--secondary" },
  { name: "muted", varName: "--muted" },
  { name: "muted-foreground", varName: "--muted-foreground" },
  { name: "accent", varName: "--accent" },
  { name: "border", varName: "--border" },
  { name: "input", varName: "--input" },
  { name: "ring", varName: "--ring" },
  { name: "brand", varName: "--brand" },
  { name: "brand-soft", varName: "--brand-soft" },
  { name: "brand-dark", varName: "--brand-dark" },
  { name: "destructive", varName: "--destructive" },
  { name: "chart-1", varName: "--chart-1" },
  { name: "chart-2", varName: "--chart-2" },
  { name: "chart-3", varName: "--chart-3" },
  { name: "chart-4", varName: "--chart-4" },
  { name: "chart-5", varName: "--chart-5" },
];

const RADII: { name: string; varName: string }[] = [
  { name: "sm", varName: "--radius-sm" },
  { name: "md", varName: "--radius-md" },
  { name: "lg", varName: "--radius-lg" },
  { name: "xl", varName: "--radius-xl" },
  { name: "2xl", varName: "--radius-2xl" },
  { name: "3xl", varName: "--radius-3xl" },
  { name: "4xl", varName: "--radius-4xl" },
];

const APP_ICONS: { name: string; Icon: LucideIcon }[] = [
  { name: "Activity", Icon: Activity },
  { name: "ArrowLeft", Icon: ArrowLeft },
  { name: "BarChart3", Icon: BarChart3 },
  { name: "Bike", Icon: Bike },
  { name: "Calendar", Icon: Calendar },
  { name: "Camera", Icon: Camera },
  { name: "CameraOff", Icon: CameraOff },
  { name: "CheckCircle2", Icon: CheckCircle2 },
  { name: "ChevronDown", Icon: ChevronDown },
  { name: "ChevronLeft", Icon: ChevronLeft },
  { name: "ChevronRight", Icon: ChevronRight },
  { name: "Clock", Icon: Clock },
  { name: "Cloud", Icon: Cloud },
  { name: "Download", Icon: Download },
  { name: "Droplets", Icon: Droplets },
  { name: "Flame", Icon: Flame },
  { name: "Footprints", Icon: Footprints },
  { name: "Gauge", Icon: Gauge },
  { name: "Heart", Icon: Heart },
  { name: "HeartPulse", Icon: HeartPulse },
  { name: "HelpCircle", Icon: HelpCircle },
  { name: "Home", Icon: Home },
  { name: "Hourglass", Icon: Hourglass },
  { name: "Image", Icon: ImageIcon },
  { name: "Loader2", Icon: Loader2 },
  { name: "Lock", Icon: Lock },
  { name: "LogOut", Icon: LogOut },
  { name: "MapPin", Icon: MapPin },
  { name: "Medal", Icon: Medal },
  { name: "Menu", Icon: Menu },
  { name: "Minus", Icon: Minus },
  { name: "Moon", Icon: Moon },
  { name: "MoreVertical", Icon: MoreVertical },
  { name: "Mountain", Icon: Mountain },
  { name: "Pencil", Icon: Pencil },
  { name: "Plus", Icon: Plus },
  { name: "RefreshCw", Icon: RefreshCw },
  { name: "Route", Icon: Route },
  { name: "Ruler", Icon: Ruler },
  { name: "Satellite", Icon: Satellite },
  { name: "Scale", Icon: Scale },
  { name: "Send", Icon: Send },
  { name: "Sun", Icon: Sun },
  { name: "Sunrise", Icon: Sunrise },
  { name: "Target", Icon: Target },
  { name: "Thermometer", Icon: Thermometer },
  { name: "Trash2", Icon: Trash2 },
  { name: "TrendingDown", Icon: TrendingDown },
  { name: "TrendingUp", Icon: TrendingUp },
  { name: "Trophy", Icon: Trophy },
  { name: "Wind", Icon: Wind },
  { name: "X", Icon: X },
  { name: "Zap", Icon: Zap },
];

const SPORT_CHIP_TYPES = [
  "RUNNING",
  "TRAIL_RUNNING",
  "ROAD_BIKING",
  "MOUNTAIN_BIKING",
  "HIKING",
  "WALKING",
  "SWIMMING",
  "YOGA",
  "OTHER_INDOOR",
  "OTHER_OUTDOOR",
];

const SPORT_LOTTIE_TYPES = [
  "RUNNING",
  "ROAD_BIKING",
  "HIKING",
  "WALKING",
  "YOGA",
  "BALANCE_BOARD",
  "OTHER_INDOOR",
  "OTHER_OUTDOOR",
];

const SPORT_ICON_TYPES = [
  "RUNNING",
  "TRAIL_RUNNING",
  "ROAD_BIKING",
  "MOUNTAIN_BIKING",
  "HIKING",
  "WALKING",
  "SWIMMING",
  "STRENGTH_TRAINING",
  "CORE",
  "SKIING",
  "CROSS_COUNTRY_SKIING",
  "SNOWSHOE_TREKKING",
  "YOGA",
  "OTHER_INDOOR",
  "OTHER_OUTDOOR",
];

const TROPHY_ICONS = [
  "Bike",
  "Footprints",
  "Medal",
  "Mountain",
  "Clock",
  "Sunrise",
  "Moon",
  "Route",
  "TrendingUp",
  "Activity",
  "Hourglass",
  "Flame",
  "Sun",
  "Trophy",
];

export function StyleguideView() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex max-w-7xl gap-8 px-4 py-8 lg:px-8">
        <Sidebar />
        <main className="min-w-0 flex-1 space-y-16 pb-24">
          <Header />
          <Section id="colors" title="Farben" note="Design-Tokens aus globals.css (Dark Theme)">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {TOKEN_COLORS.map((c) => (
                <ColorSwatch key={c.varName} name={c.name} varName={c.varName} />
              ))}
            </div>
          </Section>

          <Section id="sport-colors" title="Sport-Palette" note="Neon-Farben für Aktivitätstypen">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {Object.entries(SPORT_COLORS).map(([key, hex]) => (
                <HexSwatch key={key} name={key} hex={hex} />
              ))}
            </div>
          </Section>

          <Section id="typography" title="Typografie" note="Manrope (Sans/Heading) · JetBrains Mono · Space Mono (Bento)">
            <Panel>
              <div className="space-y-4">
                <p className="text-5xl font-bold tracking-tight">Flux Headline</p>
                <p className="text-4xl font-semibold">Heading 2</p>
                <p className="text-3xl font-semibold">Heading 3</p>
                <p className="text-2xl font-medium">Heading 4</p>
                <p className="text-xl font-medium">Heading 5</p>
                <p className="text-lg">Heading 6</p>
                <Separator />
                <p className="text-base">
                  Body — The quick brown fox jumps over the lazy dog. 1234567890
                </p>
                <p className="text-sm text-muted-foreground">
                  Small · muted-foreground · alpine tracks · 1:42:30
                </p>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Eyebrow / Label
                </p>
                <p className="font-mono text-sm">
                  font-mono · JetBrains · avgHR 148bpm · 12.34km
                </p>
              </div>
            </Panel>
          </Section>

          <Section id="radii" title="Border Radii">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 md:grid-cols-7">
              {RADII.map((r) => (
                <div key={r.varName} className="flex flex-col items-center gap-2">
                  <div
                    className="h-20 w-20 bg-brand"
                    style={{ borderRadius: `var(${r.varName})` }}
                  />
                  <div className="text-center">
                    <div className="text-xs font-medium">{r.name}</div>
                    <div className="font-mono text-[10px] text-muted-foreground">
                      {r.varName}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <Section id="icons" title="Icons" note={`${APP_ICONS.length} Lucide-Icons aktuell in der App im Einsatz`}>
            <Panel>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
                {APP_ICONS.map(({ name, Icon }) => (
                  <div
                    key={name}
                    className="flex flex-col items-center gap-2 rounded-md border border-border bg-surface p-3"
                  >
                    <Icon className="h-5 w-5" />
                    <span className="truncate text-[10px] text-muted-foreground">
                      {name}
                    </span>
                  </div>
                ))}
              </div>
            </Panel>
          </Section>

          <Section id="buttons" title="Buttons">
            <Panel title="Varianten">
              <Row>
                <Labeled label="default"><Button>Speichern</Button></Labeled>
                <Labeled label="outline"><Button variant="outline">Abbrechen</Button></Labeled>
                <Labeled label="secondary"><Button variant="secondary">Sekundär</Button></Labeled>
                <Labeled label="ghost"><Button variant="ghost">Ghost</Button></Labeled>
                <Labeled label="destructive"><Button variant="destructive">Löschen</Button></Labeled>
                <Labeled label="link"><Button variant="link">Mehr erfahren</Button></Labeled>
                <Labeled label="disabled"><Button disabled>Disabled</Button></Labeled>
              </Row>
            </Panel>

            <Panel title="Größen">
              <Row>
                <Labeled label="xs"><Button size="xs">Extra Small</Button></Labeled>
                <Labeled label="sm"><Button size="sm">Small</Button></Labeled>
                <Labeled label="default"><Button>Default</Button></Labeled>
                <Labeled label="lg"><Button size="lg">Large</Button></Labeled>
              </Row>
            </Panel>

            <Panel title="Icon-Buttons">
              <Row>
                <Labeled label="icon-xs">
                  <Button size="icon-xs" variant="outline"><Plus /></Button>
                </Labeled>
                <Labeled label="icon-sm">
                  <Button size="icon-sm" variant="outline"><RefreshCw /></Button>
                </Labeled>
                <Labeled label="icon">
                  <Button size="icon" variant="outline"><Pencil /></Button>
                </Labeled>
                <Labeled label="icon-lg">
                  <Button size="icon-lg" variant="outline"><Trash2 /></Button>
                </Labeled>
                <Labeled label="loading">
                  <Button disabled>
                    <Loader2 className="animate-spin" />
                    Lade…
                  </Button>
                </Labeled>
                <Labeled label="mit Icon">
                  <Button variant="outline">
                    <Download />
                    Export
                  </Button>
                </Labeled>
              </Row>
            </Panel>
          </Section>

          <Section id="badges" title="Badges">
            <Panel title="Varianten">
              <Row>
                <Badge>default</Badge>
                <Badge variant="secondary">secondary</Badge>
                <Badge variant="destructive">destructive</Badge>
                <Badge variant="outline">outline</Badge>
                <Badge variant="ghost">ghost</Badge>
                <Badge variant="link">link</Badge>
              </Row>
            </Panel>
            <Panel title="Mit Icon">
              <Row>
                <Badge>
                  <CheckCircle2 />
                  Synced
                </Badge>
                <Badge variant="secondary">
                  <Flame />
                  Streak 12
                </Badge>
                <Badge variant="destructive">
                  <X />
                  Fehler
                </Badge>
                <Badge variant="outline">
                  <Clock />
                  Läuft
                </Badge>
              </Row>
            </Panel>
          </Section>

          <Section id="avatars" title="Avatars">
            <Panel title="Größen">
              <Row>
                <Labeled label="sm">
                  <Avatar size="sm"><AvatarFallback>MM</AvatarFallback></Avatar>
                </Labeled>
                <Labeled label="default">
                  <Avatar><AvatarFallback>MM</AvatarFallback></Avatar>
                </Labeled>
                <Labeled label="lg">
                  <Avatar size="lg"><AvatarFallback>MM</AvatarFallback></Avatar>
                </Labeled>
              </Row>
            </Panel>
            <Panel title="Gruppe">
              <AvatarGroup>
                <Avatar><AvatarFallback>MM</AvatarFallback></Avatar>
                <Avatar><AvatarFallback>LK</AvatarFallback></Avatar>
                <Avatar><AvatarFallback>AS</AvatarFallback></Avatar>
                <AvatarGroupCount>+3</AvatarGroupCount>
              </AvatarGroup>
            </Panel>
          </Section>

          <Section id="cards" title="Cards">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Wochen-Ziel</CardTitle>
                  <CardDescription>5 von 7 Aktivitäten erreicht.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4">
                    <Target className="h-10 w-10 text-brand" />
                    <div>
                      <div className="text-2xl font-bold tabular-nums">42.3 km</div>
                      <div className="text-xs text-muted-foreground">
                        +8.1 km ggü. Vorwoche
                      </div>
                    </div>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button variant="ghost" size="sm">Ziele bearbeiten</Button>
                </CardFooter>
              </Card>

              <Card size="sm">
                <CardHeader>
                  <CardTitle>Card (size=sm)</CardTitle>
                  <CardDescription>
                    Kompaktere Variante mit weniger Padding.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Inhalt — verwendet <code className="font-mono">group-data-[size=sm]</code>.
                  </p>
                </CardContent>
              </Card>
            </div>
          </Section>

          <Section id="separator" title="Separator">
            <Panel>
              <p className="text-sm text-muted-foreground">Vor</p>
              <Separator className="my-3" />
              <p className="text-sm text-muted-foreground">Nach</p>
              <div className="mt-4 flex h-10 items-center gap-3 text-sm">
                <span>Links</span>
                <Separator orientation="vertical" />
                <span>Mitte</span>
                <Separator orientation="vertical" />
                <span>Rechts</span>
              </div>
            </Panel>
          </Section>

          <Section id="dropdown" title="Dropdown Menu">
            <Panel>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={<Button variant="outline"><MoreVertical />Optionen</Button>}
                />
                <DropdownMenuContent>
                  <DropdownMenuLabel>Aktivität</DropdownMenuLabel>
                  <DropdownMenuItem><Pencil />Bearbeiten</DropdownMenuItem>
                  <DropdownMenuItem><Download />Export</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive">
                    <Trash2 />Löschen
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </Panel>
          </Section>

          <Section id="alert-dialog" title="Alert Dialog">
            <Panel>
              <AlertDialog>
                <AlertDialogTrigger
                  render={<Button variant="destructive">Aktivität löschen</Button>}
                />
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Sicher löschen?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Diese Aktion kann nicht rückgängig gemacht werden.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                    <AlertDialogAction variant="destructive">Löschen</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </Panel>
          </Section>

          <Section id="seven-seg" title="7-Segment Display" note="Custom SVG-Digit (Bento-Dashboards)">
            <Panel>
              <div className="flex flex-wrap items-end gap-8">
                <div className="flex flex-col items-start gap-1">
                  <span className="text-xs text-muted-foreground">Neon Orange · 3rem</span>
                  <div style={{ fontSize: "3rem" }}>
                    <SevenSegDisplay value="42.3" on="#FF6A00" off="#1a1a1a" />
                  </div>
                </div>
                <div className="flex flex-col items-start gap-1">
                  <span className="text-xs text-muted-foreground">Cyan · 2.5rem · Doppelpunkt</span>
                  <div style={{ fontSize: "2.5rem" }}>
                    <SevenSegDisplay value="1:42:30" on="#00D4FF" off="#1a1a1a" />
                  </div>
                </div>
                <div className="flex flex-col items-start gap-1">
                  <span className="text-xs text-muted-foreground">Weiß · 2rem</span>
                  <div style={{ fontSize: "2rem" }}>
                    <SevenSegDisplay value="12'345" on="#ffffff" off="#1a1a1a" />
                  </div>
                </div>
              </div>
            </Panel>
          </Section>

          <Section id="led-value" title="LED Value" note="Mixed Content — LED-Digits + Text-Suffix">
            <Panel>
              <div className="flex flex-wrap items-end gap-8">
                <div style={{ fontSize: "2.5rem" }}>
                  <LedValue value="7h 42m" color="#FF6A00" />
                </div>
                <div style={{ fontSize: "2.5rem" }}>
                  <LedValue value="04:12" color="#00D4FF" />
                </div>
                <div style={{ fontSize: "2.5rem" }}>
                  <LedValue value="81" color="#39FF14" />
                </div>
                <div style={{ fontSize: "2.5rem" }}>
                  <LedValue value="-" color="#FFD700" />
                </div>
              </div>
            </Panel>
          </Section>

          <Section id="activity-metric" title="Activity Metric" note="Icon · 7-Segment-Wert · Neon-Unit">
            <Panel>
              <div className="flex flex-wrap items-end gap-8 text-[2.5rem]">
                <ActivityMetric
                  icon={<Ruler className="inline h-[0.9em] w-[0.9em]" />}
                  value="12.3"
                  unit="km"
                />
                <ActivityMetric
                  icon={<Clock className="inline h-[0.9em] w-[0.9em]" />}
                  value="1:42"
                  unit="h"
                />
                <ActivityMetric
                  icon={<Heart className="inline h-[0.9em] w-[0.9em]" />}
                  value="148"
                  unit="bpm"
                />
                <ActivityMetric
                  icon={<Mountain className="inline h-[0.9em] w-[0.9em]" />}
                  value="530"
                  unit="m"
                />
              </div>
            </Panel>
          </Section>

          <Section id="bento-tile" title="Bento Tile" note="Basis-Container für das Dashboard">
            <div className="grid gap-4 md:grid-cols-2">
              <BentoTile label="Diese Woche" title="Distanz">
                <div className="text-3xl">
                  <SevenSegDisplay value="42.3" on="#FF6A00" />
                </div>
                <div className="mt-2 text-xs text-[#a3a3a3]">+8.1 km vs. Vorwoche</div>
              </BentoTile>

              <BentoTile
                label="Herzfrequenz"
                title="Durchschnitt"
                right={<Heart className="h-4 w-4 text-[#FF1493]" />}
              >
                <div className="text-3xl">
                  <SevenSegDisplay value="148" on="#FF1493" />
                </div>
                <div className="mt-2 text-xs text-[#a3a3a3]">bpm · letzte 7 Tage</div>
              </BentoTile>
            </div>
          </Section>

          <Section id="trophy-icons" title="Trophy Icons" note="Icon-Set für Trophäen (TrophyIcon-Mapping)">
            <Panel>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 md:grid-cols-7">
                {TROPHY_ICONS.map((name) => (
                  <div
                    key={name}
                    className="flex flex-col items-center gap-2 rounded-md border border-border bg-surface p-3"
                  >
                    <TrophyIcon name={name} className="h-6 w-6 text-brand" />
                    <span className="truncate text-[10px] text-muted-foreground">
                      {name}
                    </span>
                  </div>
                ))}
              </div>
            </Panel>
          </Section>

          <Section id="sport-chips" title="Sport Chips" note="Atom · 2 Varianten">
            <Panel title="default">
              <div className="flex flex-wrap gap-2">
                {SPORT_CHIP_TYPES.map((t) => (
                  <SportChip key={t} type={t} />
                ))}
              </div>
            </Panel>
            <Panel title="mono (Bento)">
              <div className="flex flex-wrap gap-2">
                {SPORT_CHIP_TYPES.map((t) => (
                  <SportChip key={t} type={t} variant="mono" />
                ))}
              </div>
            </Panel>
          </Section>

          <Section
            id="sport-icons"
            title="Sport Icons"
            note="ActivityLottie — Lottie-Animationen in Aktivitäts-Cards, getintet pro Sport"
          >
            <Panel title="Lottie (primär)">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
                {SPORT_LOTTIE_TYPES.map((type) => {
                  const color = activityTypeColor(type);
                  return (
                    <div
                      key={type}
                      className="flex flex-col items-center justify-center gap-2 rounded-md border border-border bg-background p-3"
                    >
                      <ActivityLottie
                        activityType={type}
                        size={80}
                        tint={color}
                      />
                      <span
                        className="text-[10px] font-bold uppercase tracking-[0.18em]"
                        style={{ color }}
                      >
                        {activityTypeLabel(type)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </Panel>
            <Panel title="Lucide (Fallback in SportIconPlaceholder)">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {SPORT_ICON_TYPES.map((type) => {
                  const Icon = activityTypeIcon(type);
                  const color = activityTypeColor(type);
                  return (
                    <div
                      key={type}
                      className="flex flex-col items-center justify-center gap-2 rounded-md border border-border p-4"
                      style={{
                        background: `radial-gradient(circle at 50% 45%, ${color}22, transparent 70%), #0a0a0a`,
                      }}
                    >
                      <Icon
                        className="h-8 w-8"
                        style={{
                          color,
                          filter: `drop-shadow(0 0 8px ${color}aa) drop-shadow(0 0 16px ${color}66)`,
                        }}
                        strokeWidth={1.5}
                      />
                      <span
                        className="text-[10px] font-bold uppercase tracking-[0.18em]"
                        style={{ color: `${color}cc` }}
                      >
                        {activityTypeLabel(type)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </Panel>
          </Section>

          <Section
            id="month-header"
            title="Month Header"
            note="Rajdhani · Neon-Outline + Glow · Gruppierung in Listen und Editorial-Feed"
          >
            <Panel title="compact (Listen-Sticky)">
              <div className="bg-black p-4">
                <ActivityMonthHeader
                  monthKey="2026-04"
                  index={0}
                  count={12}
                  variant="compact"
                />
              </div>
            </Panel>
            <Panel title="editorial (Feed-Hero)">
              <div className="bg-black p-6">
                <ActivityMonthHeader
                  monthKey="2026-04"
                  index={0}
                  count={12}
                  variant="editorial"
                />
              </div>
            </Panel>
          </Section>
        </main>
      </div>
    </div>
  );
}

function Header() {
  return (
    <header className="space-y-2 border-b border-border pb-6">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
        Flux · Styleguide
      </p>
      <h1 className="text-4xl font-bold tracking-tight">Design-System</h1>
      <p className="text-muted-foreground">
        Alle UI-Elemente, Tokens und Icons, die aktuell in Flux im Einsatz sind.
        Dev-only.
      </p>
    </header>
  );
}

function Sidebar() {
  return (
    <aside className="sticky top-8 hidden h-[calc(100vh-4rem)] w-48 shrink-0 overflow-y-auto lg:block">
      <nav className="space-y-1">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Sections
        </p>
        {SECTIONS.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="block rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {s.label}
          </a>
        ))}
      </nav>
    </aside>
  );
}

function Section({
  id,
  title,
  note,
  children,
}: {
  id: string;
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-8 space-y-4">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
        {note && <p className="text-sm text-muted-foreground">{note}</p>}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Panel({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      {title && (
        <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          {title}
        </p>
      )}
      {children}
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center gap-4">{children}</div>;
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-2">
      <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
        {label}
      </span>
      {children}
    </div>
  );
}

function ColorSwatch({ name, varName }: { name: string; varName: string }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div
        className="h-16 w-full border-b border-border"
        style={{ backgroundColor: `var(${varName})` }}
      />
      <div className="bg-card p-2">
        <div className="text-xs font-medium">{name}</div>
        <div className="font-mono text-[10px] text-muted-foreground">
          {varName}
        </div>
      </div>
    </div>
  );
}

function HexSwatch({ name, hex }: { name: string; hex: string }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div
        className="h-16 w-full border-b border-border"
        style={{ backgroundColor: hex }}
      />
      <div className="bg-card p-2">
        <div className="text-xs font-medium">{name}</div>
        <div className="font-mono text-[10px] text-muted-foreground">{hex}</div>
      </div>
    </div>
  );
}
