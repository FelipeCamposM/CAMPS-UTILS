import { AtSign, Copy, ExternalLink, Mail, MapPinned, Phone, RotateCcw, Star, Trash2 } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { Badge, Button, Input, Select, Textarea } from "../../components/ui";
import type { Lead, LeadStage, WebsiteStatus } from "../../types/leads";

interface LeadListProps {
  leads: Lead[]; stages: LeadStage[]; selectedId?: string; trashed?: boolean;
  onSelect:(id:string)=>void; onStage:(id:string,stageId:string)=>void;
  onTrash:(id:string)=>void; onRestore:(id:string)=>void; onPurge:(id:string)=>void;
  onEdit:(id:string,patch:Partial<Lead>)=>void;
}
const STATUS:Record<WebsiteStatus,{label:string;tone:"neutral"|"success"|"warning"|"danger"|"accent"}>={unknown:{label:"Não auditado",tone:"neutral"},no_site:{label:"Sem site",tone:"danger"},social_only:{label:"Só redes",tone:"accent"},broken:{label:"Site quebrado",tone:"danger"},weak:{label:"Site fraco",tone:"warning"},healthy:{label:"Site saudável",tone:"success"}};
function outreachText(lead:Lead){return `Hi ${lead.name}! I noticed an opportunity to improve your online presence. I build fast, professional websites for local businesses. Would you like a quick, no-obligation idea for your business?`;}

async function openExternalUrl(url:string){
  await invoke("open_external_url",{url});
}

export function normalizeExternalUrl(raw:string):string|undefined{
  const candidate=raw.trim();
  if(!candidate)return undefined;
  try{
    const url=new URL(/^https?:\/\//i.test(candidate)?candidate:`https://${candidate}`);
    if(url.hostname.endsWith("google.com")&&url.pathname==="/url"){
      const target=url.searchParams.get("q")||url.searchParams.get("url");
      return target?normalizeExternalUrl(target):undefined;
    }
    return ["http:","https:"].includes(url.protocol)?url.href:undefined;
  }catch{return undefined;}
}

export function mapsUrl(lead:Lead):string{
  const source=lead.sourceUrls.find((url)=>/google\.[^/]+\/maps|maps\.google/i.test(url));
  if(source)return source;
  const query=Number.isFinite(lead.latitude)&&Number.isFinite(lead.longitude)?`${lead.latitude},${lead.longitude}`:[lead.name,lead.address].filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function LeadCard({lead,stages,selectedId,trashed,onSelect,onStage,onTrash,onRestore,onPurge,onEdit}:Omit<LeadListProps,"leads">&{lead:Lead}){
  const status=STATUS[lead.websiteStatus]??STATUS.unknown;const message=outreachText(lead);
  return <article className={`glass p-3 space-y-2 cursor-pointer ${selectedId===lead.id?"ring-1 ring-accent":""}`} onClick={()=>onSelect(lead.id)}>
    <div className="flex items-start gap-3"><div className="grid place-items-center rounded-xl bg-accent/15 text-accent w-11 h-11 shrink-0"><span className="text-sm font-bold">{lead.score}</span><span className="text-[8px] -mt-1">score</span></div><div className="min-w-0 flex-1"><h3 className="text-sm font-medium text-text-primary truncate">{lead.name}</h3><p className="text-[11px] text-text-muted truncate">{lead.category||"Empresa"} · {lead.address||"Endereço não informado"}</p><div className="flex flex-wrap gap-1 mt-1"><Badge tone={status.tone}>{status.label}</Badge>{lead.instagramUrl&&<Badge tone="accent">Instagram</Badge>}{lead.reviewCount!==undefined&&<Badge><Star className="w-3 h-3 -ml-0.5" aria-hidden="true"/>{lead.rating!==undefined?`${lead.rating} · `:""}{lead.reviewCount} avaliações</Badge>}{lead.distanceKm!==undefined&&<Badge>{lead.distanceKm.toFixed(1)} km</Badge>}</div></div>{trashed?<div className="flex gap-1"><Button variant="ghost" size="sm" aria-label={`Restaurar ${lead.name}`} onClick={(e)=>{e.stopPropagation();onRestore(lead.id);}}><RotateCcw className="w-4 h-4"/></Button><Button variant="danger" size="sm" aria-label={`Excluir permanentemente ${lead.name}`} onClick={(e)=>{e.stopPropagation();onPurge(lead.id);}}><Trash2 className="w-4 h-4"/></Button></div>:<Button variant="ghost" size="sm" aria-label={`Mover ${lead.name} para lixeira`} onClick={(e)=>{e.stopPropagation();onTrash(lead.id);}}><Trash2 className="w-4 h-4"/></Button>}</div>
    <div className="flex gap-2 items-center flex-wrap" onClick={(e)=>e.stopPropagation()}><Select size="sm" value={lead.stageId} onChange={(v)=>onStage(lead.id,v)} options={stages.map((x)=>({value:x.id,label:x.name}))} className="w-40"/>{lead.phone&&<Button size="sm" variant="ghost" onClick={()=>openExternalUrl(`tel:${lead.phone}`)}><Phone className="w-3.5 h-3.5"/>Ligar</Button>}{lead.email&&<Button size="sm" variant="ghost" onClick={()=>openExternalUrl(`mailto:${lead.email}?subject=${encodeURIComponent("Website idea for your business")}&body=${encodeURIComponent(message)}`)}><Mail className="w-3.5 h-3.5"/>E-mail</Button>}{lead.instagramUrl&&<Button size="sm" variant="ghost" onClick={()=>openExternalUrl(normalizeExternalUrl(lead.instagramUrl)??lead.instagramUrl)}><AtSign className="w-3.5 h-3.5"/>Perfil</Button>}{normalizeExternalUrl(lead.websiteUrl)&&<Button size="sm" variant="ghost" onClick={()=>openExternalUrl(normalizeExternalUrl(lead.websiteUrl)!)}><ExternalLink className="w-3.5 h-3.5"/>Site</Button>}<Button size="sm" variant="ghost" onClick={()=>openExternalUrl(mapsUrl(lead))}><MapPinned className="w-3.5 h-3.5"/>Ver no Maps</Button><Button size="sm" variant="ghost" onClick={()=>navigator.clipboard.writeText(message)}><Copy className="w-3.5 h-3.5"/>Mensagem</Button></div>
    {(lead.auditFindings?.length??0)>0&&<ul className="text-[10px] text-warning space-y-0.5" aria-label={`Diagnóstico de ${lead.name}`}>{lead.auditFindings.slice(0,4).map((finding)=><li key={`${finding.code}-${finding.value??""}`}>• {finding.label}</li>)}</ul>}
    {(lead.scoreReasons?.length??0)>0&&<p className="text-[10px] text-text-muted">{lead.scoreReasons.slice(0,3).join(" · ")}</p>}
    {selectedId===lead.id&&!trashed&&<div className="grid gap-2 sm:grid-cols-2 pt-2 border-t border-border-subtle" onClick={(e)=>e.stopPropagation()}><Textarea size="sm" aria-label={`Notas de ${lead.name}`} defaultValue={lead.notes??""} placeholder="Notas comerciais…" onBlur={(e)=>onEdit(lead.id,{notes:e.target.value})}/><div className="space-y-2"><Input size="sm" aria-label={`Tags de ${lead.name}`} defaultValue={(lead.tags??[]).join(", ")} placeholder="tags, separadas, por vírgula" onBlur={(e)=>onEdit(lead.id,{tags:e.target.value.split(",").map((x)=>x.trim()).filter(Boolean)})}/><Input size="sm" type="datetime-local" aria-label={`Próxima ação de ${lead.name}`} defaultValue={lead.nextActionAt?new Date(lead.nextActionAt).toISOString().slice(0,16):""} onBlur={(e)=>onEdit(lead.id,{nextActionAt:e.target.value?new Date(e.target.value).getTime():undefined})}/></div></div>}
  </article>;
}

export function LeadList({leads,stages,selectedId,trashed,onSelect,onStage,onTrash,onRestore,onPurge,onEdit}:LeadListProps){
  if(!leads.length)return <div className="glass p-8 text-center text-sm text-text-muted">Nenhum lead corresponde aos filtros atuais.</div>;
  const cardProps={stages,selectedId,trashed,onSelect,onStage,onTrash,onRestore,onPurge,onEdit};
  return <div className="space-y-2" aria-label="Lista de leads">{leads.map((lead)=><LeadCard key={lead.id} lead={lead} {...cardProps}/>)}</div>;
}
