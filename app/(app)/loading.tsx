export default function Loading() {
  return (
    <div aria-busy="true" className="anim-fade">
      <div className="skeleton mb-2 h-7 w-48" />
      <div className="skeleton mb-6 h-4 w-80" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-24 rounded-2xl" />)}
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <div className="skeleton h-72 rounded-2xl lg:col-span-2" />
        <div className="skeleton h-72 rounded-2xl" />
      </div>
    </div>
  );
}
