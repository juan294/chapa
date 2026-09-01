const CLAIM = {
  $schema: "https://glama.ai/mcp/schemas/connector.json",
  claim: "glama_claim_tNcnAmUfI8iOL5RmYytRi2DInoYveyVb",
} as const;

export function GET(): Response {
  return Response.json(CLAIM, {
    status: 200,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
  });
}
