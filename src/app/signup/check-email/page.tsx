export const metadata = { title: "Check your email" };

export default function CheckEmail() {
  return (
    <div className="mx-auto max-w-sm space-y-3 py-10 text-center">
      <h1 className="text-2xl font-bold">Check your email 📬</h1>
      <p className="text-muted">
        We sent you a confirmation link. Open it on this device to finish signing up – you&apos;ll land straight in your
        group.
      </p>
    </div>
  );
}
