import Link from 'next/link';

export default function DashboardNotFound() {
  return (
    <div className="panel p-8 text-center max-w-md mx-auto">
      <p className="font-semibold">Not found</p>
      <p className="muted text-sm mt-1">It may have been deleted.</p>
      <Link className="btn mt-4" href="/dashboard/guests">Back to guests</Link>
    </div>
  );
}
