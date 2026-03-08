/**
 * Server configuration from environment variables.
 */

// Load .env file in development
if (process.env.NODE_ENV !== 'production') {
  const { config: dotenvConfig } = await import('dotenv');
  dotenvConfig();
}

export const config = {
  port: parseInt(process.env.PORT || '3008', 10),
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
};

export function isLLMEnabled(): boolean {
  return !!config.anthropicApiKey;
}

export const dbConfig = {
  connectionString:
    process.env.DATABASE_URL ||
    'postgresql://deckhand:deckhand@localhost:5433/deckhand',
};

export const s3Config = {
  endpoint: process.env.S3_ENDPOINT || 'http://localhost:8333',
  accessKeyId: process.env.S3_ACCESS_KEY || 'deckhand-dev-key',
  secretAccessKey: process.env.S3_SECRET_KEY || 'deckhand-dev-secret',
  bucket: process.env.S3_BUCKET || 'deckhand-assets',
  region: process.env.S3_REGION || 'us-east-1',
};

export const oryConfig = {
  kratosPublicUrl: process.env.KRATOS_PUBLIC_URL || 'http://localhost:4433',
  kratosAdminUrl: process.env.KRATOS_ADMIN_URL || 'http://localhost:4434',
  hydraPublicUrl: process.env.HYDRA_PUBLIC_URL || 'http://localhost:4444',
  hydraAdminUrl: process.env.HYDRA_ADMIN_URL || 'http://localhost:4445',
  publicUrl: process.env.PUBLIC_URL || 'http://localhost:5178',
};
