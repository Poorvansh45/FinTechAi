const DEFAULT_BACKEND_URL = 'http://localhost:8080';
const DEFAULT_FASTAPI_URL = 'http://localhost:8000';

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

export const env = {
  backendApiUrl: trimTrailingSlash(
    process.env.NEXT_PUBLIC_API_BASE_URL ||
      process.env.NEXT_PUBLIC_BACKEND_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      DEFAULT_BACKEND_URL
  ),
  fastapiUrl: trimTrailingSlash(
    process.env.NEXT_PUBLIC_FASTAPI_URL || DEFAULT_FASTAPI_URL
  ),
  firebase: {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
  },
};

export function requirePublicEnv(name: keyof typeof env.firebase): string {
  const value = env.firebase[name];
  if (!value) {
    throw new Error(`Missing public environment variable for Firebase: ${String(name)}`);
  }
  return value;
}
