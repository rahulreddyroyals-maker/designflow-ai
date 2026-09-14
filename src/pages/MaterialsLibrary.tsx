export default function MaterialsLibraryPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold">Materials</h1>
      <p className="text-muted-foreground mt-2">
        Company-wide materials catalog — coming in a later sprint. Per-project material boards
        already have a route at <code>/projects/:id/materials</code>.
      </p>
    </div>
  );
}
