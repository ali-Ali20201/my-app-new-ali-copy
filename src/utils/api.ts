import { Capacitor } from '@capacitor/core';

const backendUrl = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' ? window.location.origin : '');

export const apiFetch = async (resource: RequestInfo | URL, config?: RequestInit): Promise<Response> => {
  if (Capacitor.isNativePlatform()) {
    if (typeof resource === 'string' && resource.startsWith('/api/')) {
      resource = `${backendUrl}${resource}`;
    } else if (resource instanceof Request && resource.url.startsWith(window.location.origin + '/api/')) {
      const newUrl = resource.url.replace(window.location.origin, backendUrl);
      resource = new Request(newUrl, resource);
    } else if (resource instanceof URL && resource.pathname.startsWith('/api/')) {
      resource = new URL(resource.pathname + resource.search, backendUrl);
    }
  }
  return window.fetch(resource, config);
};
