import Uploader from '@/components/admin/Uploader';
import { requireUser } from '@/lib/auth';
import { col } from '@/lib/db';

export default async function UploadPage() {
  await requireUser('super');
  const existing = await (await col('guests')).find({}, { projection: { name: 1, phone: 1 } }).toArray();
  return (
    <div className="max-w-4xl space-y-4">
      <div>
        <h1>Upload the guest list</h1>
        <p className="muted text-sm">Every guest gets their own invitation link. Uploading again only adds the new guests.</p>
      </div>
      <Uploader existingKeys={existing.map((g) => g.name.toLowerCase() + '|' + g.phone)} existingPhones={[...new Set(existing.map((g) => g.phone))]} />
    </div>
  );
}
