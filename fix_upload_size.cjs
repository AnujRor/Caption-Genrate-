const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// The base64 upload might be very large, exceeding standard node limits.
// Let's make sure body-parser limit is large enough.
code = code.replace(
  `app.use(express.json({ limit: "50mb" }));`,
  `app.use(express.json({ limit: "500mb" }));`
);
code = code.replace(
  `app.use(express.urlencoded({ extended: true, limit: "50mb" }));`,
  `app.use(express.urlencoded({ extended: true, limit: "500mb" }));`
);

fs.writeFileSync('server.ts', code);
