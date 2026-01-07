import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// Mock Supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => Promise.resolve({ data: [], error: null })),
        })),
        order: vi.fn(() => Promise.resolve({ data: [], error: null })),
      })),
      insert: vi.fn(() => Promise.resolve({ data: null, error: null })),
      update: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ data: null, error: null })),
      })),
      delete: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ data: null, error: null })),
      })),
    })),
  },
}));

// Create wrapper for React Query
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) => {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
  return Wrapper;
};

describe('useIntegrations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should be importable', async () => {
    const module = await import('@/hooks/useIntegrations');
    expect(module.useIntegrations).toBeDefined();
    expect(module.useWebhooks).toBeDefined();
  });

  it('should return integrations array', async () => {
    const { useIntegrations } = await import('@/hooks/useIntegrations');
    const wrapper = createWrapper();
    
    const { result } = renderHook(() => useIntegrations(), { wrapper });
    
    expect(result.current.integrations).toBeDefined();
    expect(Array.isArray(result.current.integrations)).toBe(true);
  });
});

describe('useWebhooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should be importable', async () => {
    const module = await import('@/hooks/useIntegrations');
    expect(module.useWebhooks).toBeDefined();
  });

  it('should return webhooks array', async () => {
    const { useWebhooks } = await import('@/hooks/useIntegrations');
    const wrapper = createWrapper();
    
    const { result } = renderHook(() => useWebhooks(), { wrapper });
    
    expect(result.current.webhooks).toBeDefined();
    expect(Array.isArray(result.current.webhooks)).toBe(true);
  });
});
