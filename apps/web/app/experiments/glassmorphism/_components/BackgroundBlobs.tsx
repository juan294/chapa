/* ------------------------------------------------------------------ */
/*  Background Blobs                                                   */
/* ------------------------------------------------------------------ */
export function BackgroundBlobs({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {/* Large amber blob, top-left area */}
      <div
        className="absolute rounded-full"
        style={{
          top: "5%",
          left: "20%",
          width: "24rem",
          height: "24rem",
          background: "var(--color-amber)",
          opacity: 0.08,
          filter: "blur(100px)",
        }}
      />
      {/* Lighter blob, bottom-right */}
      <div
        className="absolute rounded-full"
        style={{
          bottom: "15%",
          right: "20%",
          width: "20rem",
          height: "20rem",
          background: "var(--color-amber-light)",
          opacity: 0.06,
          filter: "blur(120px)",
        }}
      />
      {/* Dark amber blob, center */}
      <div
        className="absolute rounded-full"
        style={{
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "500px",
          height: "300px",
          background: "var(--color-amber-dark)",
          opacity: 0.05,
          filter: "blur(150px)",
        }}
      />
      {/* Extra blob for depth, lower-left */}
      <div
        className="absolute rounded-full"
        style={{
          bottom: "30%",
          left: "10%",
          width: "18rem",
          height: "18rem",
          background: "var(--color-amber)",
          opacity: 0.04,
          filter: "blur(130px)",
        }}
      />
    </div>
  );
}
