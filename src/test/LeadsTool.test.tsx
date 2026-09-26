import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { LeadsTool } from "../tools/leads/LeadsTool";
import { DEFAULT_SEARCH_SETTINGS } from "../types/leads";
import type { LeadCampaign } from "../types/leads";

const invoke = vi.mocked((await import("@tauri-apps/api/core")).invoke);

function campaignFixture(overrides: Partial<LeadCampaign> = {}): LeadCampaign {
  return {
    id: "camp-1", name: "Campanha teste", source: "both", niches: ["padaria"],
    locationLabel: "Miami", radiusKm: 10, maxLeads: 100, language: "en-US", country: "US",
    status: "completed", settings: DEFAULT_SEARCH_SETTINGS, foundCount: 1, auditedCount: 1,
    createdAt: 0, updatedAt: 0, ...overrides,
  };
}

describe("Prospecção de leads", () => {
  it("mostra a busca configurável e valida o limite", async () => {
    invoke.mockImplementation((command: string) => {
      if (command === "lead_campaigns" || command === "lead_list") return Promise.resolve([]);
      if (command === "lead_stages") return Promise.resolve([]);
      if (command === "lead_score_weights") return Promise.resolve({noSite:30,brokenSite:28,weakSite:18,socialOnly:24,instagram:12,contact:10,reviews:6,distance:4});
      return Promise.resolve(undefined);
    });
    render(<LeadsTool settings={{} as never} addHistory={vi.fn()} />);
    expect(screen.getByRole("button", { name: /iniciar prospecção/i })).toBeEnabled();
    const max = screen.getByLabelText(/máximo de leads/i);
    await userEvent.clear(max);
    await userEvent.type(max, "999");
    expect(max).toHaveValue(500);
    await waitFor(() => expect(invoke).toHaveBeenCalledWith("lead_initialize"));
  });

  it("abre Resultados mesmo com um lead legado incompleto", async () => {
    invoke.mockImplementation((command: string) => {
      if (command === "lead_campaigns") return Promise.resolve([campaignFixture()]);
      if (command === "lead_list") return Promise.resolve([{ id: "legacy-1", name: "Legacy Bakery", campaignId: "camp-1" }]);
      if (command === "lead_stages") return Promise.resolve([]);
      if (command === "lead_score_weights") return Promise.resolve({noSite:30,brokenSite:28,weakSite:18,socialOnly:24,instagram:12,contact:10,reviews:6,distance:4});
      return Promise.resolve(undefined);
    });

    render(<LeadsTool settings={{} as never} addHistory={vi.fn()} />);
    await waitFor(() => expect(screen.getByRole("tab", { name: /resultados/i })).toHaveTextContent("1"));
    await userEvent.click(screen.getByRole("tab", { name: /resultados/i }));
    await userEvent.click(await screen.findByRole("heading", { name: /campanha teste/i }));
    await userEvent.click(screen.getByRole("button", { name: "Todos" }));

    expect(await screen.findByText("Legacy Bakery")).toBeVisible();
    expect(screen.getByText("Não auditado")).toBeVisible();
  });

  it("abre Resultados vazios sem inicializar o Leaflet", async () => {
    invoke.mockImplementation((command: string) => {
      if (command === "lead_campaigns") return Promise.resolve([campaignFixture({ foundCount: 0, auditedCount: 0 })]);
      if (command === "lead_list" || command === "lead_stages") return Promise.resolve([]);
      if (command === "lead_score_weights") return Promise.resolve({noSite:30,brokenSite:28,weakSite:18,socialOnly:24,instagram:12,contact:10,reviews:6,distance:4});
      return Promise.resolve(undefined);
    });

    render(<LeadsTool settings={{} as never} addHistory={vi.fn()} />);
    await userEvent.click(screen.getByRole("tab", { name: /resultados/i }));
    await userEvent.click(await screen.findByRole("heading", { name: /campanha teste/i }));

    expect(screen.getByLabelText("Minimapa dos leads")).toHaveTextContent("Os pins aparecem");
    expect(document.querySelector(".leaflet-container")).not.toBeInTheDocument();
  });

  it("aciona o comando nativo para abrir Site e Google Maps", async () => {
    invoke.mockImplementation((command: string) => {
      if (command === "lead_campaigns") return Promise.resolve([campaignFixture()]);
      if (command === "lead_stages") return Promise.resolve([]);
      if (command === "lead_list") return Promise.resolve([{id:"external-1",name:"Acme",campaignId:"camp-1",websiteStatus:"weak",websiteUrl:"acme.com",sourceUrls:["https://www.google.com/maps/place/Acme"],scoreReasons:[],auditFindings:[],tags:[]}]);
      if (command === "lead_score_weights") return Promise.resolve({noSite:30,brokenSite:28,weakSite:18,socialOnly:24,instagram:12,contact:10,reviews:6,distance:4});
      return Promise.resolve(undefined);
    });

    render(<LeadsTool settings={{} as never} addHistory={vi.fn()} />);
    await waitFor(() => expect(screen.getByRole("tab", { name: /resultados/i })).toHaveTextContent("1"));
    await userEvent.click(screen.getByRole("tab", { name: /resultados/i }));
    await userEvent.click(await screen.findByRole("heading", { name: /campanha teste/i }));
    await userEvent.click(await screen.findByRole("button", { name: "Site" }));
    expect(invoke).toHaveBeenCalledWith("open_external_url", {url:"https://acme.com/"});
    await userEvent.click(screen.getByRole("button", { name: /ver no maps/i }));
    expect(invoke).toHaveBeenCalledWith("open_external_url", {url:"https://www.google.com/maps/place/Acme"});
  });
});
