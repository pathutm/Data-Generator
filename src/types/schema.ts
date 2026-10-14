// ─── Consolidated Schema Output Types ────────────────────────────

export interface ColumnSourceReference {
  dataset: string;
  table: string;
  column: string;
  confidence?: number;
  notes?: string;
}

export interface ConsolidatedColumn {
  id: string;
  name: string;
  data_type: string;
  is_primary_key?: boolean;
  is_foreign_key?: boolean;
  description?: string;
  sources: ColumnSourceReference[];
  confidence?: number;
  notes?: string;
}

export interface ConsolidatedEntity {
  id: string;
  name: string;
  description?: string;
  columns: ConsolidatedColumn[];
  primary_keys?: string[];
  source_tables?: { dataset: string; table: string }[];
  tags?: string[];
}

export interface ConsolidatedRelationship {
  id: string;
  // Source endpoint
  source_entity: string;
  source_column: string;
  source_dataset?: string;
  source_table?: string;
  // Target endpoint
  target_entity: string;
  target_column: string;
  target_dataset?: string;
  target_table?: string;
  // Metadata
  type: string; // '1:1' | '1:N' | 'N:1' | 'N:M' | 'foreign_key' | 'many_to_one' | 'one_to_many' etc.
  status: 'confirmed' | 'uncertain' | 'inferred' | 'suggested';
  reason?: string;
  confidence?: number;
  is_mapped_to_entities: boolean;
}

export interface SourceMapping {
  id: string;
  concept: string;
  target_entity?: string;
  target_column?: string;
  sources: ColumnSourceReference[];
  status: 'confirmed' | 'inferred' | 'uncertain' | 'pending';
  confidence?: number;
  notes?: string;
}

export interface SchemaUncertainty {
  id: string;
  type: string;
  sources: ColumnSourceReference[];
  explanation: string;
  severity?: 'low' | 'medium' | 'high';
  suggested_action?: string;
}

export interface SchemaSummary {
  total_entities: number;
  total_columns: number;
  total_relationships: number;
  mapped_relationships: number;
  unresolved_relationships: number;
  confirmed_relationships: number;
  uncertain_relationships: number;
  uncertain_mappings: number;
}

export interface ConsolidatedSchema {
  raw_response: unknown;
  received_at: string;
  entities: ConsolidatedEntity[];
  relationships: ConsolidatedRelationship[];
  source_mappings: SourceMapping[];
  uncertainties: SchemaUncertainty[];
  summary: SchemaSummary;
  source_datasets: string[];
}
