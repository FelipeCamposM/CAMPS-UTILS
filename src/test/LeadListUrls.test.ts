import { mapsUrl, normalizeExternalUrl } from "../tools/leads/LeadList";
import type { Lead } from "../types/leads";

describe("ações externas dos leads", () => {
  it("normaliza domínios e remove o redirecionamento do Google", () => {
    expect(normalizeExternalUrl("example.com")).toBe("https://example.com/");
    expect(normalizeExternalUrl("https://www.google.com/url?q=https%3A%2F%2Facme.com")).toBe("https://acme.com/");
  });

  it("usa a URL original do Google Maps quando disponível", () => {
    const lead = { name:"Acme", address:"Main Street", sourceUrls:["https://www.google.com/maps/place/Acme/@1,2,15z"] } as Lead;
    expect(mapsUrl(lead)).toContain("google.com/maps/place/Acme");
  });

  it("monta uma busca do Maps quando o link original não existe", () => {
    const lead = { name:"Acme Dental", address:"Miami, FL", sourceUrls:[] } as Lead;
    expect(mapsUrl(lead)).toContain("query=Acme%20Dental%2C%20Miami%2C%20FL");
  });
});
