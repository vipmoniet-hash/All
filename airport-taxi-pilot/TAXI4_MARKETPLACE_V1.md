# VanClick Taxi 1–4 Marketplace V1

## Isolation

This implementation is intentionally isolated from the current VanClick / OneClick 5–6 passenger production system.

- Git branch: `taxi4-marketplace-v1`
- Dev service: `vanclick-taxi4-marketplace-dev`
- No production domain routing, production dispatch code, production database, or 5–6 passenger workflow is modified by this branch.

## Operating model

Taxi 1–4 is a driver marketplace, not a dispatcher-assignment system.

1. A client creates a valid airport-transfer booking.
2. The final fare and provisional VanClick commission are calculated immediately.
3. The ride enters `awaiting_dispatch` and is visible only to Admin/Dispatcher.
4. Admin or Dispatcher reviews the ride and explicitly publishes it to the common driver pool.
5. Only after publication do verified active drivers see the ride without private customer details.
6. A driver claims the ride.
7. Claim is atomic: one ride can have one winning driver only.
8. Commission is debited only from an ordinary winning driver's prepaid wallet.
9. Admin and Dispatcher management actions never create a commission debit.
10. Private customer/contact/address data is revealed only to the winning driver.
11. Driver uses the minimal lifecycle: claim → en route → completed.
12. Admin/Dispatcher manage intake, publication and exceptions rather than manually assigning routine rides.

## Commission

`commissionForFare(fare)`:

- 1–99 ₪ → 5 ₪
- 100–199 ₪ → 10 ₪
- 200–299 ₪ → 20 ₪
- 300–399 ₪ → 30 ₪
- every additional full 100 ₪ adds 10 ₪.

The driver sees fare, commission, and driver net before claiming.

Commission ledger behavior:

- claim → `commission_debit`
- allowed driver cancellation ≥2h → commission refund
- client/dispatcher cancellation can refund commission
- dispatcher can deliberately release a driver with or without refund
- net VanClick commission = debits − refunds.

## Fare time rules

Peak surcharge:

- 07:00–09:30 inclusive: +5%
- 14:00–18:00 inclusive: +5%

Commercial Shabbat rule:

- Friday from 16:00 inclusive: +15%
- Saturday through 20:00 inclusive: +15%
- Saturday 20:01 onward: normal non-Shabbat pricing.

Peak and Shabbat are additive. A trip in both windows is +20%.

Final fare is rounded upward to the nearest 5 ₪.

## Driver schedule protection

Before wallet debit, the server checks whether the driver already owns an active ride whose busy window overlaps the target ride.

Busy window:

- 30 minutes before pickup
- estimated trip duration based on road distance
- 20 minutes post-trip buffer.

A blocked ride remains visible but is marked `canClaim:false` with `claimBlockReason:'schedule_conflict'`.

## Idempotency and claim race

A repeated claim by the same already-winning driver returns the existing assignment and never debits commission twice.

Concurrent claims by different drivers are serialized in the current single-instance persistence layer. The regression suite races 12 drivers against one ride and requires:

- exactly one winner
- exactly one assigned driver
- exactly one commission debit
- exactly one wallet reduction.

Horizontal multi-instance deployment must use a shared transactional database before increasing Render instance count above 1.

## Cancellation rules

Client self-cancel and driver self-cancel are allowed when at least 120 minutes remain before pickup.

Driver self-cancel:

- returns ride to pool
- refunds commission
- increments `selfCancelledTrips`
- does not automatically fine or suspend the driver.

Late cancellation requires dispatcher intervention.

No automatic no-show monetary penalty is invented in V1. A no-show is reported as an operational issue and resolved by dispatch according to business policy.

## Exception workflow

Driver can report:

- `client_unreachable`
- `customer_not_ready`
- `client_no_show`
- `flight_delay`
- `pickup_problem`
- `vehicle_problem`
- `other`

An open issue appears in dispatch attention. Dispatcher resolves it with a resolution note.

Additional automatic attention items:

- `unclaimed_soon`: pool ride ≤90 minutes before pickup
- `unclaimed_overdue`: unclaimed ride after pickup time
- `driver_not_enroute`: assigned driver has not marked en route within 30 minutes of pickup.

## Ride state machine

Normal path:

`pool → assigned → driver_enroute → completed`

A driver cannot mark a ride completed before `driver_enroute`.

`awaiting_dispatch` is the normal intake state for every new Taxi 1–4 booking. A ride moves to `pool` only after explicit Admin/Dispatcher publication.

## Driver UX

Driver UI is optimized for high-volume mobile operation:

- available / mine / wallet / history
- filters: all, next 2 hours, today, later
- fare / commission / driver net visible on each offer
- disabled claim explains wallet or schedule block
- one-tap claim
- en-route and complete actions
- compact issue reporting
- wallet top-up requests
- completed fare, driver net, net commission paid, cancellation statistics
- visible customer data only after assignment
- 12-second foreground refresh.

## Dispatch UX

Dispatch is exception-first:

- attention queue before routine orders
- pool / active / completed counts
- net commission collected
- pending wallet top-ups
- driver verification / activation
- driver PIN rotation
- explicit release with refund or without refund
- issue resolution
- operational event log
- 10-second foreground refresh.

Dispatcher does not normally choose a driver.

## Authentication

The code supports `MARKETPLACE_AUTH_REQUIRED=1`.

When enabled:

- Admin and Dispatcher are separate privileged roles with their own PINs/sessions
- both privileged roles can manage the full Taxi 1–4 operational console
- each driver has a hashed PIN
- driver can log in by phone or driver ID
- only a token hash is stored server-side
- sessions expire after 24 hours
- driver token is scoped to its own driver ID
- driver token cannot access dispatch
- driver cannot impersonate another driver
- logout invalidates the token.

Driver PINs use scrypt with an individual random salt. Browser tokens are stored in `sessionStorage`, not permanent local storage.

The isolated dev service can leave auth disabled for review. Production integration must enable auth and configure a private dispatcher PIN.

## Data and deployment boundary

The isolated dev build deliberately uses the prototype file persistence adapter and one Render instance.

Before production integration:

1. connect the marketplace service layer to durable transactional storage (existing VanClick database or a dedicated database);
2. enable mandatory authentication;
3. configure backups/retention;
4. keep the 1–4 operational UI separate from the existing 5–6 dispatch UI;
5. route both products under the same VanClick brand/domain only after acceptance testing;
6. never merge the dev `db.json` into production data.

## Regression gates

Every isolated build currently checks:

- 1,354-location fare audit
- commission schedule
- peak boundaries
- Friday 16:00 / Saturday 20:00 Shabbat boundaries
- staff-only intake before driver-pool publication
- idempotent claim
- schedule conflict protection
- exception workflow
- strict en-route → completed state
- commission debit/refund accounting
- cancellation statistics
- clean test-state reset
- driver/dispatch/client UI markers and syntax
- real HTTP booking/claim/issue/tracking flow
- 12-driver concurrent claim race
- role-isolated auth E2E.

A failed gate blocks the dev deploy.
