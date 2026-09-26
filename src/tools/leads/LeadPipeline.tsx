import { Badge, Select } from "../../components/ui";
import type { Lead, LeadStage } from "../../types/leads";

interface LeadPipelineProps { leads: Lead[]; stages: LeadStage[]; onStage:(id:string,stageId:string)=>void; }
export function LeadPipeline({ leads, stages, onStage }: LeadPipelineProps) {
  return <div className="flex gap-3 overflow-x-auto pb-3" aria-label="Pipeline comercial">{stages.map((stage)=>{
    const items=leads.filter((x)=>x.stageId===stage.id);
    return <section key={stage.id} className="glass p-3 w-64 shrink-0 min-h-[320px]"><header className="flex justify-between items-center mb-3"><span className="text-xs font-medium" style={{color:stage.color}}>{stage.name}</span><Badge>{items.length}</Badge></header><div className="space-y-2">{items.map((lead)=><article key={lead.id} className="glass-inset p-2 space-y-2"><div className="flex justify-between gap-2"><p className="text-xs font-medium truncate">{lead.name}</p><span className="text-[10px] text-accent font-bold">{lead.score}</span></div><p className="text-[10px] text-text-muted truncate">{lead.websiteStatus.replace("_"," ")}</p><Select size="sm" value={lead.stageId} onChange={(v)=>onStage(lead.id,v)} options={stages.map((x)=>({value:x.id,label:x.name}))}/></article>)}</div></section>;
  })}</div>;
}
