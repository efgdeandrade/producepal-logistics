const LoadingBox = () => {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <div className="relative inline-block">
          <img 
            src="/logo.png" 
            alt="FUIK Logo" 
            className="w-24 h-24 animate-spin"
            style={{ animationDuration: '2s' }}
          />
        </div>
        <p className="text-xl text-muted-foreground mt-8">Loading...</p>
      </div>
    </div>
  );
};

export default LoadingBox;
