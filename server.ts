import 'dotenv/config';
import express, {type Request, type Response} from 'express';
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const ATTRIBUTION_HEADER = 'gmp_mcp_codeassist_v1_aistudio';

interface CachedSpeedLimit {
  speedLimit: number | null;
  units: 'KPH' | 'MPH';
  placeId: string;
  cachedAt: number;
}

// Short session cache keyed by road segment placeId + units (never caches lat/lng long-term)
const speedLimitCache = new Map<string, CachedSpeedLimit>();
const CACHE_TTL_MS = 5 * 60 * 1000;

function getMapsApiKey(): string {
  return (
    process.env.VITE_GOOGLE_MAPS_API_KEY ||
    process.env.GOOGLE_MAPS_API_KEY ||
    ''
  );
}

async function handleSpeedLimitRequest(req: Request, res: Response) {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  const units = req.query.units === 'MPH' ? 'MPH' : 'KPH';

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    res.status(400).json({
      available: false,
      reason: 'INVALID_COORDINATES',
      message: 'Valid lat and lng query parameters are required.',
    });
    return;
  }

  const apiKey = getMapsApiKey();
  if (!apiKey) {
    res.status(200).json({
      available: false,
      reason: 'MISSING_API_KEY',
      message: 'Google Maps API key is not configured on the server.',
    });
    return;
  }

  try {
    // Step 1: Snap single coordinate to nearest road segment Place ID via Roads API nearestRoads
    const nearestUrl = new URL('https://roads.googleapis.com/v1/nearestRoads');
    nearestUrl.searchParams.set('points', `${lat},${lng}`);
    nearestUrl.searchParams.set('key', apiKey);

    const nearestResp = await fetch(nearestUrl.toString(), {
      method: 'GET',
      headers: {
        'X-Goog-Maps-Solution-ID': ATTRIBUTION_HEADER,
      },
    });

    if (nearestResp.status === 429) {
      res.status(429).json({
        available: false,
        reason: 'RESOURCE_EXHAUSTED',
        message: 'Google Maps Roads API quota reached.',
      });
      return;
    }

    const nearestBody = (await nearestResp.json().catch(() => ({}))) as {
      snappedPoints?: Array<{
        placeId?: string;
        location?: {latitude?: number; longitude?: number};
      }>;
      error?: {code?: number; message?: string; status?: string};
    };

    if (!nearestResp.ok) {
      if (
        nearestBody.error?.status === 'RESOURCE_EXHAUSTED' ||
        nearestResp.status === 429
      ) {
        res.status(429).json({
          available: false,
          reason: 'RESOURCE_EXHAUSTED',
          message:
            nearestBody.error?.message || 'Google Maps Roads API quota reached.',
        });
        return;
      }

      res.status(200).json({
        available: false,
        reason: 'ROADS_API_UNAVAILABLE',
        message:
          nearestBody.error?.message ||
          'Roads API is not activated for this API key.',
      });
      return;
    }

    const snapped = nearestBody.snappedPoints?.[0];
    if (!snapped?.placeId) {
      res.status(200).json({
        available: true,
        speedLimit: null,
        units,
        placeId: null,
        message: 'No mapped road segment found at current coordinates.',
      });
      return;
    }

    const placeId = snapped.placeId;
    const cacheKey = `${placeId}:${units}`;
    const cached = speedLimitCache.get(cacheKey);
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
      res.status(200).json({
        available: true,
        speedLimit: cached.speedLimit,
        units: cached.units,
        placeId: cached.placeId,
        cached: true,
      });
      return;
    }

    // Step 2: Query Roads API speedLimits using the road segment Place ID
    const speedUrl = new URL('https://roads.googleapis.com/v1/speedLimits');
    speedUrl.searchParams.append('placeId', placeId);
    speedUrl.searchParams.set('units', units);
    speedUrl.searchParams.set('key', apiKey);

    const speedResp = await fetch(speedUrl.toString(), {
      method: 'GET',
      headers: {
        'X-Goog-Maps-Solution-ID': ATTRIBUTION_HEADER,
      },
    });

    if (speedResp.status === 429) {
      res.status(429).json({
        available: false,
        reason: 'RESOURCE_EXHAUSTED',
        message: 'Google Maps Roads API quota reached.',
      });
      return;
    }

    const speedBody = (await speedResp.json().catch(() => ({}))) as {
      speedLimits?: Array<{
        placeId?: string;
        speedLimit?: number;
        units?: 'KPH' | 'MPH';
      }>;
      warningMessage?: string;
      error?: {code?: number; message?: string; status?: string};
    };

    if (!speedResp.ok) {
      if (
        speedBody.error?.status === 'RESOURCE_EXHAUSTED' ||
        speedResp.status === 429
      ) {
        res.status(429).json({
          available: false,
          reason: 'RESOURCE_EXHAUSTED',
          message:
            speedBody.error?.message || 'Google Maps Roads API quota reached.',
        });
        return;
      }

      // Speed Limits requires Asset Tracking license on GCP; return structured fallback state
      res.status(200).json({
        available: false,
        reason: 'SPEED_LIMIT_LICENSE_REQUIRED',
        placeId,
        message:
          speedBody.error?.message ||
          'Speed Limit data requires a Google Maps Asset Tracking license.',
      });
      return;
    }

    const entry = speedBody.speedLimits?.[0];
    const resolvedLimit =
      typeof entry?.speedLimit === 'number' ? entry.speedLimit : null;
    const resolvedUnits = entry?.units === 'MPH' ? 'MPH' : units;

    speedLimitCache.set(cacheKey, {
      speedLimit: resolvedLimit,
      units: resolvedUnits,
      placeId,
      cachedAt: Date.now(),
    });

    res.status(200).json({
      available: true,
      speedLimit: resolvedLimit,
      units: resolvedUnits,
      placeId,
      warningMessage: speedBody.warningMessage ?? null,
    });
  } catch (err) {
    res.status(502).json({
      available: false,
      reason: 'NETWORK_ERROR',
      message:
        err instanceof Error ? err.message : 'Failed to query Roads API.',
    });
  }
}

async function startServer() {
  const app = express();
  app.use(express.json());

  app.get('/api/speed-limit', (req, res) => {
    void handleSpeedLimitRequest(req, res);
  });

  if (process.env.NODE_ENV !== 'production') {
    const {createServer: createViteServer} = await import('vite');
    const vite = await createViteServer({
      server: {middlewareMode: true},
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`MotoRide Auto server running on port ${PORT}`);
  });
}

void startServer();
