# Universal Configurator V3.5.4

## Quote handoff stabilization
- Replaced dual session/local storage handoff with one cross-tab localStorage key.
- Standardized quote storage key as `universal-cpq-current-quote`.
- Removed premature quote-storage cleanup from the quote page.
- Corrected all application version metadata to 3.5.4.
- Preserved Save Configuration, Export Diagnostics, and Quote Engine behavior.

# V3.5.3

- Fixed quote handoff to new tabs opened with `noopener`.
- Quote data is now written to temporary localStorage with sessionStorage fallback.
- `quote.html` clears the temporary cross-tab quote payload after reading it.

# Universal Configurator V3.5.2

- Fixed circular quote/diagnostics calculation that disabled Save Configuration and Export Diagnostics.
- Quote building now uses the current normalized CPQ configuration without recalculating recursively.
- Preview Quote performs one explicit configuration calculation before building the quote.
- Updated application and data versions to 3.5.2.

# Universal Configurator V3.5.1

## Universal Quote & Document Engine Foundation

- Added normalized customer quote object.
- Added customer, salesperson, validity, notes, and terms fields.
- Added separate printable `quote.html`.
- Added Print / Save PDF workflow using the browser print engine.
- Added Documents tab to CPQ Inspector.
- Added quote snapshot to diagnostics export.
- Preserved all existing pricing, relationship, promotion, freight, dealer-rule, and finance engines.
- No live dealer settings or quote data are included.

## V3.5.1 metadata correction
- Corrected applicationVersion so the runtime badge no longer falls back to 3.4.0.
- Aligned active CPQ schema metadata at 1.9.
- Aligned data and architecture version metadata.
