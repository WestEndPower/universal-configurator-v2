Universal Configurator V2.16.0 Update

Install over V2.15.2. Replace only the included files.
Dealer settings, dealer branding, and saved quote data are not included and are never overwritten.

Added Universal Pricing Engine foundation:
- One normalized priceLine() calculation path
- One calculateConfiguration() source for saved configuration totals
- Product and component subtotals
- Reserved freight, promotions, and tax totals
- Configuration schema version 1.1

Added Calculation Trace to Developer Diagnostics:
- Each product and component line
- Quantity x unit price = line amount
- Product subtotal
- Component subtotal
- Freight, promotions, and tax placeholders
- Final total

Round Test Mode remains session-only and does not edit CSV files.
