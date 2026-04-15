/**
 * Server configuration from environment variables.
 */

// Load .env file in development
if (process.env.NODE_ENV !== 'production') {
  const { config: dotenvConfig } = await import('dotenv');
  dotenvConfig();
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  port: parseInt(process.env.PORT || '3008', 10),
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
};

export function isLLMEnabled(): boolean {
  return !!config.anthropicApiKey;
}

export const dbConfig = {
  get connectionString(): string {
    return requireEnv('DATABASE_URL');
  },
};

export const s3Config = {
  endpoint: process.env.S3_ENDPOINT || 'http://localhost:8333',
  get accessKeyId(): string {
    return requireEnv('S3_ACCESS_KEY');
  },
  get secretAccessKey(): string {
    return requireEnv('S3_SECRET_KEY');
  },
  bucket: process.env.S3_BUCKET || 'deckhand-assets',
  region: process.env.S3_REGION || 'us-east-1',
};

export const allowedOrigins: string[] = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(s => s.trim())
  : ['http://localhost:5173', 'http://localhost:5178'];

export const oryConfig = {
  kratosPublicUrl: process.env.KRATOS_PUBLIC_URL || 'http://localhost:4433',
  kratosAdminUrl: process.env.KRATOS_ADMIN_URL || 'http://localhost:4434',
  hydraPublicUrl: process.env.HYDRA_PUBLIC_URL || 'http://localhost:4444',
  hydraAdminUrl: process.env.HYDRA_ADMIN_URL || 'http://localhost:4445',
};
