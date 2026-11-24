---
name: roads-api-web-api
description: Use this skill when working with the Google Maps Platform Roads API via HTTP REST requests. Activate this skill to snap GPS coordinates to the most likely road path, find the nearest road segments to specified coordinates, retrieve Google Place IDs for road segments, or query posted speed limits along a path or for specific road Place IDs.
license: Apache-2.0
metadata:
  version: 1.0.54
---

> [!IMPORTANT] **Core Dependency:** This skill requires active context from
> [google-maps-platform/SKILL.md](https://www.gstatic.com/googlemapsplatform-agent-skills/google-maps-platform/SKILL.md).

### Overview

The Roads API is a Google Maps Platform HTTP REST web service that maps GPS
coordinates to the road network and retrieves road metadata. Use this skill to
construct HTTP requests and handle responses for snapping coordinate paths to
road geometries, identifying the closest road segments to given
latitude/longitude coordinates, obtaining Google Place IDs for road segments,
and querying posted speed limits by coordinate path or Place ID.

## Primary Orchestration Integration Workflow

Follow this multi-phase sequential integration checklist to compose features
robustly. For each phase, read the referenced capability sub-workflow file and
satisfy its *Evidence Checkpoint* before advancing.

### Phase 1: Feature Layer & Custom Enrichment (Supplemental)

#### Feature Module: Routes (Optional - Use-Case Dependent)

-   [ ] **Returns a set of latitude/longitude coordinates that align with road
    segments and most closely match the path of a specified GPS trace using the
    Snap to Roads endpoint.** Read
    [references/return-set-latitudelongitude-coordinates-that-align-road-segments-and-most-closely-match-path-set-sp.md](https://www.gstatic.com/googlemapsplatform-agent-skills/roads-api-web-api/references/return-set-latitudelongitude-coordinates-that-align-road-segments-and-most-closely-match-path-set-sp.md).
    *Trigger Condition*: Use when the user wants to snap a sequence of GPS
    coordinates or a path to the most likely road segments they were traveling
    on, or wants to interpolate points to follow the geometry of a road.
    *Evidence Checkpoint*: HTTP GET request to
    `https://roads.googleapis.com/v1/snapToRoads` returns a 200 OK status with a
    `snappedPoints` array containing `location` (latitude and longitude) and
    `placeId` objects.
-   [ ] **Returns the latitude/longitude coordinates for the road segments
    closest to a set of discrete specified coordinates using the Nearest Roads
    endpoint.** Read
    [references/return-set-latitudelongitude-coordinates-road-segment-closest-set-specified-coordinates.md](https://www.gstatic.com/googlemapsplatform-agent-skills/roads-api-web-api/references/return-set-latitudelongitude-coordinates-road-segment-closest-set-specified-coordinates.md).
    *Trigger Condition*: Use when the user wants to find the closest road
    segment to one or more independent latitude/longitude coordinates without
    assuming they form a sequential path. *Evidence Checkpoint*: HTTP GET
    request to `https://roads.googleapis.com/v1/nearestRoads` returns a 200 OK
    status with a `snappedPoints` array containing `location` coordinates,
    `originalIndex`, and `placeId`.
-   [ ] **Returns the Google Place ID for the road segment closest to a given
    set of latitude/longitude coordinates.** Read
    [references/return-google-place-identifier-road-segment-closest-set-latitudelongitude-coordinates.md](https://www.gstatic.com/googlemapsplatform-agent-skills/roads-api-web-api/references/return-google-place-identifier-road-segment-closest-set-latitudelongitude-coordinates.md).
    *Trigger Condition*: Use when the user wants to retrieve the Google Place ID
    for the road segments closest to specified GPS coordinates (for example, to
    pass into the Places API or Speed Limits endpoint). *Evidence Checkpoint*:
    HTTP GET request to the Roads API (`nearestRoads` or `snapToRoads`) returns
    a 200 OK status with a `snappedPoints` array where each item includes a
    valid `placeId` string.
-   [ ] **Returns the posted speed limit for the road segments that most closely
    match a path of latitude/longitude coordinates.** Read
    [references/return-speed-limit-road-segment-that-most-closely-matches-path-set-latitudelongitude-coordinates.md](https://www.gstatic.com/googlemapsplatform-agent-skills/roads-api-web-api/references/return-speed-limit-road-segment-that-most-closely-matches-path-set-latitudelongitude-coordinates.md).
    *Trigger Condition*: Use when the user wants to determine the speed limits
    along a path of raw GPS coordinates (`path` parameter) without first having
    Place IDs. *Evidence Checkpoint*: HTTP GET request to
    `https://roads.googleapis.com/v1/speedLimits` with the `path` parameter
    returns a 200 OK status containing both `speedLimits` (with `placeId`,
    `speedLimit`, and `units`) and `snappedPoints` arrays.
-   [ ] **Returns the posted speed limit for road segments identified by one or
    more provided Google Place IDs.** Read
    [references/return-speed-limit-road-segment-provided-google-place-identifier.md](https://www.gstatic.com/googlemapsplatform-agent-skills/roads-api-web-api/references/return-speed-limit-road-segment-provided-google-place-identifier.md).
    *Dependencies*:
    `["references/return-google-place-identifier-road-segment-closest-set-latitudelongitude-coordinates.md"]` \
    *Trigger Condition*: Use when the user wants to query the speed limit of
    specific road segments using existing Google Place IDs (`placeId`
    parameter). *Evidence Checkpoint*: HTTP GET request to
    `https://roads.googleapis.com/v1/speedLimits` with `placeId` parameters
    returns a 200 OK status with a `speedLimits` array containing `placeId`,
    `speedLimit`, and `units`.
