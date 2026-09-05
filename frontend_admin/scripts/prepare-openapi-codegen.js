const fs = require('node:fs/promises');
const http = require('node:http');
const https = require('node:https');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const {
  transformAllauthSchema,
  transformOpenApiTags,
} = require('./openapi-codegen-tags');

const DEFAULT_SCHEMA_URL = 'http://localhost:18000/api/openapi.json';
const DEFAULT_OUTPUT_PATH = path.join(
  __dirname,
  '..',
  'config',
  'codegen.openapi.json',
);
const DEFAULT_ALLAUTH_SCHEMA_URL =
  'http://127.0.0.1:4523/export/openapi/2?version=3.0';
const DEFAULT_ALLAUTH_OUTPUT_PATH = path.join(
  __dirname,
  '..',
  'config',
  'codegen.allauth.json',
);

function loadHttpSchema(schemaUrl) {
  return new Promise((resolve, reject) => {
    const client = schemaUrl.startsWith('https:') ? https : http;
    const url = new URL(schemaUrl);
    const requestOptions =
      url.hostname === 'localhost' ? { family: 4 } : undefined;
    const request = client.get(url, requestOptions, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        if (
          !response.statusCode ||
          response.statusCode < 200 ||
          response.statusCode >= 300
        ) {
          reject(
            new Error(
              `Failed to fetch OpenAPI schema from ${schemaUrl}: ${response.statusCode} ${response.statusMessage}`,
            ),
          );
          return;
        }
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(
            new Error(
              `OpenAPI schema from ${schemaUrl} is not valid JSON: ${error.message}`,
            ),
          );
        }
      });
    });
    request.on('error', (error) =>
      reject(
        new Error(
          `Failed to fetch OpenAPI schema from ${schemaUrl}: ${error.message}`,
        ),
      ),
    );
  });
}

async function loadSchema(schemaUrl) {
  if (/^https?:\/\//.test(schemaUrl)) {
    return loadHttpSchema(schemaUrl);
  }

  const resolvedPath = path.resolve(__dirname, '..', schemaUrl);
  const content = await fs.readFile(resolvedPath, 'utf8');
  return JSON.parse(content);
}

async function writeSchema(outputPath, schema) {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(
    outputPath,
    `${JSON.stringify(schema, null, 2)}\n`,
    'utf8',
  );
}

async function main() {
  const target = process.env.OPENAPI_CODEGEN_TARGET || 'all';
  if (!['all', 'django', 'allauth'].includes(target)) {
    throw new Error(`Unsupported OPENAPI_CODEGEN_TARGET: ${target}`);
  }
  const schemaUrl = process.env.OPENAPI_SCHEMA_URL || DEFAULT_SCHEMA_URL;
  const outputPath =
    process.env.OPENAPI_CODEGEN_SCHEMA_PATH || DEFAULT_OUTPUT_PATH;
  const allauthSchemaUrl =
    process.env.ALLAUTH_OPENAPI_SCHEMA_URL || DEFAULT_ALLAUTH_SCHEMA_URL;
  const allauthOutputPath =
    process.env.ALLAUTH_OPENAPI_CODEGEN_SCHEMA_PATH ||
    DEFAULT_ALLAUTH_OUTPUT_PATH;
  if (target !== 'allauth') {
    const schema = await loadSchema(schemaUrl);
    await writeSchema(outputPath, transformOpenApiTags(schema));
    console.log(`Prepared OpenAPI codegen schema: ${outputPath}`);
  }
  if (target !== 'django') {
    const allauthSchema = await loadSchema(allauthSchemaUrl);
    await writeSchema(allauthOutputPath, transformAllauthSchema(allauthSchema));
    console.log(`Prepared Allauth codegen schema: ${allauthOutputPath}`);
  }

  if (process.argv.includes('--run-max-openapi')) {
    const command = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const result = spawnSync(command, ['exec', '--', 'max', 'openapi'], {
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit',
      env: {
        ...process.env,
        OPENAPI_SCHEMA_PATH: outputPath,
        ALLAUTH_OPENAPI_SCHEMA_PATH: allauthOutputPath,
      },
    });

    if (result.error) {
      throw result.error;
    }
    if (typeof result.status === 'number' && result.status !== 0) {
      process.exitCode = result.status;
    }
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
