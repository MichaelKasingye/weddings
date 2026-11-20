/** Name / phone / seats inputs, shared by "Add guest" and "Edit guest". */
export default function GuestFields({ name = '', phone = '', seats }: { name?: string; phone?: string; seats?: number }) {
  return (
    <>
      <div>
        <label className="label" htmlFor="name">Name on the invitation</label>
        <input className="input" id="name" name="name" defaultValue={name} required maxLength={80} placeholder="e.g. Mr. & Mrs. John Doe" />
        <p className="muted text-xs mt-1">Shown exactly as typed on the guest bar of the invitation.</p>
      </div>
      <div>
        <label className="label" htmlFor="phone">Phone (WhatsApp)</label>
        <input className="input" id="phone" name="phone" defaultValue={phone} required inputMode="tel" placeholder="0772 123456 or +256 772 123456" />
      </div>
      <div>
        <label className="label" htmlFor="seats">Seats (invite for how many people)</label>
        <input className="input" id="seats" name="seats" type="number" min={1} max={20} defaultValue={seats} placeholder="Leave empty: 2 for “Mr. & Mrs.”, otherwise 1" />
      </div>
    </>
  );
}
