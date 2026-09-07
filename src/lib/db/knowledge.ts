import { getSql } from "@/lib/db/client";
import type { KnowledgeDoc, KnowledgeDocType } from "@/types";

function mapDoc(r: Record<string, unknown>): KnowledgeDoc {
  return {
    id: r.id as string,
    company_id: (r.company_id as string) ?? null,
    title: r.title as string,
    content: r.content as string,
    doc_type: r.doc_type as KnowledgeDocType,
    tags: (r.tags as string[]) ?? [],
    is_global: Boolean(r.is_global),
    created_by: (r.created_by as string) ?? null,
    metadata: (r.metadata as Record<string, unknown>) ?? {},
    created_at: String(r.created_at),
    updated_at: String(r.updated_at),
  };
}

export async function listKnowledgeDocs(opts?: {
  companyId?: string | null;
  docType?: KnowledgeDocType;
  includeGlobal?: boolean;
}): Promise<KnowledgeDoc[]> {
  const sql = getSql();
  const includeGlobal = opts?.includeGlobal !== false;

  if (opts?.companyId && opts?.docType) {
    const rows = includeGlobal
      ? await sql`
          SELECT * FROM knowledge_docs
          WHERE (company_id = ${opts.companyId} OR is_global = true)
            AND doc_type = ${opts.docType}
          ORDER BY updated_at DESC
        `
      : await sql`
          SELECT * FROM knowledge_docs
          WHERE company_id = ${opts.companyId} AND doc_type = ${opts.docType}
          ORDER BY updated_at DESC
        `;
    return rows.map((r) => mapDoc(r as Record<string, unknown>));
  }

  if (opts?.companyId) {
    const rows = includeGlobal
      ? await sql`
          SELECT * FROM knowledge_docs
          WHERE company_id = ${opts.companyId} OR is_global = true
          ORDER BY updated_at DESC
        `
      : await sql`
          SELECT * FROM knowledge_docs
          WHERE company_id = ${opts.companyId}
          ORDER BY updated_at DESC
        `;
    return rows.map((r) => mapDoc(r as Record<string, unknown>));
  }

  const rows = await sql`
    SELECT * FROM knowledge_docs
    WHERE is_global = true OR company_id IS NULL
    ORDER BY updated_at DESC
  `;
  return rows.map((r) => mapDoc(r as Record<string, unknown>));
}

export async function createKnowledgeDoc(input: {
  title: string;
  content: string;
  docType?: KnowledgeDocType;
  companyId?: string | null;
  isGlobal?: boolean;
  createdBy?: string | null;
  tags?: string[];
}): Promise<string> {
  const sql = getSql();
  const rows = await sql`
    INSERT INTO knowledge_docs (
      company_id, title, content, doc_type, tags, is_global, created_by
    ) VALUES (
      ${input.companyId ?? null},
      ${input.title},
      ${input.content},
      ${input.docType ?? "general"},
      ${input.tags ?? []},
      ${input.isGlobal ?? !input.companyId},
      ${input.createdBy ?? null}
    )
    RETURNING id
  `;
  return rows[0].id as string;
}

/** RAG-lite: keyword ILIKE retrieval for prompts. */
export async function searchKnowledge(
  query: string,
  companyId?: string | null,
  limit = 8
): Promise<KnowledgeDoc[]> {
  const sql = getSql();
  const q = `%${query.slice(0, 120)}%`;
  if (companyId) {
    const rows = await sql`
      SELECT * FROM knowledge_docs
      WHERE (company_id = ${companyId} OR is_global = true)
        AND (title ILIKE ${q} OR content ILIKE ${q})
      ORDER BY updated_at DESC
      LIMIT ${limit}
    `;
    return rows.map((r) => mapDoc(r as Record<string, unknown>));
  }
  const rows = await sql`
    SELECT * FROM knowledge_docs
    WHERE title ILIKE ${q} OR content ILIKE ${q}
    ORDER BY updated_at DESC
    LIMIT ${limit}
  `;
  return rows.map((r) => mapDoc(r as Record<string, unknown>));
}
