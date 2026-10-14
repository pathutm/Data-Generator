import type {
  ConsolidatedSchema,
  ConsolidatedEntity,
  ConsolidatedColumn,
  ConsolidatedRelationship,
  SourceMapping,
  SchemaUncertainty,
  ColumnSourceReference,
} from '../types/schema';

/**
 * Robustly extract JSON object from raw response (which could be string, object, array, or nested).
 */
export function extractJsonObject(input: unknown): Record<string, unknown> | null {
  if (!input) return null;

  let current: unknown = input;

  // If input is a string, attempt parsing JSON (handling possible markdown fences)
  if (typeof current === 'string') {
    const trimmed = current.trim();
    // Strip markdown code fences if present (e.g. ```json ... ```)
    const jsonMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    const textToParse = jsonMatch ? jsonMatch[1] : trimmed;
    try {
      current = JSON.parse(textToParse);
    } catch {
      return null;
    }
  }

  // If input is an array
  if (Array.isArray(current)) {
    if (current.length === 0) return null;
    // Check first item
    const first = current[0];
    if (typeof first === 'object' && first !== null) {
      current = first;
    } else {
      return null;
    }
  }

  // If input has nested .json property (common in n8n output)
  if (typeof current === 'object' && current !== null) {
    const obj = current as Record<string, unknown>;
    if (obj.json && typeof obj.json === 'object' && obj.json !== null) {
      current = obj.json;
    } else if (obj.data && typeof obj.data === 'object' && obj.data !== null && !Array.isArray(obj.data) && !('entities' in obj)) {
      current = obj.data;
    } else if (obj.schema && typeof obj.schema === 'object' && obj.schema !== null && !Array.isArray(obj.schema) && !('entities' in obj)) {
      current = obj.schema;
    } else if (obj.result && typeof obj.result === 'object' && obj.result !== null && !Array.isArray(obj.result) && !('entities' in obj)) {
      current = obj.result;
    } else if (obj.output && typeof obj.output === 'object' && obj.output !== null && !Array.isArray(obj.output) && !('entities' in obj)) {
      current = obj.output;
    }
  }

  if (typeof current === 'object' && current !== null && !Array.isArray(current)) {
    return current as Record<string, unknown>;
  }

  return null;
}

/**
 * Parse a source reference representation into a structured ColumnSourceReference.
 */
export function parseSourceReference(raw: unknown): ColumnSourceReference | null {
  if (!raw) return null;

  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return null;

    // Check arrow separators
    if (trimmed.includes('->') || trimmed.includes('➔') || trimmed.includes('>')) {
      const parts = trimmed.split(/->|➔|>/).map((s) => s.trim()).filter(Boolean);
      if (parts.length >= 3) {
        return { dataset: parts[0], table: parts[1], column: parts[2] };
      } else if (parts.length === 2) {
        return { dataset: '', table: parts[0], column: parts[1] };
      } else if (parts.length === 1) {
        return { dataset: '', table: '', column: parts[0] };
      }
    }

    // Check slash separators
    if (trimmed.includes('/')) {
      const parts = trimmed.split('/').map((s) => s.trim()).filter(Boolean);
      if (parts.length >= 3) {
        return { dataset: parts[0], table: parts[1], column: parts[2] };
      } else if (parts.length === 2) {
        return { dataset: '', table: parts[0], column: parts[1] };
      }
    }

    // Check for .csv pattern: [dataset.]table.csv.column
    const csvMatch = trimmed.match(/^(?:(.*?)\.)?([^.]+\.csv)\.(.+)$/i);
    if (csvMatch) {
      return {
        dataset: csvMatch[1]?.trim() || '',
        table: csvMatch[2]?.trim() || '',
        column: csvMatch[3]?.trim() || '',
      };
    }

    const dotParts = trimmed.split('.').map((s) => s.trim()).filter(Boolean);
    if (dotParts.length === 3) {
      return { dataset: dotParts[0], table: dotParts[1], column: dotParts[2] };
    } else if (dotParts.length === 2) {
      return { dataset: '', table: dotParts[0], column: dotParts[1] };
    } else if (dotParts.length === 1) {
      return { dataset: '', table: '', column: dotParts[0] };
    }
    return { dataset: '', table: '', column: trimmed };
  }

  if (typeof raw === 'object' && raw !== null) {
    const obj = raw as Record<string, unknown>;
    const dataset = String(obj.dataset_name || obj.dataset || obj.dataset_id || obj.datasetId || '').trim();
    const table = String(obj.table_name || obj.table || obj.source_table || obj.tableName || obj.file || '').trim();
    const column = String(obj.column_name || obj.column || obj.source_column || obj.columnName || obj.field || '').trim();
    const confidence = typeof obj.confidence === 'number' ? obj.confidence : undefined;
    const notes = typeof obj.notes === 'string' ? obj.notes : typeof obj.reason === 'string' ? obj.reason : undefined;

    if (dataset || table || column) {
      return { dataset, table, column, confidence, notes };
    }
  }

  return null;
}

// ─── Relationship Endpoint Parser & Resolver ───────────────────

export interface ParsedEndpoint {
  dataset: string;
  table: string;
  column: string;
  rawText: string;
}

export function parseRelationshipEndpoint(raw: unknown): ParsedEndpoint {
  if (!raw) return { dataset: '', table: '', column: '', rawText: '' };

  if (typeof raw === 'object' && raw !== null) {
    const obj = raw as Record<string, unknown>;
    const dataset = String(obj.dataset_name || obj.dataset || obj.dataset_id || obj.datasetId || '').trim();
    const table = String(obj.table_name || obj.table || obj.source_table || obj.tableName || obj.entity || obj.entity_name || '').trim();
    const column = String(obj.column_name || obj.column || obj.source_column || obj.columnName || obj.field || '').trim();
    const rawText = `${dataset ? dataset + '.' : ''}${table ? table + '.' : ''}${column}`;
    return { dataset, table, column, rawText };
  }

  const str = String(raw).trim();
  if (!str) return { dataset: '', table: '', column: '', rawText: '' };

  // Check arrow separators: e.g. "DATASET 1 -> supplier_invoices -> po_id"
  if (str.includes('->') || str.includes('➔') || str.includes('>')) {
    const parts = str.split(/->|➔|>/).map((s) => s.trim()).filter(Boolean);
    if (parts.length >= 3) {
      return { dataset: parts[0], table: parts[1], column: parts[2], rawText: str };
    } else if (parts.length === 2) {
      return { dataset: '', table: parts[0], column: parts[1], rawText: str };
    }
  }

  // Check slash separators: e.g. "DATASET 1/supplier_invoices/po_id"
  if (str.includes('/')) {
    const parts = str.split('/').map((s) => s.trim()).filter(Boolean);
    if (parts.length >= 3) {
      return { dataset: parts[0], table: parts[1], column: parts[2], rawText: str };
    } else if (parts.length === 2) {
      return { dataset: '', table: parts[0], column: parts[1], rawText: str };
    }
  }

  // Check for .csv pattern in string: e.g. "DATASET 1.supplier_invoices.csv.po_id"
  const csvMatch = str.match(/^(?:(.*?)\.)?([^.]+\.csv)\.(.+)$/i);
  if (csvMatch) {
    return {
      dataset: csvMatch[1]?.trim() || '',
      table: csvMatch[2]?.trim() || '',
      column: csvMatch[3]?.trim() || '',
      rawText: str,
    };
  }

  // Split by dot
  const dotParts = str.split('.').map((s) => s.trim()).filter(Boolean);
  if (dotParts.length >= 4) {
    if (dotParts[2].toLowerCase() === 'csv') {
      return { dataset: dotParts[0], table: `${dotParts[1]}.csv`, column: dotParts.slice(3).join('.'), rawText: str };
    }
    return { dataset: dotParts[0], table: dotParts[1], column: dotParts.slice(2).join('.'), rawText: str };
  } else if (dotParts.length === 3) {
    return { dataset: dotParts[0], table: dotParts[1], column: dotParts[2], rawText: str };
  } else if (dotParts.length === 2) {
    return { dataset: '', table: dotParts[0], column: dotParts[1], rawText: str };
  } else if (dotParts.length === 1) {
    return { dataset: '', table: dotParts[0], column: '', rawText: str };
  }

  return { dataset: '', table: str, column: '', rawText: str };
}

export function resolveEndpointToEntity(
  rawEndpoint: unknown,
  entities: ConsolidatedEntity[]
): {
  entityName: string;
  columnName: string;
  sourceDataset: string;
  sourceTable: string;
  sourceColumn: string;
  isResolved: boolean;
  unresolvedReason?: string;
} {
  const parsed = parseRelationshipEndpoint(rawEndpoint);
  const cleanT = (t: string) => t.trim().toLowerCase().replace(/\.csv$/i, '');
  const cleanD = (d: string) => d.trim().toLowerCase();
  const cleanC = (c: string) => c.trim().toLowerCase();

  const targetTableClean = cleanT(parsed.table);
  const targetColClean = cleanC(parsed.column);
  const targetDsClean = cleanD(parsed.dataset);

  // 1. Direct match with consolidated entity name
  const directEntity = entities.find(
    (e) => cleanT(e.name) === targetTableClean || e.name.toLowerCase() === parsed.table.toLowerCase()
  );
  if (directEntity) {
    const col = directEntity.columns.find((c) => cleanC(c.name) === targetColClean);
    if (col) {
      return {
        entityName: directEntity.name,
        columnName: col.name,
        sourceDataset: parsed.dataset,
        sourceTable: parsed.table,
        sourceColumn: parsed.column || col.name,
        isResolved: true,
      };
    }
  }

  // 2. Search through every entity's columns and their source_columns (sources)
  // Match using all three fields: dataset_name, table_name, and column_name
  const matches: { entity: ConsolidatedEntity; column: ConsolidatedColumn; source: ColumnSourceReference }[] = [];

  for (const entity of entities) {
    for (const col of entity.columns) {
      for (const src of col.sources) {
        const srcTableClean = cleanT(src.table);
        const srcColClean = cleanC(src.column);
        const srcDsClean = cleanD(src.dataset);

        const colMatches = srcColClean === targetColClean;
        const tableMatches = srcTableClean === targetTableClean;
        const dsMatches = !targetDsClean || !srcDsClean || srcDsClean === targetDsClean;

        if (colMatches && tableMatches && dsMatches) {
          matches.push({ entity, column: col, source: src });
        }
      }
    }
  }

  if (matches.length === 1) {
    return {
      entityName: matches[0].entity.name,
      columnName: matches[0].column.name,
      sourceDataset: matches[0].source.dataset || parsed.dataset,
      sourceTable: matches[0].source.table || parsed.table,
      sourceColumn: matches[0].source.column || parsed.column,
      isResolved: true,
    };
  }

  if (matches.length > 1) {
    // If multiple matches, see if one is an exact dataset match
    if (targetDsClean) {
      const exactDsMatches = matches.filter((m) => cleanD(m.source.dataset) === targetDsClean);
      if (exactDsMatches.length === 1) {
        return {
          entityName: exactDsMatches[0].entity.name,
          columnName: exactDsMatches[0].column.name,
          sourceDataset: exactDsMatches[0].source.dataset,
          sourceTable: exactDsMatches[0].source.table,
          sourceColumn: exactDsMatches[0].source.column,
          isResolved: true,
        };
      }
    }
    return {
      entityName: '',
      columnName: '',
      sourceDataset: parsed.dataset,
      sourceTable: parsed.table,
      sourceColumn: parsed.column,
      isResolved: false,
      unresolvedReason: `Ambiguous source match: found ${matches.length} matching consolidated columns for ${parsed.rawText}`,
    };
  }

  return {
    entityName: '',
    columnName: '',
    sourceDataset: parsed.dataset,
    sourceTable: parsed.table,
    sourceColumn: parsed.column,
    isResolved: false,
    unresolvedReason: `Could not find consolidated column mapped to source reference ${parsed.rawText}`,
  };
}

/**
 * Normalize the raw workflow response into a ConsolidatedSchema.
 */
export function normalizeConsolidatedSchema(rawResponse: unknown, timestamp?: string): ConsolidatedSchema | null {
  const root = extractJsonObject(rawResponse);
  if (!root) return null;

  // 1. Extract Entities
  const rawEntities =
    root.entities ||
    root.consolidated_entities ||
    root.consolidatedEntities ||
    root.tables ||
    root.schema_entities ||
    root.nodes;

  const entities: ConsolidatedEntity[] = [];
  const datasetSet = new Set<string>();

  if (Array.isArray(rawEntities)) {
    rawEntities.forEach((item, entityIndex) => {
      if (typeof item !== 'object' || item === null) return;
      const entityObj = item as Record<string, unknown>;

      const entityName = String(
        entityObj.name ||
        entityObj.entity_name ||
        entityObj.entityName ||
        entityObj.table_name ||
        entityObj.tableName ||
        entityObj.id ||
        `Entity_${entityIndex + 1}`
      ).trim();

      const description = typeof entityObj.description === 'string' ? entityObj.description : undefined;

      // Extract columns
      const rawColumns =
        entityObj.columns ||
        entityObj.fields ||
        entityObj.attributes ||
        entityObj.properties ||
        entityObj.cols;

      const columns: ConsolidatedColumn[] = [];
      const primaryKeys: string[] = [];
      const sourceTableMap = new Map<string, { dataset: string; table: string }>();

      if (Array.isArray(rawColumns)) {
        rawColumns.forEach((colItem, colIndex) => {
          if (typeof colItem === 'string') {
            columns.push({
              id: `${entityName}-${colItem}-${colIndex}`,
              name: colItem,
              data_type: 'string',
              sources: [],
            });
            return;
          }

          if (typeof colItem === 'object' && colItem !== null) {
            const colObj = colItem as Record<string, unknown>;
            const colName = String(
              colObj.name ||
              colObj.column_name ||
              colObj.columnName ||
              colObj.field_name ||
              colObj.fieldName ||
              colObj.column ||
              colObj.id ||
              `col_${colIndex + 1}`
            ).trim();

            const dataType = String(
              colObj.type ||
              colObj.data_type ||
              colObj.dataType ||
              colObj.sql_type ||
              'string'
            ).trim();

            const isPk = Boolean(
              colObj.is_primary_key ||
              colObj.isPrimaryKey ||
              colObj.pk ||
              colObj.is_pk ||
              (Array.isArray(entityObj.primary_keys) && entityObj.primary_keys.includes(colName)) ||
              (Array.isArray(entityObj.primaryKeys) && entityObj.primaryKeys.includes(colName))
            );

            if (isPk) {
              primaryKeys.push(colName);
            }

            const isFk = Boolean(
              colObj.is_foreign_key ||
              colObj.isForeignKey ||
              colObj.fk ||
              colObj.is_fk
            );

            const colDesc = typeof colObj.description === 'string' ? colObj.description : undefined;
            const colConfidence = typeof colObj.confidence === 'number' ? colObj.confidence : undefined;
            const colNotes = typeof colObj.notes === 'string' ? colObj.notes : undefined;

            // Sources / Lineage
            const rawSources =
              colObj.source_columns ||
              colObj.sourceColumns ||
              colObj.sources ||
              colObj.source_mappings ||
              colObj.lineage ||
              colObj.source_references ||
              colObj.sourceReferences ||
              colObj.source;

            const sources: ColumnSourceReference[] = [];
            if (Array.isArray(rawSources)) {
              for (const s of rawSources) {
                const parsed = parseSourceReference(s);
                if (parsed) {
                  sources.push(parsed);
                  if (parsed.dataset) datasetSet.add(parsed.dataset);
                  if (parsed.table) {
                    const key = `${parsed.dataset}::${parsed.table}`;
                    sourceTableMap.set(key, { dataset: parsed.dataset, table: parsed.table });
                  }
                }
              }
            } else if (rawSources) {
              const parsed = parseSourceReference(rawSources);
              if (parsed) {
                sources.push(parsed);
                if (parsed.dataset) datasetSet.add(parsed.dataset);
                if (parsed.table) {
                  const key = `${parsed.dataset}::${parsed.table}`;
                  sourceTableMap.set(key, { dataset: parsed.dataset, table: parsed.table });
                }
              }
            }

            columns.push({
              id: `${entityName}-${colName}-${colIndex}`,
              name: colName,
              data_type: dataType,
              is_primary_key: isPk,
              is_foreign_key: isFk,
              description: colDesc,
              sources,
              confidence: colConfidence,
              notes: colNotes,
            });
          }
        });
      }

      // Check for explicit source tables on entity
      const rawSourceTables = entityObj.source_tables || entityObj.sourceTables || entityObj.sources;
      if (Array.isArray(rawSourceTables)) {
        for (const st of rawSourceTables) {
          if (typeof st === 'string') {
            const parts = st.split(/[./]/);
            if (parts.length === 2) {
              sourceTableMap.set(`${parts[0]}::${parts[1]}`, { dataset: parts[0], table: parts[1] });
              datasetSet.add(parts[0]);
            } else {
              sourceTableMap.set(`::${st}`, { dataset: '', table: st });
            }
          } else if (typeof st === 'object' && st !== null) {
            const stObj = st as Record<string, unknown>;
            const ds = String(stObj.dataset || stObj.dataset_name || '').trim();
            const tbl = String(stObj.table || stObj.table_name || '').trim();
            if (ds || tbl) {
              sourceTableMap.set(`${ds}::${tbl}`, { dataset: ds, table: tbl });
              if (ds) datasetSet.add(ds);
            }
          }
        }
      }

      entities.push({
        id: `entity-${entityName.toLowerCase().replace(/\s+/g, '-')}-${entityIndex}`,
        name: entityName,
        description,
        columns,
        primary_keys: primaryKeys,
        source_tables: Array.from(sourceTableMap.values()),
      });
    });
  }

  // 2. Extract Relationships
  const rawRelationships =
    root.relationships ||
    root.entity_relationships ||
    root.entityRelationships ||
    root.relations ||
    root.foreign_keys ||
    root.links;

  const relationships: ConsolidatedRelationship[] = [];

  if (Array.isArray(rawRelationships)) {
    rawRelationships.forEach((item, relIndex) => {
      if (typeof item !== 'object' || item === null) return;
      const relObj = item as Record<string, unknown>;

      const fromRaw =
        relObj.from ||
        relObj.source ||
        relObj.source_endpoint ||
        relObj.from_endpoint ||
        (relObj.source_table ? { dataset_name: relObj.source_dataset || relObj.dataset_name, table_name: relObj.source_table, column_name: relObj.source_column } : null) ||
        (relObj.source_entity ? { dataset_name: relObj.source_dataset || relObj.dataset_name, table_name: relObj.source_entity, column_name: relObj.source_column } : null) ||
        '';

      const toRaw =
        relObj.to ||
        relObj.target ||
        relObj.target_endpoint ||
        relObj.to_endpoint ||
        (relObj.target_table ? { dataset_name: relObj.target_dataset || relObj.dataset_name, table_name: relObj.target_table, column_name: relObj.target_column } : null) ||
        (relObj.target_entity ? { dataset_name: relObj.target_dataset || relObj.dataset_name, table_name: relObj.target_entity, column_name: relObj.target_column } : null) ||
        '';

      const srcResolution = resolveEndpointToEntity(fromRaw, entities);
      const tgtResolution = resolveEndpointToEntity(toRaw, entities);

      const isMappedToEntities = srcResolution.isResolved && tgtResolution.isResolved;

      const sourceEntity = srcResolution.isResolved
        ? srcResolution.entityName
        : srcResolution.sourceTable || (typeof fromRaw === 'string' ? fromRaw : 'Source');
      const sourceColumn = srcResolution.isResolved
        ? srcResolution.columnName
        : srcResolution.sourceColumn || '';

      const targetEntity = tgtResolution.isResolved
        ? tgtResolution.entityName
        : tgtResolution.sourceTable || (typeof toRaw === 'string' ? toRaw : 'Target');
      const targetColumn = tgtResolution.isResolved
        ? tgtResolution.columnName
        : tgtResolution.sourceColumn || '';

      // Status: only 'uncertain' if response explicitly marks as uncertain
      const rawStatus = String(
        relObj.status ||
        relObj.confidence_level ||
        relObj.state ||
        'confirmed'
      ).toLowerCase().trim();

      let status: 'confirmed' | 'uncertain' | 'inferred' | 'suggested' = 'confirmed';
      if (rawStatus.includes('uncert') || rawStatus.includes('ambig') || rawStatus.includes('unconf')) {
        status = 'uncertain';
      } else if (rawStatus.includes('inf') || rawStatus.includes('guess')) {
        status = 'inferred';
      } else if (rawStatus.includes('sugg')) {
        status = 'suggested';
      } else {
        status = 'confirmed';
      }

      const relType = String(
        relObj.type ||
        relObj.relationship_type ||
        relObj.relationshipType ||
        relObj.cardinality ||
        '1:N'
      ).trim();

      const reason =
        typeof relObj.reason === 'string'
          ? relObj.reason
          : typeof relObj.explanation === 'string'
          ? relObj.explanation
          : !isMappedToEntities
          ? [srcResolution.unresolvedReason, tgtResolution.unresolvedReason].filter(Boolean).join('; ')
          : undefined;

      relationships.push({
        id: `rel-${relIndex}-${sourceEntity}-${targetEntity}-${relType}`,
        source_entity: sourceEntity,
        source_column: sourceColumn,
        source_dataset: srcResolution.sourceDataset,
        source_table: srcResolution.sourceTable,
        target_entity: targetEntity,
        target_column: targetColumn,
        target_dataset: tgtResolution.sourceDataset,
        target_table: tgtResolution.sourceTable,
        type: relType,
        status,
        reason,
        confidence: typeof relObj.confidence === 'number' ? relObj.confidence : undefined,
        is_mapped_to_entities: isMappedToEntities,
      });
    });
  }

  // 3. Extract Source Mappings
  const rawMappings =
    root.source_mappings ||
    root.sourceMappings ||
    root.mappings ||
    root.concept_mappings ||
    root.column_mappings;

  const sourceMappings: SourceMapping[] = [];

  if (Array.isArray(rawMappings)) {
    rawMappings.forEach((item, mapIndex) => {
      if (typeof item !== 'object' || item === null) return;
      const mapObj = item as Record<string, unknown>;

      const concept = String(
        mapObj.concept ||
        mapObj.target_concept ||
        mapObj.targetConcept ||
        mapObj.name ||
        mapObj.field ||
        mapObj.entity_column ||
        `Concept_${mapIndex + 1}`
      ).trim();

      const targetEntity = typeof mapObj.target_entity === 'string' ? mapObj.target_entity : undefined;
      const targetColumn = typeof mapObj.target_column === 'string' ? mapObj.target_column : undefined;

      const rawRefs =
        mapObj.source_references ||
        mapObj.sourceReferences ||
        mapObj.sources ||
        mapObj.source_columns;

      const sources: ColumnSourceReference[] = [];
      if (Array.isArray(rawRefs)) {
        for (const r of rawRefs) {
          const parsed = parseSourceReference(r);
          if (parsed) {
            sources.push(parsed);
            if (parsed.dataset) datasetSet.add(parsed.dataset);
          }
        }
      } else if (rawRefs) {
        const parsed = parseSourceReference(rawRefs);
        if (parsed) {
          sources.push(parsed);
          if (parsed.dataset) datasetSet.add(parsed.dataset);
        }
      }

      const rawStatus = String(mapObj.status || mapObj.mapping_status || 'confirmed').toLowerCase();
      let status: 'confirmed' | 'inferred' | 'uncertain' | 'pending' = 'confirmed';
      if (rawStatus.includes('uncert')) status = 'uncertain';
      else if (rawStatus.includes('inf')) status = 'inferred';
      else if (rawStatus.includes('pend')) status = 'pending';

      sourceMappings.push({
        id: `map-${mapIndex}`,
        concept,
        target_entity: targetEntity,
        target_column: targetColumn,
        sources,
        status,
        confidence: typeof mapObj.confidence === 'number' ? mapObj.confidence : undefined,
        notes: typeof mapObj.notes === 'string' ? mapObj.notes : typeof mapObj.reason === 'string' ? mapObj.reason : undefined,
      });
    });
  } else {
    // If no explicit source_mappings list was provided, build concept mappings from columns with sources
    let mapIdx = 0;
    for (const ent of entities) {
      for (const col of ent.columns) {
        if (col.sources.length > 0) {
          sourceMappings.push({
            id: `map-${mapIdx++}`,
            concept: `${ent.name}.${col.name}`,
            target_entity: ent.name,
            target_column: col.name,
            sources: col.sources,
            status: col.confidence && col.confidence < 0.8 ? 'inferred' : 'confirmed',
            confidence: col.confidence,
            notes: col.notes,
          });
        }
      }
    }
  }

  // 4. Extract Uncertainties
  const rawUncertainties =
    root.uncertainties ||
    root.ambiguities ||
    root.uncertain_mappings ||
    root.uncertainMappings ||
    root.warnings;

  const uncertainties: SchemaUncertainty[] = [];

  if (Array.isArray(rawUncertainties)) {
    rawUncertainties.forEach((item, uncIndex) => {
      if (typeof item !== 'object' || item === null) return;
      const uncObj = item as Record<string, unknown>;

      const type = String(
        uncObj.type ||
        uncObj.uncertainty_type ||
        uncObj.uncertaintyType ||
        uncObj.category ||
        uncObj.issue ||
        'Uncertain Mapping'
      ).trim();

      const explanation = String(
        uncObj.explanation ||
        uncObj.reason ||
        uncObj.description ||
        uncObj.details ||
        uncObj.message ||
        'No explanation provided.'
      ).trim();

      const rawSources =
        uncObj.affected_sources ||
        uncObj.sources ||
        uncObj.source_references ||
        uncObj.affected_fields;

      const sources: ColumnSourceReference[] = [];
      if (Array.isArray(rawSources)) {
        for (const s of rawSources) {
          const parsed = parseSourceReference(s);
          if (parsed) {
            sources.push(parsed);
            if (parsed.dataset) datasetSet.add(parsed.dataset);
          }
        }
      } else if (rawSources) {
        const parsed = parseSourceReference(rawSources);
        if (parsed) {
          sources.push(parsed);
          if (parsed.dataset) datasetSet.add(parsed.dataset);
        }
      }

      const severity =
        uncObj.severity === 'high' || uncObj.severity === 'medium' || uncObj.severity === 'low'
          ? (uncObj.severity as 'low' | 'medium' | 'high')
          : undefined;

      const suggestedAction = typeof uncObj.suggested_action === 'string'
        ? uncObj.suggested_action
        : typeof uncObj.recommendation === 'string'
        ? uncObj.recommendation
        : undefined;

      uncertainties.push({
        id: `unc-${uncIndex}`,
        type,
        sources,
        explanation,
        severity,
        suggested_action: suggestedAction,
      });
    });
  }

  // Also collect any relationships or source mappings explicitly marked as uncertain
  for (const rel of relationships) {
    if (rel.status === 'uncertain' && !uncertainties.some((u) => u.explanation.includes(rel.source_entity) && u.explanation.includes(rel.target_entity))) {
      uncertainties.push({
        id: `unc-rel-${rel.id}`,
        type: 'Uncertain Relationship',
        sources: [
          { dataset: rel.source_dataset || '', table: rel.source_table || rel.source_entity, column: rel.source_column },
          { dataset: rel.target_dataset || '', table: rel.target_table || rel.target_entity, column: rel.target_column },
        ],
        explanation: rel.reason || `Relationship between ${rel.source_entity}.${rel.source_column} and ${rel.target_entity}.${rel.target_column} is marked as uncertain.`,
        severity: 'medium',
      });
    }
  }

  // 5. Calculate Metrics
  const totalEntities = entities.length;
  const totalColumns = entities.reduce((sum, e) => sum + e.columns.length, 0);
  const totalRelationships = relationships.length;
  const mappedRelationships = relationships.filter((r) => r.is_mapped_to_entities).length;
  const unresolvedRelationships = relationships.filter((r) => !r.is_mapped_to_entities).length;
  const confirmedMappedRelationships = relationships.filter(
    (r) => r.is_mapped_to_entities && r.status === 'confirmed'
  ).length;
  const uncertainMappedRelationships = relationships.filter(
    (r) => r.is_mapped_to_entities && r.status !== 'confirmed'
  ).length;
  const uncertainMappingsCount =
    uncertainties.length > 0
      ? uncertainties.length
      : sourceMappings.filter((m) => m.status === 'uncertain').length;

  return {
    raw_response: rawResponse,
    received_at: timestamp || new Date().toLocaleTimeString(),
    entities,
    relationships,
    source_mappings: sourceMappings,
    uncertainties,
    summary: {
      total_entities: totalEntities,
      total_columns: totalColumns,
      total_relationships: totalRelationships,
      mapped_relationships: mappedRelationships,
      unresolved_relationships: unresolvedRelationships,
      confirmed_relationships: confirmedMappedRelationships,
      uncertain_relationships: uncertainMappedRelationships,
      uncertain_mappings: uncertainMappingsCount,
    },
    source_datasets: Array.from(datasetSet).filter(Boolean).sort(),
  };
}
