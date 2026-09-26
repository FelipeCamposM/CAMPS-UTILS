import { Component, useEffect, useMemo } from "react";
import type { ErrorInfo, ReactNode } from "react";
import L from "leaflet";
import { Circle, MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { Lead } from "../../types/leads";

interface LeadMapProps { leads: Lead[]; selectedId?: string; onSelect: (id: string) => void; radiusKm?: number; }

interface MapGuardState { failed: boolean; }

class MapGuard extends Component<{ children: ReactNode }, MapGuardState> {
  state: MapGuardState = { failed: false };

  static getDerivedStateFromError(): MapGuardState {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Falha ao renderizar o minimapa de leads", error, info);
  }

  render() {
    if (this.state.failed) {
      return <MapPlaceholder message="O minimapa não pôde ser carregado, mas os resultados continuam disponíveis." />;
    }
    return this.props.children;
  }
}

const COLOR: Record<string, string> = { no_site:"#ef4444", social_only:"#f97316", broken:"#dc2626", weak:"#f59e0b", healthy:"#22c55e", unknown:"#64748b" };

function FitLeads({ leads }: { leads: Lead[] }) {
  const map = useMap();
  useEffect(() => {
    const points = leads.filter((x) => x.latitude !== undefined && x.longitude !== undefined).map((x) => [x.latitude!, x.longitude!] as [number,number]);
    if (points.length === 1) map.setView(points[0], 14);
    else if (points.length > 1) map.fitBounds(points, { padding:[24,24], maxZoom:15 });
  }, [leads, map]);
  return null;
}

function MapPlaceholder({ message }: { message: string }) {
  return <section className="glass min-h-[360px] grid place-items-center p-6" aria-label="Minimapa dos leads"><p className="glass-inset px-3 py-2 text-xs text-text-muted text-center">{message}</p></section>;
}

function InteractiveLeadMap({ leads, selectedId, onSelect, radiusKm }: LeadMapProps) {
  const mapped = useMemo(() => leads.filter((x) => Number.isFinite(x.latitude) && Number.isFinite(x.longitude)), [leads]);
  const center: [number,number] = [mapped[0].latitude!, mapped[0].longitude!];
  return (
    <section className="glass overflow-hidden min-h-[360px] relative" aria-label="Minimapa dos leads">
      <MapContainer center={center} zoom={11} className="h-[360px] w-full" scrollWheelZoom>
        <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <FitLeads leads={mapped} />
        {mapped.length > 0 && radiusKm ? <Circle center={center} radius={radiusKm*1000} pathOptions={{color:"#8b5cf6",fillOpacity:0.03}} /> : null}
        {mapped.map((lead) => {
          const selected = lead.id === selectedId;
          const icon = L.divIcon({ className:"lead-map-marker", html:`<span style="background:${COLOR[lead.websiteStatus] ?? COLOR.unknown};transform:scale(${selected ? 1.35 : 1})"></span>`, iconSize:[18,18], iconAnchor:[9,9] });
          return <Marker key={lead.id} position={[lead.latitude!,lead.longitude!]} icon={icon} eventHandlers={{click:()=>onSelect(lead.id)}}><Popup><strong>{lead.name}</strong><br/>Score {lead.score}<br/>{lead.websiteStatus}</Popup></Marker>;
        })}
      </MapContainer>
    </section>
  );
}

export function LeadMap(props: LeadMapProps) {
  const hasCoordinates = props.leads.some((lead) => Number.isFinite(lead.latitude) && Number.isFinite(lead.longitude));
  if (!hasCoordinates) return <MapPlaceholder message="Os pins aparecem quando a fonte fornece coordenadas." />;
  return <MapGuard><InteractiveLeadMap {...props} /></MapGuard>;
}
