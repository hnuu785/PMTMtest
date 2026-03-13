import { generateRapDraft } from "@/lib/rap-generation";

export async function POST(request) {
  const body = await request.json();
  const draft = await generateRapDraft(body);
  return Response.json(draft);
}
