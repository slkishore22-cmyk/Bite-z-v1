// Lightweight skeleton loaders used while the user app fetches first-time data.
// All blocks use the global `.bitez-skeleton` shimmer defined in index.css.

const Bar = ({
  width = "100%",
  height = 14,
  radius = 8,
  className = "",
}: {
  width?: number | string;
  height?: number | string;
  radius?: number;
  className?: string;
}) => (
  <div
    className={`bitez-skeleton ${className}`}
    style={{ width, height, borderRadius: radius }}
  />
);

/* Canteen list skeleton (Home → "Pick a Spot?") */
export const CanteenListSkeleton = ({ rows = 3 }: { rows?: number }) => (
  <div className="flex flex-col gap-3" style={{ paddingLeft: 24, paddingRight: 24 }}>
    {Array.from({ length: rows }).map((_, i) => (
      <div
        key={i}
        className="cb-glass flex items-center gap-3"
        style={{ padding: 16, borderRadius: 22 }}
      >
        <div className="bitez-skeleton" style={{ width: 48, height: 48, borderRadius: 999 }} />
        <div className="flex-1 flex flex-col gap-2">
          <Bar width="55%" height={14} />
          <Bar width="80%" height={11} />
        </div>
      </div>
    ))}
  </div>
);

/* Menu / food cards skeleton */
export const MenuItemsSkeleton = ({ rows = 5 }: { rows?: number }) => (
  <div className="flex flex-col gap-3">
    {Array.from({ length: rows }).map((_, i) => (
      <div
        key={i}
        className="cb-glass flex items-center gap-3"
        style={{ padding: 14, borderRadius: 22 }}
      >
        <div className="bitez-skeleton" style={{ width: 44, height: 44, borderRadius: 14 }} />
        <div className="flex-1 flex flex-col gap-2">
          <Bar width="60%" height={14} />
          <Bar width="35%" height={11} />
        </div>
        <div className="bitez-skeleton" style={{ width: 64, height: 28, borderRadius: 999 }} />
      </div>
    ))}
  </div>
);

/* Order list skeleton */
export const OrderListSkeleton = ({ rows = 3 }: { rows?: number }) => (
  <div className="flex flex-col gap-3">
    {Array.from({ length: rows }).map((_, i) => (
      <div
        key={i}
        className="cb-glass flex flex-col gap-3"
        style={{ padding: 16, borderRadius: 22 }}
      >
        <div className="flex items-center gap-3">
          <div className="bitez-skeleton" style={{ width: 36, height: 36, borderRadius: 999 }} />
          <Bar width="40%" height={13} />
          <div className="flex-1" />
          <Bar width={60} height={13} />
        </div>
        <Bar width="85%" height={11} />
      </div>
    ))}
  </div>
);