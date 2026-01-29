# Salesman Visit Tracking System – Spec vs Implementation

## Live Map View

| Requirement                            | Implementation                                                                          |
| -------------------------------------- | --------------------------------------------------------------------------------------- |
| Salesman current location on map       | `userLocation` from GPS; blue/green marker on map (GoogleMapView).                      |
| Each visit (Task/Customer) pin visible | Visit targets as orange (pending) / grey (completed) markers; route line connects them. |

## Start Tracking Button

| Requirement                           | Implementation                                                                                                                                   |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Route A → B from salesman location    | Route: **user location → visit 1 → visit 2** (Directions API).                                                                                   |
| Multiple visits = A → B → C connected | `routeToVisitTarget` with `from`, `to`, `waypoints`; single continuous orange line.                                                              |
| Order                                 | **Nearest visit first** (distance from user), then next. **Today’s visits** in list and route are ordered by distance (sabse kareeb wala pehle). |
| Start meter                           | **Camera**, **Upload document**, or **Manual entry** (any one option).                                                                           |

## Visit Proof (Meter / Image Upload)

| Requirement                 | Implementation                                                                                                     |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Start** – starting meter  | Start Tracking: starting km via **Camera**, **Upload document**, or **Manual entry**; saved with tracking session. |
| **Per visit** – visit proof | Each visit complete: **visited area picture** required; then next (nearest) visit.                                 |
| **End** – ending meter      | **Last visit** ke baad (Shift End): ending km + **ending meter image**; then tracking stop.                        |

## Tracking Controls

| Requirement                              | Implementation                                                                                                   |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **Pause** = data stop, session not ended | `isTracking = false`; route to next visit **stays visible**; no new location updates.                            |
| **Resume**                               | Start Tracking again → tracking continues; route to remaining visits.                                            |
| **Stop** only after visit complete       | “Pause” opens **Completion** modal; **Complete Tracking** / **Shift End** after all visits + ending meter image. |

## Route Completion Logic

| Requirement                          | Implementation                                                                     |
| ------------------------------------ | ---------------------------------------------------------------------------------- |
| Task B complete → route A → B traced | Visit marked **Completed**; route to next visit shown (or shift end if none left). |
| Ending image upload → tracking stop  | Shift End: ending meter image + km → `stopTracking`; session closed.               |
| Visit status = Completed             | `updateVisitTargetStatus(..., { status: 'Completed', visitedAreaImage, ... })`.    |

## Distance-based Logic

| Requirement                         | Implementation                                                                                                                 |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Salesman near visit → auto-detect   | Proximity check (~100 m): **“Visit Target Reached!”** notification.                                                            |
| System allows visit start when near | **Mark as Completed**: if within 100 m → “At visit location”; if far → “Not at visit location” warning (still allow complete). |

## Complete Journey Visualization

| Requirement                 | Implementation                                                                                |
| --------------------------- | --------------------------------------------------------------------------------------------- |
| Full journey on map         | **All visits** on map: orange = pending, **grey = completed**; user marker + route line.      |
| Start → Visits → End        | Route: user → visit 1 → visit 2; completed visits stay as grey pins.                          |
| Timeline + images per visit | Shift End modal: starting meter image, **visited area images per visit**, ending meter image. |

## Tech

- **Map**: Google Maps (Directions API, markers, polyline).
- **Flow**: Start (meter image optional) → Pause/Resume → Visit complete (visited area image) → … → Shift End (ending meter image) → Stop.
- **History**: Visit targets with status, images, km; tracking session with start/end km and images.
