import { useCallback, useEffect, useMemo, useState } from "react";
import { open, save } from "@tauri-apps/plugin-dialog";
import { ArrowLeft, Download, Filter, FolderInput, RotateCcw, Trash2 } from "lucide-react";
import { Badge, Button, Input, SegmentedControl, Slider, Tabs } from "../../components/ui";
import type { BadgeProps } from "../../components/ui";
import { ProgressoTranscricao } from "../../components/ProgressoTranscricao";
import { useToolProgress } from "../../hooks/useToolProgress";
import { useLeadSearch } from "../../hooks/useLeadSearch";
import type { LeadSearchController } from "../../hooks/useLeadSearch";
import { useToolEnter } from "../../lib/motion";
import {
  clearInstagramSession, completeLead, deleteCampaign, exportCampaignMarkdown, getScoreWeights, importCampaignMarkdown,
  initializeLeads, listCampaigns, listLeads, listStages,
  purgeLead, restoreLead, saveScoreWeights, trashLead, updateLead,
} from "../../services/leadService";
import type { Lead, LeadCampaign, LeadStage, ScoreWeights, WebsiteStatus } from "../../types/leads";
import { DEFAULT_SCORE_WEIGHTS } from "../../types/leads";
import type { ToolProps } from "../registry";
import { LeadList } from "./LeadList";
import { LeadMap } from "./LeadMap";
import { LeadPipeline } from "./LeadPipeline";
import { DEFAULT_LEAD_SEARCH, LeadSearchForm } from "./LeadSearchForm";
import type { LeadSearchFormValue } from "./LeadSearchForm";
import { LeadSettings } from "./LeadSettings";

type LeadsTab = "search" | "results" | "pipeline" | "settings";
type StatusFilter = "opportunities" | "all" | WebsiteStatus;

interface LeadsToolProps extends ToolProps {
  /** Vem de `App.tsx`, que nunca desmonta — mantém a busca viva ao trocar de ferramenta.
   *  Opcional pra permitir montar `LeadsTool` sozinho (ex. testes): cai numa instância local. */
  search?: LeadSearchController;
}

const CAMPAIGN_STATUS: Record<LeadCampaign["status"], { label: string; tone: BadgeProps["tone"] }> = {
  running: { label: "Rodando…", tone: "accent" },
  completed: { label: "Concluída", tone: "success" },
  failed: { label: "Falhou", tone: "danger" },
  paused: { label: "Pausada", tone: "neutral" },
  draft: { label: "Rascunho", tone: "neutral" },
  cancelled: { label: "Cancelada", tone: "neutral" },
};

/** Um card por busca — clicar leva pro detalhe só daquela campanha (`LeadsTool` seta `campaignId`). */
function CampaignCard({ campaign, onOpen, onDelete }: { campaign: LeadCampaign; onOpen: () => void; onDelete: () => void }) {
  const status = CAMPAIGN_STATUS[campaign.status] ?? CAMPAIGN_STATUS.draft;
  // `<article>`, não `<button>`: o botão de excluir precisa viver dentro do
  // card, e HTML não permite `<button>` aninhado (o navegador quebra a
  // estrutura sozinho e some com o clique certo).
  return (
    <article onClick={onOpen} className="glass glass-hover p-3 space-y-2 text-left cursor-pointer">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-medium text-text-primary truncate">{campaign.name}</h3>
        <div className="flex items-center gap-1 shrink-0">
          <Badge tone={status.tone}>{status.label}</Badge>
          <Button variant="ghost" size="sm" aria-label={`Excluir busca ${campaign.name}`} onClick={(e)=>{e.stopPropagation();onDelete();}}><Trash2 className="w-3.5 h-3.5"/></Button>
        </div>
      </div>
      <p className="text-[11px] text-text-muted truncate">{campaign.niches.join(", ")} · {campaign.locationLabel}</p>
      <div className="flex items-center justify-between text-[11px] text-text-secondary">
        <span>{campaign.foundCount} encontrados · {campaign.auditedCount} auditados</span>
        <span className="text-text-muted">{new Date(campaign.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</span>
      </div>
    </article>
  );
}

export function LeadsTool({ search: sharedSearch }: LeadsToolProps) {
  const localSearch = useLeadSearch();
  const search = sharedSearch ?? localSearch;
  const [tab,setTab]=useState<LeadsTab>("search");
  const [form,setForm]=useState<LeadSearchFormValue>(DEFAULT_LEAD_SEARCH);
  const [campaigns,setCampaigns]=useState<LeadCampaign[]>([]);
  const [campaignId,setCampaignId]=useState(()=>search.running?search.campaignId:"");
  const [leads,setLeads]=useState<Lead[]>([]);
  const [stages,setStages]=useState<LeadStage[]>([]);
  const [weights,setWeights]=useState<ScoreWeights>(DEFAULT_SCORE_WEIGHTS);
  const [error,setError]=useState<string|null>(null);
  const [notice,setNotice]=useState<string|null>(null);
  const [query,setQuery]=useState("");
  const [status,setStatus]=useState<StatusFilter>("opportunities");
  const [minScore,setMinScore]=useState(0);
  const [instagramOnly,setInstagramOnly]=useState(false);
  const [showTrash,setShowTrash]=useState(false);
  const [selectedId,setSelectedId]=useState<string>();
  const running=search.running;
  const {progresso,etapa,zerar}=useToolProgress();
  const rootRef=useToolEnter();

  const refreshCampaigns=useCallback(async()=>{const rows=await listCampaigns();setCampaigns(Array.isArray(rows)?rows:[]);},[]);
  const refreshLeads=useCallback(async()=>{const rows=await listLeads({campaignId:campaignId||undefined,deleted:showTrash});setLeads(Array.isArray(rows)?rows.map((lead)=>completeLead(lead,lead.campaignId??campaignId)):[]);},[campaignId,showTrash]);

  useEffect(()=>{initializeLeads().then(async()=>{await Promise.all([refreshCampaigns(),listStages().then(setStages),getScoreWeights().then(setWeights)]);}).catch(()=>setError("Não foi possível abrir o banco local de leads."));},[refreshCampaigns]);
  useEffect(()=>{refreshLeads().catch(()=>setError("Não foi possível carregar os leads."));},[refreshLeads]);
  // Junta os leads que a busca em andamento (ou recém-terminada) já achou — permite
  // remontar no meio de uma busca sem mostrar uma lista vazia.
  useEffect(()=>{
    if(!search.leads.length)return;
    setLeads((prev)=>{
      const incoming=campaignId?search.leads.filter((l)=>l.campaignId===campaignId):search.leads;
      if(!incoming.length)return prev;
      const byId=new Map(prev.map((l)=>[l.id,l]));
      for(const lead of incoming)byId.set(lead.id,lead);
      return [...byId.values()];
    });
  },[search.leads,campaignId]);

  const filtered=useMemo(()=>leads.filter((lead)=>{
    const hay=`${lead.name} ${lead.address} ${lead.category} ${lead.notes}`.toLowerCase();
    const matchesStatus=status==="all"||(status==="opportunities"?["no_site","social_only","broken","weak"].includes(lead.websiteStatus):lead.websiteStatus===status);
    return (!query.trim()||hay.includes(query.trim().toLowerCase()))&&matchesStatus&&lead.score>=minScore&&(!instagramOnly||!!lead.instagramUrl);
  }),[leads,query,status,minScore,instagramOnly]);
  const activeCampaign=campaigns.find((x)=>x.id===campaignId);

  async function startSearch(){
    if(running)return;setError(null);setNotice(null);zerar();
    try{
      const result=await search.start(form,weights);
      setCampaignId(result.campaignId);setTab("results");setNotice(`${result.found} leads encontrados e ${result.audited} auditados.`);
    }catch(e){setError(e instanceof Error?e.message:"Falha na busca de leads.");}
    await refreshCampaigns().catch(()=>undefined);
  }

  async function changeStage(id:string,stageId:string){await updateLead(id,{stageId});setLeads((prev)=>prev.map((x)=>x.id===id?{...x,stageId,updatedAt:Date.now()}:x));}
  async function removeLead(id:string){await trashLead(id);setLeads((prev)=>prev.filter((x)=>x.id!==id));}
  async function restore(id:string){await restoreLead(id);setLeads((prev)=>prev.filter((x)=>x.id!==id));}
  async function purge(id:string){if(!window.confirm("Excluir este lead permanentemente? Esta ação não pode ser desfeita."))return;await purgeLead(id);setLeads((prev)=>prev.filter((x)=>x.id!==id));}
  async function editLead(id:string,patch:Partial<Lead>){await updateLead(id,patch);setLeads((prev)=>prev.map((x)=>x.id===id?{...x,...patch,updatedAt:Date.now()}:x));}
  async function exportMd(){if(!campaignId)return;const path=await save({defaultPath:`${activeCampaign?.name||"leads"}.md`,filters:[{name:"Markdown",extensions:["md"]}]});if(path){await exportCampaignMarkdown(campaignId,path);setNotice(`Base Markdown salva em ${path}`);}}
  async function importMd(){const path=await open({multiple:false,filters:[{name:"Markdown",extensions:["md"]}]});if(typeof path==="string"){const result=await importCampaignMarkdown(path);await refreshCampaigns();setCampaignId(result.campaignId);setNotice(`${result.imported} leads importados.`);setTab("results");}}
  async function removeCampaign(id:string){
    const name=campaigns.find((x)=>x.id===id)?.name??"esta busca";
    if(!window.confirm(`Excluir "${name}" e todos os seus leads? Esta ação não pode ser desfeita.`))return;
    await deleteCampaign(id);
    if(campaignId===id){setCampaignId("");setLeads([]);}
    await refreshCampaigns();
  }

  return <div ref={rootRef} className="space-y-4">
    <Tabs label="Áreas da prospecção" value={tab} onChange={setTab} options={[{value:"search",label:"Buscar"},{value:"results",label:"Resultados",count:leads.length},{value:"pipeline",label:"Pipeline"},{value:"settings",label:"Configurações"}]}/>
    {running&&<ProgressoTranscricao progresso={progresso} etapa={etapa} aviso="O Edge pode abrir para login ou confirmação do Instagram."/>}
    {notice&&<div className="glass glass-success p-3 text-xs text-success">{notice}</div>}
    {error&&<p role="alert" className="glass p-3 text-xs text-danger">{error}</p>}
    {tab==="search"&&<LeadSearchForm value={form} onChange={setForm} onSubmit={startSearch} running={running}/>}
    {tab==="results"&&(campaignId?<div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Button size="sm" variant="ghost" onClick={()=>setCampaignId("")}><ArrowLeft className="w-3.5 h-3.5"/>Voltar às buscas</Button>
        <div className="flex items-center gap-2 min-w-0">
          <h2 className="text-sm font-medium text-text-primary truncate">{activeCampaign?.name}</h2>
          <Button size="sm" onClick={exportMd}><Download className="w-4 h-4"/>Exportar .md</Button>
          <Button size="sm" variant="danger" onClick={()=>removeCampaign(campaignId)}><Trash2 className="w-3.5 h-3.5"/>Excluir busca</Button>
        </div>
      </div>
      <section className="glass p-3 space-y-3">
        <div className="flex items-center gap-2"><Filter className="w-4 h-4 text-text-muted"/><Input size="sm" value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Buscar empresa, nicho, endereço ou nota…"/></div>
        <SegmentedControl label="Status do site" value={status} onChange={setStatus} grow={false} options={[{value:"opportunities",label:"Oportunidades"},{value:"no_site",label:"Sem site"},{value:"broken",label:"Quebrado"},{value:"weak",label:"Fraco"},{value:"social_only",label:"Só redes"},{value:"healthy",label:"Saudável"},{value:"all",label:"Todos"}]}/>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] items-end">
          <Slider id="lead-min-score" label="Score mínimo" value={minScore} min={0} max={100} onChange={setMinScore}/>
          <div className="flex gap-2"><Button size="sm" aria-pressed={instagramOnly} onClick={()=>setInstagramOnly((v)=>!v)}>Com Instagram</Button><Button size="sm" aria-pressed={showTrash} onClick={()=>setShowTrash((v)=>!v)}><Trash2 className="w-3.5 h-3.5"/>Lixeira</Button></div>
        </div>
      </section>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(340px,0.8fr)]"><LeadList leads={filtered} stages={stages} selectedId={selectedId} trashed={showTrash} onSelect={setSelectedId} onStage={changeStage} onTrash={removeLead} onRestore={restore} onPurge={purge} onEdit={editLead}/><LeadMap leads={filtered} selectedId={selectedId} onSelect={setSelectedId} radiusKm={activeCampaign?.radiusKm}/></div>
    </div>:<div className="space-y-3">
      <div className="flex justify-end"><Button size="sm" onClick={importMd}><FolderInput className="w-4 h-4"/>Importar .md</Button></div>
      {campaigns.length>0?<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{campaigns.map((c)=><CampaignCard key={c.id} campaign={c} onOpen={()=>setCampaignId(c.id)} onDelete={()=>removeCampaign(c.id)}/>)}</div>
      :<div className="glass p-6 text-center"><Badge>Nenhuma busca</Badge><p className="text-xs text-text-muted mt-2">Crie uma campanha ou importe uma base Markdown.</p><Button size="sm" className="mt-3" onClick={()=>setTab("search")}><RotateCcw className="w-3.5 h-3.5"/>Nova busca</Button></div>}
    </div>)}
    {tab==="pipeline"&&<LeadPipeline leads={filtered} stages={stages} onStage={changeStage}/>}
    {tab==="settings"&&<LeadSettings weights={weights} onChange={setWeights} onSave={async()=>{await saveScoreWeights(weights);setNotice("Pesos do score salvos.");}} onClearSession={async()=>{await clearInstagramSession();setNotice("Sessão local do Instagram removida.");}}/>}
    {!running&&tab==="pipeline"&&leads.length===0&&<div className="glass p-6 text-center"><Badge>Nenhum lead</Badge><p className="text-xs text-text-muted mt-2">Crie uma campanha ou importe uma base Markdown.</p><Button size="sm" className="mt-3" onClick={()=>setTab("search")}><RotateCcw className="w-3.5 h-3.5"/>Nova busca</Button></div>}
  </div>;
}
