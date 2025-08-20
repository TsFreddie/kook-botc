# Asset Manager Library

A standalone asset management library for handling file uploads with SQLite-based caching. Originally extracted from the KOOK bot project to provide a reusable solution for managing uploaded assets.

## Features

- **SQLite-based caching**: Persistent storage of asset name-to-URL mappings
- **Duplicate upload prevention**: Automatically reuses cached assets
- **Configurable upload function**: Inject any upload implementation
- **Simple interface**: Just stores what you need - asset names and URLs
- **Batch operations**: Upload multiple assets efficiently
- **Debug logging**: Optional detailed logging for troubleshooting

## Installation

The library is included in this project. To use it in other projects, copy the `assetManager.ts` file and install the required dependencies:

```bash
bun add bun # For SQLite support
```

## Quick Start

### Simple Usage (Recommended)

```typescript
import { ASSETS, initializeAssets } from './lib/assetManager.ts';

// Initialize once at app startup
initializeAssets({
  uploadFunction: async (params) => {
    // Your upload logic here
    const response = await yourApiClient.uploadFile(params.file);
    return { url: response.url };
  },
  debug: true,
});

// Use anywhere in your app
const imageUrl = await ASSETS.get('logo', 'logo.png');
console.log('Asset URL:', imageUrl);

// Batch upload multiple assets
const assets = await ASSETS.uploadBatch([
  { name: 'banner_day', filename: 'day.png' },
  { name: 'banner_night', filename: 'night.png' },
]);

// Clean up when app shuts down
ASSETS.close();
```

### Manual Instance Creation

```typescript
import { createAssetManager } from './lib/assetManager.ts';

// Create asset manager with your upload function
const assetManager = createAssetManager({
  uploadFunction: async (params) => {
    // Your upload logic here
    const response = await yourApiClient.uploadFile(params.file);
    return { url: response.url };
  },
  debug: true,
});

// Upload an asset (or get from cache if already uploaded)
const imageUrl = await assetManager.getAsset('logo', 'logo.png');
console.log('Asset URL:', imageUrl);

// Clean up
assetManager.close();
```

## Configuration

### AssetManagerConfig

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `uploadFunction` | `AssetUploadFunction` | **Required** | Function to upload files to your service |
| `dbPath` | `string` | `'./assets.db'` | Path to SQLite database file |
| `assetsDir` | `string` | `'./assets'` | Base directory for asset files |
| `debug` | `boolean` | `false` | Enable debug logging |

### Upload Function Type

```typescript
type AssetUploadFunction = (params: UploadAssetParams) => Promise<AssetUploadResponse>;

interface UploadAssetParams {
  file: File | Blob;
}

interface AssetUploadResponse {
  url: string;
}
```

## API Reference

### AssetManager

#### Methods

##### `getAsset(name: string, filename: string): Promise<string>`
Get an asset URL by name. If not cached, uploads the file and caches the result.

##### `uploadAsset(name: string, filename: string): Promise<string>`
Force upload an asset, even if cached.

##### `uploadAssets(assets: Array<{name: string, filename: string}>): Promise<Record<string, string>>`
Batch upload multiple assets.

##### `getCachedAsset(name: string): AssetRecord | null`
Get cached asset metadata by name.

##### `getAllAssets(): AssetRecord[]`
Get all cached assets.

##### `removeCachedAsset(name: string): boolean`
Remove an asset from cache (doesn't delete remote file).

##### `clearCache(): number`
Clear all cached assets. Returns number of deleted records.

##### `getCacheStats(): {count: number, totalSize: number}`
Get cache statistics.

##### `close(): void`
Close the database connection.

## Examples

See `examples/assetManagerExample.ts` for comprehensive usage examples.

### Basic Usage

```typescript
const assetManager = createAssetManager({
  uploadFunction: mockUploadFunction,
  debug: true,
});

const url = await assetManager.getAsset('logo', 'logo.png');
```

### KOOK API Integration

```typescript
import { KookApiClient } from './api.ts';

const kookApi = new KookApiClient(token);
const assetManager = createAssetManager({
  uploadFunction: (params) => kookApi.assetCreate(params),
});

const assets = await assetManager.uploadAssets([
  { name: 'day', filename: 'banner_day.png' },
  { name: 'night', filename: 'banner_night.png' },
]);
```

## Database Schema

The library creates a simple SQLite table with the following schema:

```sql
CREATE TABLE assets (
  name TEXT PRIMARY KEY,
  url TEXT NOT NULL
);
```

## Migration from JSON

If you're migrating from a JSON-based asset cache (like `.assets.json`), you can manually populate the database:

```typescript
// Read existing JSON cache
const existingAssets = JSON.parse(await Bun.file('.assets.json').text());

// Populate asset manager cache
for (const [name, url] of Object.entries(existingAssets)) {
  // You'll need to implement a method to populate cache manually
  // or re-upload the assets to populate the cache naturally
}
```

## Error Handling

The library throws errors for:
- Missing asset files
- Upload function failures
- Database connection issues

Always wrap asset operations in try-catch blocks:

```typescript
try {
  const url = await assetManager.getAsset('logo', 'logo.png');
} catch (error) {
  console.error('Failed to get asset:', error);
}
```

## Performance Considerations

- The SQLite database is created with appropriate indexes for fast lookups
- Batch operations are more efficient than individual uploads
- Cache hits avoid network requests entirely
- Database connections should be closed when done

## License

This library is part of the KOOK Bot project and follows the same license terms.
