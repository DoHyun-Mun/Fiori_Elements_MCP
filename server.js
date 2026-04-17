/**
 * Custom CAP Server with explicit SQLite deploy
 * cds-serve는 DB schema를 deploy하지 않으므로,
 * 서버 시작 시 명시적으로 schema를 배포합니다.
 */
const cds = require('@sap/cds');

module.exports = async function (o) {
    // Load the CDS model
    const csn = cds.model || await cds.load('*');
    cds.model = csn;

    // Get the compiled SQL DDL statements
    let ddl;
    try {
        ddl = cds.compile(csn).to.sql({ dialect: 'sqlite' });
    } catch (e) {
        try {
            ddl = cds.compile(csn).to.sql();
        } catch (e2) {
            console.error('[server.js] Could not compile DDL:', e2.message);
        }
    }

    // Connect to db
    const db = await cds.connect.to('db');

    // Deploy DDL statements
    if (ddl && ddl.length) {
        console.log(`[server.js] Deploying ${ddl.length} DDL statements to SQLite...`);
        for (const sql of ddl) {
            try {
                await db.run(sql);
            } catch (err) {
                // Ignore "table already exists" errors
                if (!err.message.includes('already exists')) {
                    console.warn('[server.js] DDL warning:', err.message);
                }
            }
        }
        console.log('[server.js] Schema deployment complete');
    }

    // Load CSV data into the database
    try {
        const fs = require('fs');
        const path = require('path');
        const csvDir = path.join(__dirname, 'db', 'data');
        
        if (fs.existsSync(csvDir)) {
            const files = fs.readdirSync(csvDir).filter(f => f.endsWith('.csv'));
            for (const file of files) {
                try {
                    const entityName = file.replace('.csv', '').replace(/-/g, '.');
                    const csvPath = path.join(csvDir, file);
                    const content = fs.readFileSync(csvPath, 'utf8');
                    const lines = content.trim().split('\n');
                    
                    if (lines.length < 2) continue;
                    
                    const headers = lines[0].split(',').map(h => h.trim());
                    const rows = [];
                    
                    for (let i = 1; i < lines.length; i++) {
                        const values = lines[i].split(',').map(v => v.trim());
                        if (values.length === headers.length) {
                            const row = {};
                            headers.forEach((h, idx) => {
                                row[h] = values[idx] === '' ? null : values[idx];
                            });
                            rows.push(row);
                        }
                    }
                    
                    if (rows.length > 0) {
                        // Find the entity in the model
                        const entity = csn.definitions[entityName];
                        if (entity) {
                            const tableName = entityName.replace(/\./g, '_');
                            for (const row of rows) {
                                const cols = Object.keys(row).filter(k => row[k] !== null);
                                const placeholders = cols.map(() => '?').join(',');
                                const sql = `INSERT OR IGNORE INTO "${tableName}" (${cols.map(c => `"${c}"`).join(',')}) VALUES (${placeholders})`;
                                try {
                                    await db.run(sql, cols.map(c => row[c]));
                                } catch (e) {
                                    // Skip individual row errors
                                }
                            }
                            console.log(`[server.js] Loaded ${rows.length} rows from ${file}`);
                        }
                    }
                } catch (e) {
                    // Skip file errors
                }
            }
        }
    } catch (e) {
        console.warn('[server.js] CSV loading skipped:', e.message);
    }

    // Continue with default server setup
    return cds.server(o);
};