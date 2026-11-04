# NextStep: draft submission answers

Prepared for the Meta Global AI Developer Hackathon. The signed-in form has not been provided, so these are reusable drafts rather than claims about its exact questions or limits. Adapt length to the actual fields. Check current release status before submitting.

## Project name

NextStep

## Short description

Discover real opportunities, understand their value for your experience, and turn a chosen opportunity into a preparation plan with progress you can keep.

## Problem

Students encounter courses, hackathons and community activities across scattered pages. A title or topic tag does not explain whether an opportunity offers something new, what a student needs to prepare, or whether its conditions apply. NextStep helps students move from collecting links to making an informed choice and taking concrete action, while preserving uncertainty about missing information.

## What the application does

Students discover source-backed opportunities, inspect published details, save interesting options and describe their goals and availability. They can import a CV or selected GitHub material, review source passages and confirm their actual contribution. Personalized comparisons explain potential value and remaining questions. For supported planning opportunities, students review an AI-generated preparation draft, explicitly accept it, and track tasks persisted through the backend in MySQL. Preparation progress, participation conditions and submission evidence remain separate.

## How Meta is used

Meta requests run through the ASP.NET Core backend. The application uses Meta for professional-source fact proposals, opportunity-specific comparisons, and structured preparation-action proposals. Imported material is untrusted evidence, and proposed facts require student confirmation. Generation uses the shared Meta client and a constrained structured-output/validation boundary; the server controls authoritative task identities, acceptance, versions and storage. Extraction permission, comparison consent and plan-generation acknowledgment are separate. The final integration's live-provider compatibility must be verified before claiming that final deployed build has passed a live end-to-end run.

## Technical approach

React, TypeScript and Tailwind CSS provide the responsive interface. ASP.NET Core handles authentication, profile and evidence management, source projections, planning, progress and version checks. MySQL is the authoritative application store. Source collection is separate from AI recommendations: discovery does not automatically make an organizer rule reviewed or a resource recommended. Provider credentials remain on the server.

## What makes it useful

NextStep connects a student's concrete contribution with an opportunity's actual outcomes. It avoids equating shared tags with mastery, an uploaded artifact with verified skill, or preparation-task completion with eligibility. It offers a reviewable draft and an actionable next step while letting students correct assumptions and retain their work.

## Current limitations

Source coverage is incomplete and depends on accessible organizer/community pages; the app does not claim unrestricted Facebook or Instagram search. Some deadlines and requirements remain unknown. Reviewed planning records are more limited than discovery listings. Model output can require clarification, and the final release needs its own live-provider, deployment and recovery validation. Do not claim all universities, all social posts, or all opportunities are collected automatically.

## Contributor credits

- Noor: application frontend and application/backend integration work.
- Rofi: shared Meta AI integration, structured generation policy and AI validation work.
- Confirm the final attribution and any additional contributors with the team before submitting.

## Links and fields still to fill

- Repository: https://github.com/NOOROWAISSI/meta-ai-hackathon-2026
- Exact reviewed submission branch/tag/commit: pending final integration.
- Three-minute demo video URL: pending recording/upload.
- Public hosted application URL: not confirmed; do not submit localhost as a public URL.
- Open-source license: MIT, approved by both contributors and included in the combined candidate. Confirm it is present on the final submitted revision and preserve third-party notices.
- Any form-specific track, required screenshots, additional answers, limits and team identifiers: confirm in the authenticated form.
