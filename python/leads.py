"""Coleta experimental de leads com Playwright e auditoria comercial de sites.

Seletores de Google Maps e Instagram ficam deliberadamente isolados aqui. As
interfaces mudam com frequência; falhas em um card não interrompem a campanha.
"""

from __future__ import annotations

import asyncio
import hashlib
import math
import re
import time
from dataclasses import dataclass
from typing import Any, Callable
from urllib.parse import quote, urlparse

from playwright.async_api import BrowserContext, Page, TimeoutError as PlaywrightTimeout


DEFAULT_WEIGHTS = {
    "noSite": 30, "brokenSite": 28, "weakSite": 18, "socialOnly": 24,
    "instagram": 12, "contact": 10, "reviews": 6, "distance": 4,
}
SOCIAL_HOSTS = {"instagram.com", "facebook.com", "m.facebook.com", "tiktok.com", "x.com", "twitter.com", "linktr.ee", "beacons.ai", "wa.me"}


def _clean(text: str | None) -> str:
    return re.sub(r"\s+", " ", text or "").strip()


def _lead_id(campaign_id: str, name: str, address: str, phone: str) -> str:
    raw = "|".join((campaign_id, _clean(name).casefold(), _clean(address).casefold(), re.sub(r"\D", "", phone)))
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:32]


def _coords(url: str) -> tuple[float | None, float | None]:
    match = re.search(r"@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)", url)
    return (float(match.group(1)), float(match.group(2))) if match else (None, None)


def _distance_km(a: tuple[float, float], b: tuple[float, float]) -> float:
    lat1, lon1, lat2, lon2 = map(math.radians, (*a, *b))
    h = math.sin((lat2-lat1)/2)**2 + math.cos(lat1)*math.cos(lat2)*math.sin((lon2-lon1)/2)**2
    return 6371.0088 * 2 * math.asin(math.sqrt(h))


def _social_only(url: str) -> bool:
    try:
        return urlparse(url).netloc.lower().removeprefix("www.") in SOCIAL_HOSTS
    except ValueError:
        return False


async def _text(locator, timeout: int = 1200) -> str:
    try:
        return _clean(await locator.first.inner_text(timeout=timeout))
    except Exception:
        return ""


async def _attribute(locator, name: str, timeout: int = 1200) -> str:
    try:
        return _clean(await locator.first.get_attribute(name, timeout=timeout))
    except Exception:
        return ""


async def audit_website(context: BrowserContext, url: str, timeout_ms: int = 15000) -> dict[str, Any]:
    if not url:
        return {"status":"no_site","email":"","instagramUrl":"","findings":[{"code":"no_site","label":"Não possui site","severity":"critical"}]}
    if _social_only(url):
        return {"status":"social_only","email":"","instagramUrl":url if "instagram.com" in url else "","findings":[{"code":"social_only","label":"Possui apenas página em rede social","severity":"opportunity"}]}

    findings: list[dict[str, str]] = []
    console_errors: list[str] = []
    page = await context.new_page()
    page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)
    page.on("pageerror", lambda error: console_errors.append(str(error)))
    try:
        await page.set_viewport_size({"width":390,"height":844})
        started = time.perf_counter()
        response = await page.goto(url, wait_until="domcontentloaded", timeout=timeout_ms)
        load_ms = round((time.perf_counter() - started) * 1000)
        code = response.status if response else 0
        if code >= 400:
            return {"status":"broken","email":"","instagramUrl":"","findings":[{"code":"http_error","label":f"Servidor respondeu HTTP {code}","severity":"critical","value":str(code)}]}
        await page.wait_for_timeout(800)
        html = await page.content()
        text = _clean(await page.locator("body").inner_text(timeout=3000))
        if len(text) < 40:
            return {"status":"broken","email":"","instagramUrl":"","findings":[{"code":"blank_page","label":"Página vazia ou sem conteúdo útil","severity":"critical"}]}
        if not page.url.startswith("https://"):
            findings.append({"code":"no_https","label":"Site sem HTTPS","severity":"opportunity"})
        if load_ms > 5000:
            findings.append({"code":"slow_load","label":f"Carregamento inicial lento ({load_ms / 1000:.1f}s)","severity":"opportunity","value":str(load_ms)})
        if not await page.locator('meta[name="viewport"]').count():
            findings.append({"code":"no_viewport","label":"Sem configuração para celular","severity":"opportunity"})
        if await page.evaluate("document.documentElement.scrollWidth > window.innerWidth + 8"):
            findings.append({"code":"mobile_overflow","label":"Conteúdo estoura a largura no celular","severity":"opportunity"})
        title = _clean(await page.title())
        description = await _attribute(page.locator('meta[name="description"]'), "content")
        if not title or len(title) < 8:
            findings.append({"code":"weak_title","label":"Título da página ausente ou genérico","severity":"opportunity"})
        if not description:
            findings.append({"code":"no_description","label":"Sem descrição para Google/SEO local","severity":"opportunity"})
        if not await page.locator("form").count() and not re.search(r"contact|contato|quote|budget|orçamento", text, re.I):
            findings.append({"code":"no_cta","label":"Sem formulário ou chamada clara para contato","severity":"opportunity"})
        if not re.search(r"(?:\+?\d[\d\s().-]{7,}\d)|whatsapp|call us|ligue|telefone", text, re.I):
            findings.append({"code":"no_phone","label":"Telefone ou WhatsApp não está visível","severity":"opportunity"})
        year_matches = [int(x) for x in re.findall(r"(?:©|copyright)\s*(20\d{2})", text, re.I)]
        if year_matches and max(year_matches) < time.gmtime().tm_year - 2:
            findings.append({"code":"old_copyright","label":"Rodapé parece desatualizado","severity":"opportunity","value":str(max(year_matches))})
        email_match = re.search(r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}", text)
        instagram = ""
        for href in await page.locator('a[href*="instagram.com/"]').evaluate_all("els => els.map(e => e.href)"):
            if href: instagram = href; break
        if len(html) > 1_500_000:
            findings.append({"code":"heavy_html","label":"Página inicial muito pesada","severity":"opportunity"})
        broken_images = await page.locator("img").evaluate_all("imgs => imgs.filter(img => img.complete && img.naturalWidth === 0).length")
        if broken_images:
            findings.append({"code":"broken_images","label":f"{broken_images} imagem(ns) quebrada(s)","severity":"opportunity","value":str(broken_images)})
        if console_errors:
            findings.append({"code":"js_errors","label":"Erros de JavaScript detectados","severity":"opportunity","value":str(len(console_errors))})
        return {"status":"weak" if findings else "healthy","email":email_match.group(0) if email_match else "","instagramUrl":instagram,"findings":findings}
    except PlaywrightTimeout:
        return {"status":"broken","email":"","instagramUrl":"","findings":[{"code":"timeout","label":"Site excedeu o tempo limite","severity":"critical"}]}
    except Exception as exc:
        return {"status":"broken","email":"","instagramUrl":"","findings":[{"code":"network_error","label":"Falha ao abrir o site","severity":"critical","value":type(exc).__name__}]}
    finally:
        await page.close()


def score_lead(lead: dict[str, Any], weights: dict[str, float], radius_km: float) -> tuple[int, list[str]]:
    points = 0.0
    reasons: list[str] = []
    status_key = {"no_site":"noSite", "broken":"brokenSite", "weak":"weakSite", "social_only":"socialOnly"}.get(lead.get("websiteStatus"))
    if status_key:
        points += float(weights.get(status_key, 0)); reasons.append(f"Oportunidade de site: +{weights.get(status_key, 0)}")
    for finding in (lead.get("auditFindings") or [])[:3]:
        if finding.get("label"): reasons.append(str(finding["label"]))
    if lead.get("instagramUrl"):
        points += float(weights.get("instagram", 0)); reasons.append(f"Instagram encontrado: +{weights.get('instagram', 0)}")
    if lead.get("phone") or lead.get("email") or lead.get("whatsapp"):
        points += float(weights.get("contact", 0)); reasons.append(f"Contato disponível: +{weights.get('contact', 0)}")
    reviews = int(lead.get("reviewCount") or 0)
    if reviews >= 10:
        bonus = float(weights.get("reviews", 0)) * min(1, math.log10(reviews + 1) / 3)
        points += bonus; reasons.append(f"Prova social: +{round(bonus)}")
    distance = lead.get("distanceKm")
    if distance is not None and radius_km > 0:
        bonus = float(weights.get("distance", 0)) * max(0, 1 - float(distance) / radius_km)
        points += bonus
    total = max(1.0, sum(max(0.0, float(v)) for v in weights.values()))
    return min(100, round(points / total * 100)), reasons


def shortlist_candidates(candidates: list[dict[str, Any]], max_leads: int, focus: str) -> list[dict[str, Any]]:
    if focus == "all":
        return candidates[:max_leads]
    without_site = [item for item in candidates if not item.get("websiteUrl") or _social_only(str(item.get("websiteUrl")))]
    with_site = [item for item in candidates if item not in without_site]
    if focus == "balanced":
        no_site_limit = math.ceil(max_leads * 0.7)
        return [*without_site[:no_site_limit], *with_site[:max_leads]]
    return [*without_site[:max_leads], *with_site[:max_leads]]


def rank_opportunities(leads: list[dict[str, Any]], max_leads: int, focus: str) -> list[dict[str, Any]]:
    if focus == "all":
        return sorted(leads, key=lambda lead: -int(lead.get("score") or 0))[:max_leads]
    order = {"no_site":0,"social_only":1,"broken":2,"weak":3,"unknown":4,"healthy":5}
    return sorted(leads, key=lambda lead: (order.get(str(lead.get("websiteStatus")), 4), -int(lead.get("score") or 0)))[:max_leads]


async def _dismiss_google_consent(page: Page) -> None:
    for label in ("Accept all", "Aceitar tudo", "Reject all", "Rejeitar tudo"):
        try:
            button = page.get_by_role("button", name=label)
            if await button.count(): await button.first.click(timeout=1000); return
        except Exception:
            pass


async def _maps_links(page: Page, query: str, location: str, max_items: int, pace_ms: int) -> tuple[list[str], tuple[float | None, float | None]]:
    await page.goto(f"https://www.google.com/maps/search/{quote(query + ' near ' + location)}", wait_until="domcontentloaded", timeout=30000)
    await _dismiss_google_consent(page)
    await page.wait_for_timeout(2500)
    center = _coords(page.url)
    feed = page.locator('[role="feed"]')
    stagnant = 0
    last_count = 0
    for _ in range(35):
        anchors = page.locator('a[href*="/maps/place/"]')
        count = await anchors.count()
        if count >= max_items: break
        stagnant = stagnant + 1 if count == last_count else 0
        if stagnant >= 4: break
        last_count = count
        try:
            if await feed.count(): await feed.evaluate("el => el.scrollTo(0, el.scrollHeight)")
            else: await page.mouse.wheel(0, 4500)
        except Exception:
            pass
        await page.wait_for_timeout(pace_ms)
    links = await page.locator('a[href*="/maps/place/"]').evaluate_all("els => [...new Set(els.map(e => e.href))]")
    return [x for x in links if x][:max_items], center


async def _map_detail(context: BrowserContext, url: str) -> dict[str, Any] | None:
    page = await context.new_page()
    try:
        await page.goto(url, wait_until="domcontentloaded", timeout=25000)
        await page.wait_for_timeout(1000)
        name = await _text(page.locator("h1")) or await _attribute(page.locator("h1"), "aria-label")
        if not name: return None
        body = _clean(await page.locator("body").inner_text(timeout=3000))
        address = await _attribute(page.locator('[data-item-id="address"]'), "aria-label")
        phone = await _attribute(page.locator('[data-item-id^="phone"]'), "aria-label")
        website = await _attribute(page.locator('a[data-item-id="authority"]'), "href")
        category = await _text(page.locator('button[jsaction*="category"]'))
        rating_text = await _attribute(page.locator('[role="img"][aria-label*="star"], [role="img"][aria-label*="estrela"]'), "aria-label")
        rating_match = re.search(r"(\d+[.,]\d+)", rating_text)
        review_match = re.search(r"([\d,.]+)\s+(?:reviews|avaliações)", body, re.I)
        lat, lng = _coords(page.url)
        return {"name":name,"category":category,"address":address.removeprefix("Address: ").removeprefix("Endereço: "),"phone":phone.removeprefix("Phone: ").removeprefix("Telefone: "),"websiteUrl":website,"rating":float(rating_match.group(1).replace(",",".")) if rating_match else None,"reviewCount":int(re.sub(r"\D","",review_match.group(1))) if review_match else None,"latitude":lat,"longitude":lng,"sourceUrls":[url],"sources":["google_maps"]}
    except Exception:
        return None
    finally:
        await page.close()


async def _instagram_candidates(context: BrowserContext, query: str, action: Callable[[dict], None], max_items: int = 20) -> list[dict[str, str]]:
    page = context.pages[0] if context.pages else await context.new_page()
    await page.goto("https://www.instagram.com/", wait_until="domcontentloaded", timeout=30000)
    if "accounts/login" in page.url:
        action({"type":"action_required","source":"instagram","message":"Faça login no Instagram na janela do Edge para continuar."})
        try: await page.wait_for_url(re.compile(r"instagram\.com/(?!accounts/login)"), timeout=180000)
        except PlaywrightTimeout: return []
    try:
        search = page.locator('input[placeholder*="Search"], input[placeholder*="Pesquisar"]')
        if not await search.count():
            await page.get_by_text(re.compile("Search|Pesquisar", re.I)).first.click(timeout=4000)
            search = page.locator('input[placeholder*="Search"], input[placeholder*="Pesquisar"]')
        await search.first.fill(query)
        await page.wait_for_timeout(2500)
        hrefs = await page.locator('a[href^="/"]').evaluate_all("els => [...new Set(els.map(e => e.getAttribute('href')))]")
        result = []
        ignored = {"explore","accounts","direct","reels","stories","about"}
        for href in hrefs:
            parts = [x for x in (href or "").split("/") if x]
            if len(parts) == 1 and parts[0] not in ignored:
                result.append({"instagramHandle":parts[0],"instagramUrl":f"https://www.instagram.com/{parts[0]}/"})
            if len(result) >= max_items: break
        return result
    except Exception:
        return []


async def search_leads(data: dict[str, Any], event: Callable[[dict], None], step: Callable[[str], None], progress: Callable[[int], None]) -> dict[str, Any]:
    from playwright.async_api import async_playwright

    campaign_id = str(data.get("campaignId") or "")
    niches = [str(x).strip() for x in data.get("niches") or [] if str(x).strip()]
    location = str(data.get("location") or "").strip()
    radius_km = max(0.1, min(50.0, float(data.get("radiusKm") or 10)))
    max_leads = max(1, min(500, int(data.get("maxLeads") or 100)))
    opportunity_focus = str(data.get("opportunityFocus") or "no_site_first")
    pool_limit = max_leads if opportunity_focus == "all" else min(500, max_leads * 3)
    source = data.get("source") or "google_maps"
    pace_ms = {"slow":1800,"balanced":1000,"fast":500}.get(data.get("pace"), 1000)
    weights = {**DEFAULT_WEIGHTS, **(data.get("scoreWeights") or {})}
    if not campaign_id or not niches or not location:
        return {"success":False,"errorCode":"INVALID_INPUT","message":"Informe campanha, nicho e local."}

    found: list[dict[str, Any]] = []
    seen: set[str] = set()
    async with async_playwright() as p:
        browser = await p.chromium.launch(channel="msedge", headless=True)
        maps_context = await browser.new_context(locale=data.get("language") or "en-US")
        center: tuple[float | None, float | None] = (None, None)
        if source in ("google_maps", "both"):
            page = await maps_context.new_page()
            for niche_index, niche in enumerate(niches):
                step(f"Buscando {niche} em {location}")
                links, current_center = await _maps_links(page, niche, location, pool_limit - len(found), pace_ms)
                if center == (None, None): center = current_center
                for link in links:
                    if len(found) >= pool_limit: break
                    detail = await _map_detail(maps_context, link)
                    if not detail: continue
                    key = _clean(detail["name"]).casefold() + "|" + _clean(detail.get("address")).casefold()
                    if key in seen: continue
                    seen.add(key)
                    lat, lng = detail.get("latitude"), detail.get("longitude")
                    if all(x is not None for x in (*center, lat, lng)):
                        detail["distanceKm"] = round(_distance_km((center[0],center[1]),(lat,lng)), 2)
                        if detail["distanceKm"] > radius_km: continue
                    found.append(detail)
                    event({"type":"lead","lead":detail,"index":len(found)})
                    progress(min(70, round(len(found) / max_leads * 70)))
                progress(min(70, round((niche_index + 1) / len(niches) * 70)))
            await page.close()
            found = shortlist_candidates(found, max_leads, opportunity_focus)

        instagram_context = None
        if source in ("instagram", "both"):
            await browser.close()
            profile = str(data.get("instagramProfileDir") or "").strip()
            instagram_context = await p.chromium.launch_persistent_context(profile, channel="msedge", headless=False, viewport={"width":1100,"height":760})
            # No modo combinado, primeiro enriquece os leads do Maps. Limite de
            # 30 consultas por rodada evita transformar 100 empresas em uma
            # rajada de 100 buscas seguidas no Instagram.
            if source == "both":
                for index, lead in enumerate(found[:30]):
                    if lead.get("instagramUrl"): continue
                    candidates = await _instagram_candidates(instagram_context, f"{lead['name']} {location}", event, 3)
                    if candidates:
                        lead.update(candidates[0])
                        lead["sources"] = list(dict.fromkeys([*lead.get("sources", []), "instagram"]))
                        lead["sourceUrls"] = list(dict.fromkeys([*lead.get("sourceUrls", []), candidates[0]["instagramUrl"]]))
                    progress(70 + round((index + 1) / max(1, min(30, len(found))) * 8))
            # Uma campanha só de Instagram é a busca independente. O modo
            # combinado preserva espaço para os leads do Maps e seu enrichment.
            if source == "instagram":
                for niche in niches:
                    for item in await _instagram_candidates(instagram_context, f"{niche} {location}", event, max_leads-len(found)):
                        key = item["instagramHandle"].casefold()
                        if key in seen: continue
                        seen.add(key)
                        found.append({"name":item["instagramHandle"],"category":niche,"address":location,"websiteUrl":"","websiteStatus":"no_site","sourceUrls":[item["instagramUrl"]],"sources":["instagram"],**item})
                        if len(found) >= max_leads: break

        step("Auditando sites e calculando prioridades")
        audit_context = instagram_context or maps_context
        for index, lead in enumerate(found):
            if data.get("auditWebsites", True):
                audit = await audit_website(audit_context, lead.get("websiteUrl") or "")
                lead["websiteStatus"] = audit["status"]
                lead["auditFindings"] = audit["findings"]
                lead["email"] = audit.get("email", "")
                if not lead.get("instagramUrl"): lead["instagramUrl"] = audit.get("instagramUrl", "")
            lead.setdefault("websiteStatus", "unknown")
            lead.setdefault("instagramHandle", "")
            lead.setdefault("instagramUrl", "")
            lead.setdefault("email", "")
            lead.setdefault("whatsapp", "")
            lead.setdefault("phone", "")
            lead["campaignId"] = campaign_id
            lead["id"] = _lead_id(campaign_id, lead["name"], lead.get("address", ""), lead.get("phone", ""))
            lead["stageId"] = "new"
            lead["notes"] = ""
            lead["tags"] = []
            lead["country"] = data.get("country") or ""
            lead["createdAt"] = lead["updatedAt"] = int(time.time() * 1000)
            lead["score"], lead["scoreReasons"] = score_lead(lead, weights, radius_km)
            progress(70 + round((index + 1) / max(1,len(found)) * 30))
        found = rank_opportunities(found, max_leads, opportunity_focus)
        for index, lead in enumerate(found):
            event({"type":"audited","lead":lead,"index":index+1})
        if instagram_context: await instagram_context.close()
        else: await browser.close()
    return {"success":True,"campaignId":campaign_id,"found":len(found),"audited":len(found),"center":{"latitude":center[0],"longitude":center[1]},"leads":found}
