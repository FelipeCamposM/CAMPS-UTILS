from leads import _coords, _distance_km, _lead_id, _social_only, rank_opportunities, score_lead, shortlist_candidates


def test_coords_google_maps_url():
    assert _coords("https://google.com/maps/place/x/@25.7617,-80.1918,13z") == (25.7617, -80.1918)
    assert _coords("https://example.com") == (None, None)


def test_distance_is_geodesic():
    assert _distance_km((0, 0), (0, 1)) == pytest.approx(111.195, rel=0.001)


def test_stable_lead_id_normalizes_case_and_spacing():
    assert _lead_id("c1", " ACME  Dental ", "Main St", "+1 305-555") == _lead_id("c1", "acme dental", "main st", "1305555")


def test_social_only_hosts():
    assert _social_only("https://instagram.com/acme")
    assert _social_only("https://linktr.ee/acme")
    assert not _social_only("https://acme.com")


def test_score_is_bounded_and_explained():
    lead = {"websiteStatus":"no_site","instagramUrl":"https://instagram.com/acme","phone":"123","reviewCount":100,"distanceKm":1}
    weights = {"noSite":30,"brokenSite":28,"weakSite":18,"socialOnly":24,"instagram":12,"contact":10,"reviews":6,"distance":4}
    score, reasons = score_lead(lead, weights, 10)
    assert 0 < score <= 100
    assert any("Oportunidade" in reason for reason in reasons)


def test_shortlist_prioritizes_companies_without_site_and_keeps_sites_to_audit():
    candidates = [
        {"name":"Healthy candidate","websiteUrl":"https://healthy.example"},
        {"name":"No site","websiteUrl":""},
        {"name":"Social only","websiteUrl":"https://instagram.com/acme"},
        {"name":"Potential weak site","websiteUrl":"https://weak.example"},
    ]
    selected = shortlist_candidates(candidates, 3, "no_site_first")
    assert [item["name"] for item in selected[:2]] == ["No site", "Social only"]
    assert any(item["name"] == "Potential weak site" for item in selected)


def test_final_ranking_places_no_site_before_weak_and_healthy():
    leads = [
        {"name":"Healthy","websiteStatus":"healthy","score":90},
        {"name":"Weak","websiteStatus":"weak","score":60},
        {"name":"No site","websiteStatus":"no_site","score":50},
    ]
    ranked = rank_opportunities(leads, 3, "no_site_first")
    assert [lead["name"] for lead in ranked] == ["No site", "Weak", "Healthy"]


import pytest
