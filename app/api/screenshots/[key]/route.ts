export async function GET(_: Request, context: { params: Promise<{ key: string }> }) {
  await context.params;
  return new Response("Not found", { status: 404 });
}
