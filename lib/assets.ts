import { Database } from 'bun:sqlite';
import type { AssetUploadResponse, UploadAssetParams } from './api.ts';
import { BOT } from '../bot.ts';
import { readdirSync, statSync } from 'fs';
import { join, parse } from 'path';

/**
 * Asset upload function type - allows injection of different upload implementations
 */
export type AssetUploadFunction = (params: UploadAssetParams) => Promise<AssetUploadResponse>;

/**
 * Asset record stored in the database
 */
export interface AssetRecord {
  name: string;
  url: string;
  modified_time: number; // Unix timestamp of file modification time
}

/**
 * Configuration for the asset manager
 */
export interface AssetManagerConfig {
  /**
   * Path to the SQLite database file
   * @default './assets.db'
   */
  dbPath?: string;

  /**
   * Base directory for asset files
   * @default './assets'
   */
  assetsDir?: string;

  /**
   * Whether to enable debug logging
   * @default false
   */
  debug?: boolean;
}

/**
 * Standalone asset management library with SQLite storage
 *
 * Features:
 * - SQLite-based caching of uploaded assets
 * - Automatic file detection and upload
 * - Duplicate upload prevention
 * - Configurable upload function injection
 */
export class AssetManager {
  private db: Database;
  private config: Required<AssetManagerConfig>;

  constructor(config: Partial<AssetManagerConfig>) {
    this.config = {
      dbPath: './assets.db',
      assetsDir: './assets',
      debug: false,
      ...config,
    };

    // Initialize SQLite database
    this.db = new Database(this.config.dbPath);
    this.initializeDatabase();
  }

  /**
   * Initialize the database schema
   */
  private initializeDatabase(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS assets (
        name TEXT PRIMARY KEY,
        url TEXT NOT NULL,
        modified_time INTEGER NOT NULL DEFAULT 0
      )
    `);

    // Add modified_time column if it doesn't exist (for existing databases)
    try {
      this.db.exec(`ALTER TABLE assets ADD COLUMN modified_time INTEGER NOT NULL DEFAULT 0`);
    } catch (error) {
      // Column already exists, ignore the error
    }

    if (this.config.debug) {
      console.log(`[AssetManager] Database initialized at ${this.config.dbPath}`);
    }
  }

  /**
   * Get an asset by name, uploading it if not cached or if file has been modified
   */
  async getAsset(name: string, filename: string): Promise<string> {
    const filePath = `${this.config.assetsDir}/${filename}`;

    // Check if asset exists in cache
    const cached = this.getCachedAsset(name);
    if (cached) {
      try {
        // Check if file still exists and get its modification time
        const stat = statSync(filePath);
        const currentModifiedTime = Math.floor(stat.mtime.getTime() / 1000);

        // If file hasn't been modified since cache, use cached version
        if (currentModifiedTime === cached.modified_time) {
          if (this.config.debug) {
            console.log(`[AssetManager] Using cached asset: ${name} -> ${cached.url}`);
          }
          return cached.url;
        } else {
          if (this.config.debug) {
            console.log(
              `[AssetManager] File modified, re-uploading: ${name} (cached: ${cached.modified_time}, current: ${currentModifiedTime})`,
            );
          }
        }
      } catch (error) {
        if (this.config.debug) {
          console.log(`[AssetManager] File no longer exists, removing from cache: ${name}`);
        }
        this.removeCachedAsset(name);
        throw new Error(`Asset file not found: ${filePath}`);
      }
    }

    // Upload the asset (either not cached or file has been modified)
    return await this.uploadAsset(name, filename);
  }

  /**
   * Upload an asset and cache the result
   */
  async uploadAsset(name: string, filename: string): Promise<string> {
    const filePath = `${this.config.assetsDir}/${filename}`;

    try {
      const file = Bun.file(filePath);

      // Check if file exists
      if (!(await file.exists())) {
        throw new Error(`Asset file not found: ${filePath}`);
      }

      // Get file modification time
      const stat = statSync(filePath);
      const modifiedTime = Math.floor(stat.mtime.getTime() / 1000); // Convert to Unix timestamp

      // Upload the file
      const response = await BOT.api.assetCreate({ file });

      // Cache the result with modification time
      this.cacheAsset({
        name,
        url: response.url,
        modified_time: modifiedTime,
      });

      if (this.config.debug) {
        console.log(`[AssetManager] Uploaded asset: ${name}(${filename}) -> ${response.url}`);
      }

      return response.url;
    } catch (error) {
      console.error(`[AssetManager] Failed to upload asset ${name}(${filename}):`, error);
      throw error;
    }
  }

  /**
   * Get a cached asset by name
   */
  getCachedAsset(name: string): AssetRecord | null {
    const stmt = this.db.prepare('SELECT * FROM assets WHERE name = ?');
    const result = stmt.get(name) as AssetRecord | undefined;
    return result || null;
  }

  /**
   * Cache an asset record
   */
  private cacheAsset(asset: AssetRecord): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO assets
      (name, url, modified_time)
      VALUES (?, ?, ?)
    `);

    stmt.run(asset.name, asset.url, asset.modified_time);
  }

  /**
   * Get all cached assets
   */
  getAllAssets(): AssetRecord[] {
    const stmt = this.db.prepare('SELECT * FROM assets ORDER BY name');
    return stmt.all() as AssetRecord[];
  }

  /**
   * Remove an asset from cache (does not delete the remote asset)
   */
  removeCachedAsset(name: string): boolean {
    const stmt = this.db.prepare('DELETE FROM assets WHERE name = ?');
    const result = stmt.run(name);
    return result.changes > 0;
  }

  /**
   * Clear all cached assets
   */
  clearCache(): number {
    const stmt = this.db.prepare('DELETE FROM assets');
    const result = stmt.run();
    return result.changes;
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { count: number } {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM assets');
    const result = stmt.get() as { count: number };
    return result;
  }

  /**
   * Close the database connection
   */
  close(): void {
    this.db.close();
    if (this.config.debug) {
      console.log('[AssetManager] Database connection closed');
    }
  }

  /**
   * Batch upload multiple assets
   */
  async uploadAssets(
    assets: Array<{ name: string; filename: string }>,
  ): Promise<Record<string, string>> {
    const results: Record<string, string> = {};

    for (const asset of assets) {
      try {
        results[asset.name] = await this.getAsset(asset.name, asset.filename);
      } catch (error) {
        if (this.config.debug) {
          console.error(`[AssetManager] Failed to upload ${asset.name}:`, error);
        }
        throw error;
      }
    }

    return results;
  }

  /**
   * Automatically discover and upload all files in the assets directory
   * Also cleans up any cached entries that no longer exist
   * Files are re-uploaded if their modification time has changed
   */
  async uploadAllAssets(): Promise<Record<string, string>> {
    try {
      // Read all files from the assets directory
      const files = readdirSync(this.config.assetsDir);
      const assetFiles = files.filter((file: string) => {
        const filePath = join(this.config.assetsDir, file);
        const stat = statSync(filePath);
        return stat.isFile() && !file.startsWith('.'); // Exclude hidden files
      });

      if (this.config.debug) {
        console.log(
          `[AssetManager] Found ${assetFiles.length} files in ${this.config.assetsDir}:`,
          assetFiles,
        );
      }

      // Create asset entries using filename without extension as name
      const assetsToUpload = assetFiles.map((filename: string) => ({
        name: parse(filename).name, // Use filename without extension as name
        filename: filename,
      }));

      // Upload all discovered assets (getAsset will handle modification time checking)
      const results = await this.uploadAssets(assetsToUpload);

      // Clean up cached entries that no longer exist
      const cachedAssets = this.getAllAssets();
      const currentAssetNames = new Set(
        assetsToUpload.map((asset: { name: string; filename: string }) => asset.name),
      );

      let removedCount = 0;
      for (const cachedAsset of cachedAssets) {
        if (!currentAssetNames.has(cachedAsset.name)) {
          this.removeCachedAsset(cachedAsset.name);
          removedCount++;
          if (this.config.debug) {
            console.log(
              `[AssetManager] Removed cached asset that no longer exists: ${cachedAsset.name}`,
            );
          }
        }
      }

      if (this.config.debug && removedCount > 0) {
        console.log(
          `[AssetManager] Cleaned up ${removedCount} cached entries that no longer exist`,
        );
      }

      return results;
    } catch (error) {
      console.error(`[AssetManager] Failed to upload all assets:`, error);
      throw error;
    }
  }
}

export const ASSETS = new AssetManager({
  debug: process.env.BOT_DEBUG === 'true',
});
