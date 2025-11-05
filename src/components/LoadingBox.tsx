import fuikLogo from '@/assets/logo.png';

const LoadingBox = () => {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <div className="relative inline-block">
          {/* Box animation container */}
          <div className="box-animation">
            {/* Box lid */}
            <div className="box-lid"></div>
            {/* Box body */}
            <div className="box-body"></div>
            {/* FUIK Logo */}
            <div className="logo-falling">
              <img src={fuikLogo} alt="FUIK Logo" className="w-16 h-16" />
            </div>
          </div>
        </div>
        <p className="text-xl text-muted-foreground mt-8">Loading...</p>
      </div>

      <style>{`
        .box-animation {
          position: relative;
          width: 120px;
          height: 120px;
          perspective: 1000px;
        }

        .box-body {
          position: absolute;
          width: 100px;
          height: 80px;
          bottom: 0;
          left: 10px;
          background: linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.7));
          border: 3px solid hsl(var(--primary-foreground) / 0.2);
          border-radius: 4px;
          animation: box-pulse 3s ease-in-out infinite;
        }

        .box-lid {
          position: absolute;
          width: 100px;
          height: 20px;
          top: 20px;
          left: 10px;
          background: linear-gradient(135deg, hsl(var(--primary) / 0.9), hsl(var(--primary) / 0.6));
          border: 3px solid hsl(var(--primary-foreground) / 0.2);
          border-radius: 4px;
          transform-origin: bottom;
          animation: lid-open 3s ease-in-out infinite;
          z-index: 10;
        }

        .logo-falling {
          position: absolute;
          top: -20px;
          left: 32px;
          opacity: 0;
          animation: logo-fall 3s ease-in-out infinite;
          z-index: 5;
        }

        @keyframes lid-open {
          0%, 100% {
            transform: rotateX(0deg);
            top: 20px;
          }
          15%, 65% {
            transform: rotateX(-120deg);
            top: 0px;
          }
          80% {
            transform: rotateX(0deg);
            top: 20px;
          }
        }

        @keyframes logo-fall {
          0% {
            opacity: 0;
            transform: translateY(-40px) scale(0.5);
          }
          15% {
            opacity: 1;
            transform: translateY(-40px) scale(0.5);
          }
          45% {
            opacity: 1;
            transform: translateY(40px) scale(0.6);
          }
          50% {
            opacity: 0.8;
            transform: translateY(40px) scale(0.6);
          }
          65% {
            opacity: 0;
            transform: translateY(40px) scale(0.4);
          }
          100% {
            opacity: 0;
            transform: translateY(40px) scale(0.4);
          }
        }

        @keyframes box-pulse {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(0.98);
          }
        }
      `}</style>
    </div>
  );
};

export default LoadingBox;
