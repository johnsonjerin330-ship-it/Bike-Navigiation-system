# Return the Speed Limit for a Place ID

This capability retrieves the posted speed limit for one or more road segments
identified by their Google Place IDs using the Roads API.

> **Important Licensing Notice:** The Speed Limit service is only available to
> customers with an
> [Asset Tracking](https://cloud.google.com/maps-platform/asset-tracking)
> license, or legacy Google Maps Platform Premium Plan customers who
> transitioned to pay-as-you-go pricing with Asset Tracking capabilities active
> (projects with an ID in the format `maps-asset-xxx`).

## Prerequisites

1.  **Google Maps Platform API Key**: You must have a valid API key with the
    **Roads API** enabled.
2.  **Asset Tracking License**: Your project must be provisioned for Asset
    Tracking to call the `speedLimits` endpoint.
3.  **Road Segment Place IDs**: Each `placeId` provided **must** correspond
    directly to a road segment (not a building, bridge structure, or general
    point of interest). You should obtain road segment Place IDs by first
    calling the Roads API `snapToRoads` or `nearestRoads` endpoints.

--------------------------------------------------------------------------------

## Endpoint & Request Structure

Send an HTTPS `GET` request to the `speedLimits` endpoint:

```http
GET https://roads.googleapis.com/v1/speedLimits?placeId=PLACE_ID_1&placeId=PLACE_ID_2&key=YOUR_API_KEY
```

### Headers

Include the usage attribution header in all standard REST requests:

Header                    | Value                    | Description
:------------------------ | :----------------------- | :----------
`X-Goog-Maps-Solution-ID` | `gmp_git_agentskills_v1` | **Required.** Usage attribution header for Google Maps Platform calls.

### Query Parameters

Parameter | Requirement  | Description
:-------- | :----------- | :----------
`placeId` | **Required** | The Place ID(s) representing one or more road segments. To pass multiple Place IDs (up to 100 per request), repeat the `placeId` query parameter for each ID (e.g., `placeId=ID_1&placeId=ID_2`). The API does not perform road-snapping on supplied Place IDs.
`key`     | **Required** | Your application's Google Maps Platform API key.
`units`   | Optional     | Whether to return speed limits in kilometers or miles per hour. Accepted values: `KPH` or `MPH`. Defaults to `KPH`.

> **Cost Optimization Warning:** Each speed limit entry returned in the
> `speedLimits` array of the response triggers the **Roads - Speed Limits** SKU.
> Pass only the minimum required number of `placeId` parameters to optimize
> costs.

--------------------------------------------------------------------------------

## Code Examples

### cURL Request

```bash
curl -X GET "https://roads.googleapis.com/v1/speedLimits?placeId=ChIJX12duJAwGQ0Ra0d4Oi4jOGE&placeId=ChIJLQcticc0GQ0RoiNZJVa5GxU&units=KPH&key=YOUR_API_KEY" \
  -H "X-Goog-Maps-Solution-ID: gmp_git_agentskills_v1"
```

### JavaScript (Node.js / Fetch)

```javascript
async function getSpeedLimitsByPlaceIds(placeIds, apiKey, units = 'KPH') {
  const baseUrl = 'https://roads.googleapis.com/v1/speedLimits';
  const params = new URLSearchParams();

  // Append up to 100 road segment Place IDs
  placeIds.forEach((id) => params.append('placeId', id));
  params.append('units', units);
  params.append('key', apiKey);

  const response = await fetch(`${baseUrl}?${params.toString()}`, {
    method: 'GET',
    headers: {
      'X-Goog-Maps-Solution-ID': 'gmp_git_agentskills_v1',
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Roads API error (${response.status}): ${errorBody}`);
  }

  return await response.json();
}

// Example usage:
const roadSegmentIds = [
  'ChIJX12duJAwGQ0Ra0d4Oi4jOGE',
  'ChIJLQcticc0GQ0RoiNZJVa5GxU',
  'ChIJJ4vQRudkJA0RpednU70A-5M'
];

getSpeedLimitsByPlaceIds(roadSegmentIds, process.env.GOOGLE_MAPS_API_KEY)
  .then((data) => console.log(JSON.stringify(data, null, 2)))
  .catch((err) => console.error(err));
```

--------------------------------------------------------------------------------

## Response Format

When querying with `placeId` parameters, the response contains a `speedLimits`
array mapping each valid road segment Place ID to its speed limit. (Note:
`snappedPoints` is omitted when querying via `placeId`).

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
    },
    {
      "placeId": "ChIJJ4vQRudkJA0RpednU70A-5M",
      "speedLimit": 55,
      "units": "KPH"
    }
  ]
}
```

### Response Fields

-   `speedLimits` — An array of road metadata objects:
    -   `placeId` (`string`) — The unique identifier for the road segment.
    -   `speedLimit` (`number`) — The maximum posted speed limit for automobiles
        on that road segment. (Variable speed limit segments return the maximum
        limit; separate truck limits are not returned).
    -   `units` (`string`) — Either `KPH` or `MPH`.
-   `warningMessage` (`string`, optional) — A user-visible warning message if
    applicable.

--------------------------------------------------------------------------------

## Troubleshooting & Best Practices

### Why are some or all speed limits missing from the response?

The most common cause of missing `speedLimits` entries is passing a `placeId`
that does **not** represent an individual road segment (for example, passing the
Place ID of a bridge structure like `ChIJUzt97ZEwGQ0RM1JzQfqoDtU` instead of the
E90 road segment `ChIJX12duJAwGQ0Ra0d4Oi4jOGE` that crosses it).

-   If a Place ID is not a road segment, it is silently omitted from the
    `speedLimits` array.
-   Always obtain road segment Place IDs using `snapToRoads` or `nearestRoads`
    before calling `speedLimits`.

### Polling & Batching Recommendations

-   **Sampling Interval**: Sample moving asset locations at 5 to 15 minute
    intervals depending on asset speed. If an asset is stationary, a single
    location sample is sufficient.
-   **Batch Requests**: Instead of calling the API every time an asset reports
    its location, accumulate road segment Place IDs (up to 100 per call) and
    send them in a single batched request to minimize latency and overhead.
