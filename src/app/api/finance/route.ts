export async function GET() {
  return Response.json(
    {
      ok: false,
      error: "Finance endpoint is not implemented yet."
    },
    { status: 501 }
  );
}
