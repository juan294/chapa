const SECURITY_TXT = `Contact: mailto:support@chapa.thecreativetoken.com
Expires: 2027-02-17T00:00:00.000Z
Preferred-Languages: en, es
Canonical: https://chapa.thecreativetoken.com/.well-known/security.txt
Policy: https://chapa.thecreativetoken.com/terms
`;

export function GET(): Response {
  return new Response(SECURITY_TXT, {
    status: 200,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}
