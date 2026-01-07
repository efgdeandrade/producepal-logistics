import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';

interface ErrorFallbackProps {
  error: Error | null;
  onReset?: () => void;
}

export function ErrorFallback({ error, onReset }: ErrorFallbackProps) {
  const navigate = useNavigate();

  return (
    <div className="min-h-[400px] flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <CardTitle>Something went wrong</CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-muted-foreground">
            {error?.message || 'An unexpected error occurred. Please try again.'}
          </p>
          {process.env.NODE_ENV === 'development' && error?.stack && (
            <pre className="mt-4 p-3 bg-muted rounded-md text-xs text-left overflow-auto max-h-32">
              {error.stack}
            </pre>
          )}
        </CardContent>
        <CardFooter className="flex gap-2 justify-center">
          {onReset && (
            <Button onClick={onReset} variant="default">
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          )}
          <Button onClick={() => navigate('/')} variant="outline">
            <Home className="h-4 w-4 mr-2" />
            Go Home
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
