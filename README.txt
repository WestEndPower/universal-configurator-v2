Universal Configurator V3.0.0 Modular Foundation

Install over the tested V2.17.2 project using VS Code Live Server.

V3.0.0 is a structural refactor only. Existing data files, dealer settings,
compatibility, pricing, rules, diagnostics, and saved configuration behavior
remain unchanged.

New source layout:
  src/app.js                  Existing tested application behavior
  src/core/platform.js        UniversalCPQ namespace and engine registry
  src/core/adapters.js        Stable access to core engines
  src/business/*.js           Data-driven business engine extension points

Dealer settings are not included and are never overwritten.
