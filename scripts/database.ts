import { Database } from 'bun:sqlite';
import type { ScriptMetadata, ScriptRoles } from './validator';

export interface ScriptRecord {
  metadata_id: string;
  roles_id: string;
  created_at: string;
}

export interface MetadataRecord {
  id: string;
  hash: string;
  json_data: string;
  created_at: string;
}

export interface RolesRecord {
  id: string;
  hash: string;
  json_data: string;
  created_at: string;
}

export class ScriptDatabase {
  private db: Database;

  constructor(dbPath: string = './scripts.db') {
    this.db = new Database(dbPath);

    // Enable WAL mode for better concurrency and performance
    this.db.exec('PRAGMA journal_mode = WAL;');

    this.initializeDatabase();
  }

  private initializeDatabase() {
    // Create metadata table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS metadata_data (
        id TEXT PRIMARY KEY,
        hash TEXT UNIQUE NOT NULL,
        json_data TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create roles table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS roles_data (
        id TEXT PRIMARY KEY,
        hash TEXT UNIQUE NOT NULL,
        json_data TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create scripts table linking metadata and roles
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS scripts (
        metadata_id TEXT NOT NULL,
        roles_id TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (metadata_id, roles_id),
        FOREIGN KEY (metadata_id) REFERENCES metadata_data(id),
        FOREIGN KEY (roles_id) REFERENCES roles_data(id)
      )
    `);

    // Create config table for storing the current ID length
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS config (
        key TEXT PRIMARY KEY,
        value INTEGER NOT NULL
      )
    `);

    // Initialize ID length if not exists
    const existingLength = this.db
      .query("SELECT value FROM config WHERE key = 'id_length'")
      .get() as { value: number } | null;
    if (!existingLength) {
      this.db.query("INSERT INTO config (key, value) VALUES ('id_length', 1)").run();
    }
  }

  private getCurrentIdLength(): number {
    const result = this.db.query("SELECT value FROM config WHERE key = 'id_length'").get() as {
      value: number;
    };
    return result.value;
  }

  private incrementIdLength(): void {
    this.db.query("UPDATE config SET value = value + 1 WHERE key = 'id_length'").run();
  }

  private readonly badWords = [
    'fuck',
    'shit',
    'damn',
    'hell',
    'ass',
    'bitch',
    'crap',
    'piss',
    'cock',
    'dick',
    'pussy',
    'tits',
    'boobs',
    'sex',
    'porn',
    'nude',
    'naked',
    'gay',
    'lesbian',
    'nazi',
    'hitler',
    'kill',
    'die',
    'death',
    'murder',
    'rape',
    'drug',
    'weed',
    'cocaine',
    'heroin',
    'meth',
    'crack',
    'bomb',
    'terror',
    'gun',
    'weapon',
    'cao',
    'nima',
    'sb',
    'cnm',
    'nmsl',
    'wqnmlgb',
    'tmd',
    'mlgb',
    'qnmd',
    'sha',
    'si',
    'gun',
    'bie',
    'zhu',
    'gou',
    'bi',
    'jb',
    'db',
    'nc',
    '666',
    '888',
    '420',
    '69',
    '88',
    '14',
    'admin',
    'root',
    'test',
    'demo',
    'null',
    'void',
    'temp',
    'tmp',
    'api',
    'www',
    'ftp',
    'mail',
    'smtp',
    'pop',
    'imap',
    'dns',
    'ssl',
  ];

  private containsBadWord(id: string): boolean {
    const lowerId = id.toLowerCase();
    return this.badWords.some((badWord) => lowerId.includes(badWord));
  }

  private generateRandomId(length: number): string {
    let attempts = 0;
    const maxAttempts = 50; // Prevent infinite loops

    while (attempts < maxAttempts) {
      // Generate random ID in range [36^length, 36^(length+1))
      const min = Math.pow(36, length);
      const max = Math.pow(36, length + 1);
      const randomNum = Math.floor(Math.random() * (max - min)) + min;
      const id = randomNum.toString(36);

      // Check if the generated ID contains bad words
      if (!this.containsBadWord(id)) {
        return id;
      }

      attempts++;
    }

    // If we can't generate a clean ID after many attempts,
    // fall back to a hash-based approach
    const timestamp = Date.now().toString(36);
    const random = Math.random()
      .toString(36)
      .substring(2, 2 + length);
    return (timestamp + random).substring(0, length + 1);
  }

  private async generateSHA256Hash(data: string): Promise<string> {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  private async storeDataWithHash(
    table: 'metadata_data' | 'roles_data',
    jsonData: string,
  ): Promise<string> {
    const hash = await this.generateSHA256Hash(jsonData);

    // Check if data with this hash already exists
    const existing = this.db.query(`SELECT id FROM ${table} WHERE hash = ?`).get(hash) as {
      id: string;
    } | null;
    if (existing) {
      return existing.id;
    }

    // Generate new ID and store data
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      const currentLength = this.getCurrentIdLength();
      const id = this.generateRandomId(currentLength);

      try {
        this.db
          .query(`INSERT INTO ${table} (id, hash, json_data) VALUES (?, ?, ?)`)
          .run(id, hash, jsonData);
        return id;
      } catch (error: any) {
        if (error.message && error.message.includes('UNIQUE constraint failed')) {
          attempts++;
          if (attempts >= 3) {
            this.incrementIdLength();
            attempts = 0;
          }
          continue;
        } else {
          throw error;
        }
      }
    }

    throw new Error('Failed to generate unique ID after maximum attempts');
  }

  public async storeScript(
    metadata: ScriptMetadata,
    roles: ScriptRoles,
  ): Promise<{ metadataId: string; rolesId: string }> {
    const metadataJson = JSON.stringify(metadata);
    const rolesJson = JSON.stringify(roles);

    const metadataId = await this.storeDataWithHash('metadata_data', metadataJson);
    const rolesId = await this.storeDataWithHash('roles_data', rolesJson);

    // Store the script link
    try {
      this.db
        .query('INSERT OR IGNORE INTO scripts (metadata_id, roles_id) VALUES (?, ?)')
        .run(metadataId, rolesId);
    } catch (error) {
      // Ignore if already exists
    }

    return { metadataId, rolesId };
  }

  public getScript(
    metadataId: string,
    rolesId: string,
  ): { metadata: ScriptMetadata; roles: ScriptRoles } | null {
    // Get metadata
    const metadataRecord = this.db
      .query('SELECT json_data FROM metadata_data WHERE id = ?')
      .get(metadataId) as { json_data: string } | null;
    if (!metadataRecord) {
      return null;
    }

    // Get roles
    const rolesRecord = this.db
      .query('SELECT json_data FROM roles_data WHERE id = ?')
      .get(rolesId) as { json_data: string } | null;
    if (!rolesRecord) {
      return null;
    }

    // Verify the script link exists
    const scriptLink = this.db
      .query('SELECT 1 FROM scripts WHERE metadata_id = ? AND roles_id = ?')
      .get(metadataId, rolesId);
    if (!scriptLink) {
      return null;
    }

    try {
      const metadata = JSON.parse(metadataRecord.json_data) as ScriptMetadata;
      const roles = JSON.parse(rolesRecord.json_data) as ScriptRoles;
      return { metadata, roles };
    } catch (error) {
      return null;
    }
  }

  public getMetadata(id: string): ScriptMetadata | null {
    const record = this.db.query('SELECT json_data FROM metadata_data WHERE id = ?').get(id) as {
      json_data: string;
    } | null;
    if (!record) {
      return null;
    }
    try {
      return JSON.parse(record.json_data) as ScriptMetadata;
    } catch (error) {
      return null;
    }
  }

  public getRoles(id: string): ScriptRoles | null {
    const record = this.db.query('SELECT json_data FROM roles_data WHERE id = ?').get(id) as {
      json_data: string;
    } | null;
    if (!record) {
      return null;
    }
    try {
      return JSON.parse(record.json_data) as ScriptRoles;
    } catch (error) {
      return null;
    }
  }

  public close(): void {
    this.db.close();
  }
}
