# Find Nearest Roads

## Overview

The Nearest Roads capability of the Roads API takes up to 100 independent
latitude/longitude coordinates and returns the closest road segment for each
point. The coordinates passed do not need to be part of a continuous path.

> **Note:** If you are working with sequential GPS points along a path, use the
> **Snap to Roads** capability instead.

## Request Structure

A request to find the nearest roads must be sent using `HTTPS` via a `GET`
request in the following form:

```http
https://roads.googleapis.com/v1/nearestRoads?parameters&key=YOUR_API_KEY
```

### Headers

Include the usage attribution header in your HTTP requests:

*   `X-Goog-Maps-Solution-ID: gmp_git_agentskills_v1`

### Required Parameters

*   **`points`**: The points to be snapped. The `points` parameter accepts a
    list of up to 100 latitude/longitude pairs.
    *   Separate latitude and longitude values with commas (`,`).
    *   Separate multiple coordinate pairs with the pipe character (`|`, or
        URL-encoded as `%7C`).
    *   Example:
        `points=60.170880,24.942795|60.170879,24.942796|60.170877,24.942796`
*   **`key`**: Your application's Google Maps Platform API key.

## Code Examples

### cURL

```bash
curl -L -X GET \
  -H "X-Goog-Maps-Solution-ID: gmp_git_agentskills_v1" \
  'https://roads.googleapis.com/v1/nearestRoads?points=60.170880%2C24.942795%7C60.170879%2C24.942796%7C60.170877%2C24.942796&key=YOUR_API_KEY'
```

### JavaScript (Fetch API)

```javascript
async function getNearestRoads(coordinates, apiKey) {
  // Format array of {lat, lng} objects into "lat,lng|lat,lng"
  const pointsParam = coordinates
    .map(coord => `${coord.lat},${coord.lng}`)
    .join('|');

  const url = `https://roads.googleapis.com/v1/nearestRoads?points=${encodeURIComponent(pointsParam)}&key=${apiKey}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'X-Goog-Maps-Solution-ID': 'gmp_git_agentskills_v1'
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  return data.snappedPoints;
}

// Usage
const points = [
  { lat: 60.170880, lng: 24.942795 },
  { lat: 60.170879, lng: 24.942796 },
  { lat: 60.170877, lng: 24.942796 }
];

getNearestRoads(points, 'YOUR_API_KEY')
  .then(snappedPoints => console.log(snappedPoints))
  .catch(err => console.error(err));
```

## Response Schema

For each valid request, the Roads API returns a JSON object containing a
`snappedPoints` array.

### Example Response

```json
{
  "snappedPoints": [
    {
      "location": {
        "latitude": 60.170878428876755,
        "longitude": 24.94269540970182
      },
      "originalIndex": 0,
      "placeId": "ChIJfVFHrM0LkkYRBzUQos_jR5w"
    },
    {
      "location": {
        "latitude": 60.17087741412199,
        "longitude": 24.942695474405202
      },
      "originalIndex": 1,
      "placeId": "ChIJfVFHrM0LkkYRBzUQos_jR5w"
    },
    {
      "location": {
        "latitude": 60.170875416131736,
        "longitude": 24.942695601802203
      },
      "originalIndex": 2,
      "placeId": "ChIJfVFHrM0LkkYRBzUQos_jR5w"
    }
  ]
}
```

### Schema Definitions

#### `NearestRoadsResponse`

Field           | Required | Type                  | Description
:-------------- | :------- | :-------------------- | :----------
`snappedPoints` | Optional | `Array<SnappedPoint>` | An array of snapped points. May sometimes contain several snapped points for the same input coordinate with differing `placeId` or `location` values. If no roads are found nearby, this field may be omitted.

#### `SnappedPoint`

Field           | Required     | Type                       | Description
:-------------- | :----------- | :------------------------- | :----------
`location`      | **Required** | `LatitudeLongitudeLiteral` | The coordinates of the snapped point on the road segment.
`placeId`       | **Required** | `string`                   | A unique identifier for a place. All place IDs returned by the Roads API correspond to road segments.
`originalIndex` | Optional     | `number`                   | A 0-based integer that indicates the corresponding value in the original `points` request parameter (e.g., an `originalIndex` of `4` corresponds to the 5th coordinate passed in the request). Note that a single input coordinate may map to multiple items in `snappedPoints` with the same `originalIndex` if multiple road segments are equally close.

#### `LatitudeLongitudeLiteral`

Field       | Required     | Type     | Description
:---------- | :----------- | :------- | :----------------------------
`latitude`  | **Required** | `number` | Latitude in decimal degrees.
`longitude` | **Required** | `number` | Longitude in decimal degrees.
