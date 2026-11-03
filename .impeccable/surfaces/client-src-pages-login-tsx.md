---
version: 1
slug: "client-src-pages-login-tsx"
primary_target: "client/src/pages/Login.tsx"
related_targets: []
---

## Scope and visitor mode

Redesign only the `/connexion` web screen. Operate surface: the visitor's immediate task is signing in or reaching the existing account-recovery form.

## Audience, task, content, and constraints

Agents de terrain, inspecteurs, responsables et administrateurs need a quick, legible route into NaviGarde IA. Preserve the existing French copy and all displayed sign-in, password visibility, remember-me, password recovery, Manus, and administrator-contact affordances. Keep current authentication behavior and existing validation.

## Direction and memorable moment

**L’avis civique côtier** — an assured public-service composition grounded in the project's maritime context. A real boat-inspection photograph anchors the left identity panel; the right remains a direct, compact form on a warm paper-like surface. Navy carries the brand, teal marks the active access step, and one restrained coral point makes that state distinguishable without relying on color alone. The memorable detail is the thin state rule that shifts its marker between sign-in and recovery.

## First viewport

At desktop sizes, the first view contains the brand, mission, four existing platform capabilities, full sign-in form, secondary Manus option, and administrator-contact text. The login panel is vertically centered and fits common laptop heights; short screens can scroll. At mobile sizes, hide the large image panel, retain a compact NaviGarde IA identity above the form, and allow natural page scrolling without horizontal overflow.

## Signature interaction

The state rule below the form heading moves its marker between sign-in and account-recovery mode. Keep the change subtle and respect reduced-motion preferences.

## Unresolved decisions

The Manus button and administrator-contact link have no implemented destination in the current screen; preserve their present behavior and presentation. Do not invent an integration, contact address, credentials, or security claims.

Seed reference: seed:a95cb039f2bd76fd
