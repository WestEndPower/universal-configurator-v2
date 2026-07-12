# Universal Configurator V3.0.0

## Modular architecture foundation
- Moved the tested application JavaScript out of `index.html` into `src/app.js`.
- Added the global `UniversalCPQ` platform namespace.
- Added a shared engine registry for future independent modules.
- Added non-destructive extension modules for dealer rules, promotions, freight, financing, and tax.
- Added stable core adapters for configuration, rules, and diagnostics.
- Preserved V2.17.2 behavior and all existing CSV/JSON data contracts.
- Dealer settings and dealer-specific files are not included or modified.
