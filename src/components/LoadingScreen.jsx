import OrbitLoader from './OrbitLoader';

const LoadingScreen = ({ fadeOut = false, size = 88 }) => {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: fadeOut ? 0 : 1,
        transition: 'opacity 0.3s ease',
        pointerEvents: 'none',
      }}
    >
      <OrbitLoader size={size} />
    </div>
  );
};

export default LoadingScreen;