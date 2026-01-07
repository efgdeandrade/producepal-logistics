import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
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
    })),
    channel: vi.fn(() => ({
      on: vi.fn(() => ({
        subscribe: vi.fn(() => ({ unsubscribe: vi.fn() })),
      })),
    })),
  },
}));

// Mock Auth
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-user-id' },
  }),
}));

// Mock toast
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
  toast: vi.fn(),
}));

describe('NotificationCenter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should be importable', async () => {
    const module = await import('@/components/notifications/NotificationCenter');
    expect(module.NotificationCenter).toBeDefined();
  });

  it('should render without crashing', async () => {
    const { NotificationCenter } = await import('@/components/notifications/NotificationCenter');
    
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const { container } = render(
      React.createElement(QueryClientProvider, { client: queryClient },
        React.createElement(BrowserRouter, null,
          React.createElement(NotificationCenter)
        )
      )
    );
    
    expect(container).toBeDefined();
  });
});
