# Universal Configurator V2

## V2.13
- Added automatic package builder quantities
- Added per-component quantity controls
- Added relationship minimum and maximum quantity enforcement
- Added locked quantities for fixed required/included package items
- Added quantity-aware component totals and invoice lines


## V2.12
- Added universal relationship engine
- Added Requires, Included, Recommended, Optional relationship types
- Added default-selected and required relationship behavior
- Added quantity limits to relationship data
- Added relationship labels on components
- Added data/relationships.csv


## V2.11
- Added separate batteries.csv and chargers.csv
- Merged battery and charger data into the universal component engine
- Added system-based compatibility for batteries and chargers
- Added battery Ah/Wh and charger output display


## V2.10
- Added universal compatibility engine
- Added exact product matching
- Added SKU, category, system, and series matching
- Added explicit include and exclude rules
- Added compatibility notes in the configuration screen
- Added data/compatibility.csv

## V2.09
- Added compact invoice-style configuration view

## Version 2.0.14

- Fixed universal compatibility fallback so components with a populated `System` must match the selected product `System` unless an explicit compatibility rule or relationship includes them.
- A-System products now exclude B-System batteries and chargers through data values rather than hard-coded system names.
- Updated Current Configuration to resolve components from the unified component collection (`components`, `batteries`, and `chargers`).
- Current Configuration now groups selected components by component type and displays component name, SKU, and total quantity instead of raw component IDs.
- Component quantities in Current Configuration reflect component quantity multiplied by configured product quantity.
- Dealer and brand configuration files remain untouched.

## Version 2.0.14.1

- Made active product relationship rows the authoritative allowed-component list.
- Removed the render fallback that could display unrelated batteries or chargers.
- Preserved universal compatibility fallback only for legacy products with no relationship rows.
- Kept all filtering brand agnostic and data driven.

## Version 2.0.14.2

- Displayed grouped component names, SKUs, and total quantities in Current Configuration.
- Added the same grouped component detail to configured product rows so saved selections are visible immediately.
- Reused the universal component collection across batteries, chargers, and other component sources.
- Preserved compact invoice styling and the existing V2 architecture.

## V2.15.0

- Added the Universal Configuration Object (`appState.configuration`).
- Added `calculateConfiguration()` as the shared pricing and totals path.
- Normalized each configured product into product, component, and line totals.
- Added product subtotal and component subtotal to the CPQ data object.
- Updated Current Configuration to render from the normalized CPQ object.
- Preserved CSV-driven relationships, compatibility filtering, and quantity multiplication.
- No dealer-specific or brand-specific pricing logic added.


## V2.15.1
- Fixed `item is not defined` during product-list rendering.
- Restored product-name rendering with `product.ProductName`.

## Version 2.0.15.2

- Added developer diagnostics panel.
- Added live normalized CPQ object inspection.
- Added loaded row and relationship counts.
- Added session-only round-number test pricing.
- Round test values: product $1,000, battery $100, charger $10, other component $1.
- Test mode does not change dealer files or CSV data.

## V2.16.0
- Added normalized Universal Pricing Engine foundation.
- Added shared `priceLine()` calculation helper.
- Added auditable pricing trace to the CPQ configuration object.
- Added readable Calculation Trace to Developer Diagnostics.
- Added reserved freight, promotion, and tax totals without changing current prices.
- Updated CPQ configuration schema to 1.1.
- Preserved relationship filtering, component grouping, and dealer settings.
