const fs = require('fs');
const path = require('path');

// 1. Get database path from DATABASE_URL environment variable
let dbUrl = process.env.DATABASE_URL;

if (dbUrl && dbUrl.startsWith('file:')) {
  // Extract path (handle both absolute and relative file URLs)
  let dbPath = dbUrl.substring(5);
  // On Windows, the path might start with an extra slash if it's like file:/C:/...
  if (dbPath.startsWith('/') && dbPath[2] === ':') {
    dbPath = dbPath.substring(1);
  }
  const absolutePath = path.resolve(dbPath);
  
  console.log(`Checking SQLite database file at: ${absolutePath}`);
  
  if (!fs.existsSync(absolutePath)) {
    console.log("Database file not found in persistent volume.");
    
    // Ensure destination directory exists
    const dir = path.dirname(absolutePath);
    if (!fs.existsSync(dir)) {
      console.log(`Creating directory: ${dir}`);
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Source path of the seeded database in the repository
    const sourcePath = path.resolve(__dirname, '../dev.db');
    if (fs.existsSync(sourcePath)) {
      console.log(`Copying initial seeded database template from ${sourcePath} to ${absolutePath}...`);
      fs.copyFileSync(sourcePath, absolutePath);
      console.log("Database initialized successfully on persistent volume.");
    } else {
      console.error(`Warning: Seeded database template not found at ${sourcePath}. Creating empty database.`);
    }
  } else {
    console.log("Database already exists in persistent volume. Skipping initialization.");
  }
} else {
  console.log("DATABASE_URL is not set to a file URL. Skipping persistent volume bootstrap.");
}
