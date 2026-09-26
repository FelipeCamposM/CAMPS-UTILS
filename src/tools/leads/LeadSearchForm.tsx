import { Search } from "lucide-react";
import { Button, Field, Input, SegmentedControl, Select, Slider } from "../../components/ui";
import type { CampaignSource, LeadOpportunityFocus, LeadSearchSettings } from "../../types/leads";
import { BR_STATES, citiesForState } from "./brLocations";

export interface LeadSearchFormValue {
  name: string;
  source: CampaignSource;
  niches: string;
  /** Rua/bairro/complemento — livre, opcional. Fora do Brasil é o único campo de local. */
  location: string;
  /** Sigla da UF — só relevante quando `country==="BR"`. */
  state: string;
  /** Nome do município — só relevante quando `country==="BR"`. */
  city: string;
  country: string;
  language: string;
  radiusKm: number;
  maxLeads: number;
  pace: LeadSearchSettings["pace"];
  auditWebsites: boolean;
  opportunityFocus: LeadOpportunityFocus;
}

interface LeadSearchFormProps {
  value: LeadSearchFormValue;
  onChange: (value: LeadSearchFormValue) => void;
  onSubmit: () => void;
  running: boolean;
}

const COUNTRIES = [
  { value: "BR", label: "Brasil" },
  { value: "US", label: "Estados Unidos" },
];
const LANGUAGES = [{ value: "pt-BR", label: "Português" }];

export const DEFAULT_LEAD_SEARCH: LeadSearchFormValue = {
  name: "",
  source: "google_maps",
  niches: "restaurantes, dentistas",
  location: "",
  state: "GO",
  city: "Goiânia",
  country: "BR",
  language: "pt-BR",
  radiusKm: 10,
  maxLeads: 100,
  pace: "balanced",
  auditWebsites: true,
  opportunityFocus: "no_site_first",
};

/** Local final mandado pra busca: no Brasil junta rua + cidade + UF; fora, é só o texto livre. */
export function effectiveLocation(value: LeadSearchFormValue): string {
  if (value.country !== "BR" || !value.city) return value.location;
  const rua = value.location.trim();
  return `${rua ? `${rua}, ` : ""}${value.city} - ${value.state}, Brasil`;
}

export function LeadSearchForm({ value, onChange, onSubmit, running }: LeadSearchFormProps) {
  const set = <K extends keyof LeadSearchFormValue>(key: K, next: LeadSearchFormValue[K]) => onChange({ ...value, [key]: next });
  const isBrazil = value.country === "BR";
  const valid = (isBrazil ? Boolean(value.state && value.city) : value.location.trim().length > 0)
    && value.niches.split(",").some((x) => x.trim()) && value.maxLeads > 0;
  return (
    <section className="glass p-4 space-y-4" aria-label="Configurar busca de leads">
      <SegmentedControl
        label="Fonte"
        value={value.source}
        onChange={(v) => set("source", v)}
        options={[{ value: "both", label: "Maps + Instagram" }, { value: "google_maps", label: "Google Maps" }, { value: "instagram", label: "Instagram" }]}
      />
      <SegmentedControl
        label="Prioridade comercial"
        value={value.opportunityFocus}
        onChange={(v) => set("opportunityFocus", v)}
        options={[
          { value: "no_site_first", label: "Sem site primeiro" },
          { value: "balanced", label: "Sem site + sites ruins" },
          { value: "all", label: "Trazer todos" },
        ]}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nome da campanha" htmlFor="lead-campaign-name" description="Vazio usa nicho + local">
          <Input id="lead-campaign-name" value={value.name} onChange={(e) => set("name", e.target.value)} placeholder="Prospecção Goiânia" disabled={running} />
        </Field>
        <Field label="Nicho(s)" htmlFor="lead-niches" description="Separe vários por vírgula">
          <Input id="lead-niches" value={value.niches} onChange={(e) => set("niches", e.target.value)} placeholder="dentistas, restaurantes" disabled={running} />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="País" htmlFor="lead-country"><Select id="lead-country" value={value.country} onChange={(v) => set("country", v)} disabled={running} options={COUNTRIES} /></Field>
          <Field label="Idioma" htmlFor="lead-language"><Select id="lead-language" value={value.language} onChange={(v) => set("language", v)} disabled={running} options={LANGUAGES} /></Field>
        </div>
        {isBrazil && (
          <div className="grid grid-cols-2 gap-2">
            <Field label="Estado" htmlFor="lead-state">
              <Select id="lead-state" value={value.state} disabled={running} options={BR_STATES} searchable
                onChange={(uf) => {
                  const cidades = citiesForState(uf);
                  const mantemCidade = cidades.some((c) => c.value === value.city);
                  onChange({ ...value, state: uf, city: mantemCidade ? value.city : cidades[0]?.value ?? "" });
                }}
              />
            </Field>
            <Field label="Cidade" htmlFor="lead-city">
              <Select id="lead-city" value={value.city} onChange={(v) => set("city", v)} disabled={running} searchable options={citiesForState(value.state)} />
            </Field>
          </div>
        )}
        <Field label={isBrazil ? "Rua, bairro (opcional)" : "Local"} htmlFor="lead-location">
          <Input id="lead-location" value={value.location} onChange={(e) => set("location", e.target.value)} placeholder={isBrazil ? "Setor Bueno" : "Miami, Florida"} disabled={running} />
        </Field>
        <Slider id="lead-radius" label={`Raio (${value.radiusKm} km)`} value={value.radiusKm} min={1} max={50} onChange={(v) => set("radiusKm", v)} disabled={running} />
        <Field label="Máximo de leads" htmlFor="lead-max"><Input id="lead-max" type="number" min={1} max={500} value={value.maxLeads} onChange={(e) => set("maxLeads", Math.max(1, Math.min(500, Number(e.target.value))))} disabled={running} /></Field>
        <Field label="Ritmo" htmlFor="lead-pace">
          <Select id="lead-pace" value={value.pace} onChange={(v) => set("pace", v)} disabled={running} options={[{value:"slow",label:"Cauteloso",hint:"Mais pausas e menor risco de bloqueio"},{value:"balanced",label:"Equilibrado"},{value:"fast",label:"Rápido",hint:"Mais sujeito a bloqueios"}]} />
        </Field>
        <label className="glass-inset flex items-center gap-2 px-3 py-2 text-xs text-text-secondary self-end cursor-pointer">
          <input type="checkbox" checked={value.auditWebsites} onChange={(e) => set("auditWebsites", e.target.checked)} disabled={running} className="accent-accent" />
          Auditar qualidade dos sites
        </label>
      </div>
      <Button variant="primary" className="w-full" onClick={onSubmit} disabled={!valid} loading={running}>
        <Search className="w-4 h-4" aria-hidden="true" /> {running ? "Buscando e auditando…" : "Iniciar prospecção"}
      </Button>
      <p className="text-text-muted text-[11px]">Automação experimental. Se Maps ou Instagram pedirem login ou CAPTCHA, a busca pausará para sua intervenção.</p>
    </section>
  );
}
