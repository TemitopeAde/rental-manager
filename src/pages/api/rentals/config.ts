import type { APIRoute } from 'astro';
import { loadSettings } from '../../../rental/availability';
import { json } from '../../../rental/http';

export const GET: APIRoute = async () => {
  const settings = await loadSettings({ elevate: true });
  return json({
    language: settings.language || 'en',
    currency: settings.currency || 'USD',
  });
};

