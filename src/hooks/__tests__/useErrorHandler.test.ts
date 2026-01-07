import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

// Mock toast
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
  toast: vi.fn(),
}));

describe('useErrorHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should be importable', async () => {
    const module = await import('@/hooks/useErrorHandler');
    expect(module.useErrorHandler).toBeDefined();
    expect(module.formatErrorMessage).toBeDefined();
  });

  it('should execute async function successfully', async () => {
    const { useErrorHandler } = await import('@/hooks/useErrorHandler');
    
    const { result } = renderHook(() => useErrorHandler<string>());
    
    const successFn = async () => 'success';
    const response = await result.current.execute(successFn);
    
    expect(response).toBe('success');
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('should handle errors and set error state', async () => {
    const { useErrorHandler } = await import('@/hooks/useErrorHandler');
    
    const { result } = renderHook(() => useErrorHandler<string>({ showToast: false }));
    
    const errorFn = async () => {
      throw new Error('Test error');
    };
    
    const response = await result.current.execute(errorFn);
    
    expect(response).toBeNull();
    expect(result.current.error?.message).toBe('Test error');
  });

  it('should reset error state', async () => {
    const { useErrorHandler } = await import('@/hooks/useErrorHandler');
    
    const { result } = renderHook(() => useErrorHandler<string>({ showToast: false }));
    
    // First, cause an error
    await result.current.execute(async () => {
      throw new Error('Test error');
    });
    
    expect(result.current.error).not.toBeNull();
    
    // Then reset
    result.current.reset();
    
    expect(result.current.error).toBeNull();
  });
});

describe('formatErrorMessage', () => {
  it('should format Error objects', async () => {
    const { formatErrorMessage } = await import('@/hooks/useErrorHandler');
    
    expect(formatErrorMessage(new Error('Test'))).toBe('Test');
  });

  it('should format string errors', async () => {
    const { formatErrorMessage } = await import('@/hooks/useErrorHandler');
    
    expect(formatErrorMessage('String error')).toBe('String error');
  });

  it('should format objects with message property', async () => {
    const { formatErrorMessage } = await import('@/hooks/useErrorHandler');
    
    expect(formatErrorMessage({ message: 'Object error' })).toBe('Object error');
  });

  it('should return default message for unknown errors', async () => {
    const { formatErrorMessage } = await import('@/hooks/useErrorHandler');
    
    expect(formatErrorMessage(null)).toBe('An unexpected error occurred');
    expect(formatErrorMessage(undefined)).toBe('An unexpected error occurred');
    expect(formatErrorMessage({})).toBe('An unexpected error occurred');
  });
});
