import { getSql } from "@/lib/db/client";
import type { CustomFieldDefinition } from "@/types";

export async function listCustomFields(
  companyId: string,
  objectType?: string
): Promise<CustomFieldDefinition[]> {
  const sql = getSql();
  const rows = objectType
    ? await sql`
        SELECT * FROM custom_field_definitions
        WHERE company_id = ${companyId} AND object_type = ${objectType}
        ORDER BY position ASC
      `
    : await sql`
        SELECT * FROM custom_field_definitions
        WHERE company_id = ${companyId}
        ORDER BY object_type, position ASC
      `;
  return rows.map((r) => ({
    id: r.id as string,
    company_id: r.company_id as string,
    object_type: r.object_type as string,
    field_key: r.field_key as string,
    label: r.label as string,
    field_type: (r.field_type as string) ?? "text",
    options: (r.options as unknown[]) ?? [],
    is_required: Boolean(r.is_required),
    position: Number(r.position ?? 0),
    created_at: String(r.created_at),
  }));
}

export async function createCustomField(input: {
  companyId: string;
  objectType: string;
  fieldKey: string;
  label: string;
  fieldType?: string;
  options?: unknown[];
  isRequired?: boolean;
}): Promise<string> {
  const sql = getSql();
  const rows = await sql`
    INSERT INTO custom_field_definitions (
      company_id, object_type, field_key, label, field_type, options, is_required
    ) VALUES (
      ${input.companyId},
      ${input.objectType},
      ${input.fieldKey},
      ${input.label},
      ${input.fieldType ?? "text"},
      ${JSON.stringify(input.options ?? [])}::jsonb,
      ${input.isRequired ?? false}
    )
    RETURNING id
  `;
  return rows[0].id as string;
}

export async function setCustomFieldValue(
  definitionId: string,
  recordId: string,
  value: string
): Promise<void> {
  const sql = getSql();
  await sql`
    INSERT INTO custom_field_values (definition_id, record_id, value)
    VALUES (${definitionId}, ${recordId}, ${value})
    ON CONFLICT (definition_id, record_id) DO UPDATE SET
      value = EXCLUDED.value,
      updated_at = now()
  `;
}

export async function getCustomFieldValues(
  recordId: string
): Promise<Array<{ definition_id: string; value: string | null; label: string; field_key: string }>> {
  const sql = getSql();
  const rows = await sql`
    SELECT v.definition_id, v.value, d.label, d.field_key
    FROM custom_field_values v
    JOIN custom_field_definitions d ON d.id = v.definition_id
    WHERE v.record_id = ${recordId}
  `;
  return rows.map((r) => ({
    definition_id: r.definition_id as string,
    value: (r.value as string) ?? null,
    label: r.label as string,
    field_key: r.field_key as string,
  }));
}
