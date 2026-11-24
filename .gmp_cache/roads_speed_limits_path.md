# Speed Limits

## Overview

The Roads API Speed Limit service returns the posted speed limit for given road
segments. When a road segment has variable speed limits or separate limits for
cars and trucks, the API returns the maximum posted speed limit for automobiles.

> **Important Licensing Notice:** The Speed Limit service is restricted to
> customers with an
> [Asset Tracking](https://cloud.google.com/maps-platform/asset-tracking)
> license or transitioned Google Maps Platform Premium Plan projects with Asset
> Tracking capabilities (`maps-asset-xxx`).

> **Note on Accuracy:** Speed limit data is not real-time and may be estimated,
> inaccurate, incomplete, or outdated. Always check
> [coverage details](https://developers.google.com/maps/coverage) for regional
> availability.

--------------------------------------------------------------------------------

## Endpoint & Request Structure

Send an HTTPS `GET` request to the `speedLimits` endpoint:

```http
GET https://roads.googleapis.com/v1/speedLimits?parameters&key=YOUR_API_KEY
```

### Headers

Include the Google Maps Platform usage attribution header in all REST requests:

Header                    | Value                    | Description
:------------------------ | :----------------------- | :----------
`X-Goog-Maps-Solution-ID` | `gmp_git_agentskills_v1` | Required usage attribution header for standard REST calls.

### Parameters

You must provide **either** a `path` parameter **or** one or more `placeId`
parameters, along with your API `key`.

Parameter | Requirement                | Type / Format      | Description
:-------- | :------------------------- | :----------------- | :----------
`path`    | Required (if no `placeId`) | `lat,lng\|lat,lng` | Up to 100 latitude/longitude pairs separated by pipes (`\|`). The API first snaps the path to the most likely road traveled by a vehicle (similar to `snapToRoads`), then determines the speed limit for the relevant segments.
`placeId` | Required (if no `path`)    | `string`           | Up to 100 Place IDs representing road segments. Pass multiple values by repeating the parameter (`placeId=ID1&placeId=ID2`). Does **not** perform road-snapping.
`key`     | **Required**               | `string`           | Your Google Maps Platform API key.
`units`   | Optional                   | `KPH` or `MPH`     | Unit of speed for the returned speed limits. Defaults to `KPH`.

> **Billing Caution:** Each entry returned in the `speedLimits` array of the
> response triggers the **SKU: Roads - Speed Limits**. Pass the minimum required
> number of input parameters to optimize costs.

--------------------------------------------------------------------------------

## Implementation Patterns

### 1. Requesting Speed Limits by Path (`path`)

Use `path` when you have sequential GPS breadcrumb coordinates along a route and
want the API to snap the path to the road network and return the corresponding
speed limits in a single call.

#### cURL Example

```bash
curl -X GET "https://roads.googleapis.com/v1/speedLimits?path=60.170880,24.942795|60.170879,24.942796|60.170877,24.942796&units=KPH&key=YOUR_API_KEY" \
  -H "X-Goog-Maps-Solution-ID: gmp_git_agentskills_v1"
```

#### JavaScript (`fetch`) Example

```javascript
async function getSpeedLimitsByPath(coordinates, apiKey, units = 'KPH') {
  const pathParam = coordinates.map(coord => `${coord.lat},${coord.lng}`).join('|');
  const url = new URL('https://roads.googleapis.com/v1/speedLimits');

  url.searchParams.append('path', pathParam);
  url.searchParams.append('units', units);
  url.searchParams.append('key', apiKey);

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'X-Goog-Maps-Solution-ID': 'gmp_git_agentskills_v1'
    }
  });

  if (!response.ok) {
    throw new Error(`Roads API error: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

// Example usage:
const path = [
  { lat: 38.75807927603043, lng: -9.03741754643809 },
  { lat: 38.6896537, lng: -9.1770515 },
  { lat: 41.1399289, lng: -8.6094075 }
];

getSpeedLimitsByPath(path, 'YOUR_API_KEY')
  .then(data => console.log(data))
  .catch(err => console.error(err));
```

--------------------------------------------------------------------------------

### 2. Requesting Speed Limits by Place ID (`placeId`)

Use `placeId` when you already have road segment Place IDs (retrieved via
`snapToRoads` or `nearestRoads`) or when querying speed limits for arbitrary,
non-sequential points where path snapping is inappropriate.

#### cURL Example

```bash
curl -X GET "https://roads.googleapis.com/v1/speedLimits?placeId=ChIJX12duJAwGQ0Ra0d4Oi4jOGE&placeId=ChIJLQcticc0GQ0RoiNZJVa5GxU&key=YOUR_API_KEY" \
  -H "X-Goog-Maps-Solution-ID: gmp_git_agentskills_v1"
```

#### JavaScript (`fetch`) Example

```javascript
async function getSpeedLimitsByPlaceIds(placeIds, apiKey, units = 'KPH') {
  const url = new URL('https://roads.googleapis.com/v1/speedLimits');

  placeIds.forEach(id => url.searchParams.append('placeId', id));
  url.searchParams.append('units', units);
  url.searchParams.append('key', apiKey);

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'X-Goog-Maps-Solution-ID': 'gmp_git_agentskills_v1'
    }
  });

  if (!response.ok) {
    throw new Error(`Roads API error: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}
```

--------------------------------------------------------------------------------

## Response Schema

A successful response returns a JSON object containing `speedLimits`, and
optionally `snappedPoints` and `warningMessage`.

```json
{
  "speedLimits": [
    {
      "placeId": "ChIJX12duJAwGQ0Ra0d4Oi4jOGE",
      "speedLimit": 105,
      "units": "KPH"
    },
    {
      "placeId": "ChIJLQcticc0GQ0RoiNZJVa5GxU",
      "speedLimit": 70,
      "units": "KPH"
    }
  ],
  "snappedPoints": [
    {
      "location": {
        "latitude": 38.75807927603043,
        "longitude": -9.037417546438084
      },
      "originalIndex": 0,
      "placeId": "ChIJX12duJAwGQ0Ra0d4Oi4jOGE"
    },
    {
      "location": {
        "latitude": 38.689653701836896,
        "longitude": -9.177051486847693
      },
      "originalIndex": 1,
      "placeId": "ChIJLQcticc0GQ0RoiNZJVa5GxU"
    }
  ],
  "warningMessage": "Input path is too sparse. You should provide a path where consecutive points are closer to each other. Refer to the 'path' parameter in Google Roads API documentation."
}
```

### Response Fields

*   **`speedLimits`** (Array): Road metadata elements.
    *   `placeId` (string): Unique identifier corresponding to the road segment.
    *   `speedLimit` (number): The maximum automobile speed limit for that
        segment.
    *   `units` (string): Either `KPH` or `MPH`.
*   **`snappedPoints`** (Array): Present **only** if the request included a
    `path` parameter.
    *   `location` (object): Contains `latitude` and `longitude` of the snapped
        point.
    *   `originalIndex` (integer): `0`-based index mapping the snapped point
        back to the coordinate in the original `path` request.
    *   `placeId` (string): The road segment Place ID.
*   **`warningMessage`** (string, optional): User-visible warning (e.g., if the
    input `path` points are too far apart for accurate road snapping).

--------------------------------------------------------------------------------

## Best Practices & Troubleshooting

1.  **Handling Sparse Coordinates:**
    *   If you pass arbitrary or widely separated points to the `path`
        parameter, the response will include a `warningMessage` stating `"Input
        path is too sparse..."`.
    *   For arbitrary/sparse points, **do not** pass `path` to `speedLimits`.
        Instead, pass the coordinates to the
        [`nearestRoads`](https://developers.google.com/maps/documentation/roads/nearest)
        endpoint first, extract the `placeId` values from that response, and
        pass those `placeId`s to `speedLimits`.
2.  **Missing Speed Limits in Response:**
    *   The most common cause of missing entries in `speedLimits` is supplying a
        `placeId` that represents a general POI, building, or structure (e.g., a
        bridge's overall Place ID) rather than an individual **road segment**.
    *   Always obtain road segment Place IDs via `snapToRoads` or `nearestRoads`
        requests.
3.  **Sampling & Batching Recommendations:**
    *   **Sampling Interval:** Sample moving asset locations at 5 to 15 minute
        intervals depending on travel speed. If an asset is stationary, a single
        location sample is sufficient.
    *   **Batching:** Accumulate coordinate samples and batch them into a single
        request (up to 100 points/Place IDs per call) rather than calling the
        API on every individual location update. This reduces both latency and
        quota consumption.
