# Googol Vibe Public Release Plan

## Executive Summary

Public release of Googol Vibe as a free/donationware desktop productivity app. Landing page <60kb, self-serve GCP setup model, viral marketing via Product Hunt.

---

## Part 1: Google OAuth Strategy

### Current State
- App uses **sensitive scopes**: gmail.readonly, calendar.readonly, tasks
- App uses **restricted scope**: drive.readonly (triggers CASA audit requirement)
- Current model: Each user creates their own GCP project + OAuth credentials

### Recommendation: Self-Serve GCP Model (No Verification Needed)

**Why:**
1. `drive.readonly` is RESTRICTED - requires paid CASA security audit (~$15k-50k)
2. Verification takes 2-6 months
3. Current onboarding wizard already guides users through GCP setup
4. Users control their own data - privacy advantage

**User Flow:**
1. Download app
2. Create GCP project (free tier)
3. Enable APIs (5 clicks)
4. Download credentials.json
5. Place in ~/.googol-vibe/
6. App works

**Alternative (Future):** Remove Drive integration, use only sensitive scopes, submit for verification.

---

## Part 2: Landing Page Requirements

### Constraints
- **<60kb total** (HTML + CSS + images)
- Pure HTML/CSS, no JS frameworks
- Single page
- Mobile responsive
- Fast load (<1s)

### Content Structure

```
HEADER
├── Logo (SVG, ~2kb)
├── Tagline: "Your Google Workspace, unified"
└── Download buttons (macOS, Windows)

HERO
├── Screenshot/mockup (~20kb WebP)
├── 3-4 feature bullets
└── "Free & Open Source" badge

FEATURES (3 cards)
├── Unified Dashboard
├── AI Agent Ready (MCP)
└── Privacy-First (your data stays local)

SETUP STEPS (4 icons)
├── 1. Download
├── 2. Create GCP Project
├── 3. Add Credentials
└── 4. Connect

SUPPORT
├── Patreon donation link
├── GitHub star/sponsor
└── Product Hunt badge

FOOTER
├── ENTER Konsult link
├── Privacy Policy link
├── Contact email
└── © 2025
```

### Technical Stack
- Pure HTML5 + CSS3
- CSS variables for theming
- SVG icons (Lucide subset)
- Single WebP hero image
- No JavaScript (progressive enhancement only)

### Budget Breakdown
| Asset | Size |
|-------|------|
| HTML | ~8kb |
| CSS | ~12kb |
| Logo SVG | ~2kb |
| Icons SVG | ~4kb |
| Hero WebP | ~25kb |
| Favicon | ~2kb |
| **Total** | ~53kb |

---

## Part 3: Viral Marketing Strategy

### Product Hunt Launch
1. Create teaser page with email signup
2. Build hunter network (5-10 early users)
3. Schedule launch for Tuesday 12:01 AM PST
4. Prepare:
   - Tagline (60 chars)
   - Description (260 chars)
   - 5 gallery images
   - Maker comment

### Pre-Launch Poll/Survey
Add to landing page:
```
"Would you like Googol Vibe on Product Hunt?"
[ ] Yes, I'd hunt it!
[ ] Just want the download
[ Email signup ]
```

Use Formspree (already integrated for Vibe AI waitlist).

### Social Proof
- GitHub stars counter
- "Featured on Product Hunt" badge (post-launch)
- Twitter/X share button

---

## Part 4: Download & Setup Flow Audit

### Current Pain Points
1. GCP setup is 15+ steps
2. No visual guide (text-only)
3. Easy to miss API enablement
4. credentials.json naming confusion

### Improvements Needed
1. **Embedded video tutorial** (Guidde recording script exists)
2. **Visual step indicators** in onboarding wizard
3. **Automated API check** - detect if APIs not enabled
4. **credentials.json validator** - check format on drop

### Recommended User Journey
```
Landing Page → Download → Install → Launch
    ↓
Onboarding Wizard
    ↓
Step 1: Welcome (why GCP needed)
    ↓
Step 2: GCP Setup (video + text)
    ↓
Step 3: Drop credentials.json
    ↓
Step 4: OAuth consent (in-app browser)
    ↓
Step 5: Dashboard loads
```

---

## Part 5: Implementation Tasks

### Phase 1: Landing Page (Priority)
- [ ] Create `site/` folder structure
- [ ] Write index.html (<60kb)
- [ ] Design CSS (Swiss Nihilism)
- [ ] Create SVG logo/icons
- [ ] Compress hero image (WebP <25kb)
- [ ] Add Patreon link
- [ ] Add Product Hunt teaser poll
- [ ] Add ENTER Konsult contact

### Phase 2: Onboarding Improvements
- [ ] Embed Guidde video in wizard
- [ ] Add credentials.json format validation
- [ ] Improve error messages for missing APIs
- [ ] Add "copy to clipboard" for GCP commands

### Phase 3: Distribution
- [ ] Build macOS DMG (signed?)
- [ ] Build Windows NSIS installer
- [ ] Create GitHub Release
- [ ] Upload binaries to landing page CDN

### Phase 4: Launch
- [ ] Submit to Product Hunt
- [ ] Post on Twitter/X
- [ ] Post on Reddit (r/productivity, r/googleworkspace)
- [ ] Email beta testers

---

## Part 6: Legal & Compliance

### Required Pages
1. **Privacy Policy** - Data stays local, no telemetry by default
2. **Terms of Service** - Use at own risk, no warranty

### Contact Details
- **Company**: ENTER Konsult (CodeTonight Pty Ltd)
- **Website**: https://enterkonsult.com
- **Email**: dev@codetonight.co.za
- **Location**: South Africa

---

## Part 7: Questions for V>>

1. **Patreon**: Create new campaign or use existing?
2. **Domain**: Use subdomain (googolvibe.enterkonsult.com) or new domain?
3. **Signing**: Apple Developer account for notarisation?
4. **Video**: Record Guidde tutorial before or after landing page?
5. **Product Hunt**: Target launch date?

---

## Sources

- [Sensitive Scope Verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification)
- [Restricted Scope Verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification)
- [OAuth Verification Help](https://support.google.com/cloud/answer/13463073)
