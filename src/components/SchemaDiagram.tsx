import { useState, useRef, useCallback, useMemo } from 'react';
import type { ConsolidatedEntity, ConsolidatedRelationship } from '../types/schema';
import {
  IconDatabase,
  IconKey,
  IconZoomIn,
  IconZoomOut,
  IconReset,
  IconMaximize,
  IconInfo,
  IconSearch,
} from './Icons';

interface SchemaDiagramProps {
  entities: ConsolidatedEntity[];
  relationships: ConsolidatedRelationship[];
  selectedEntityName: string | null;
  selectedColumnName: string | null;
  onSelectEntity: (entityName: string) => void;
  onSelectColumn: (entityName: string, columnName: string) => void;
}

interface NodePosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

const NODE_WIDTH = 260;
const HEADER_HEIGHT = 44;
const ROW_HEIGHT = 28;
const PADDING_BOTTOM = 12;

export function SchemaDiagram({
  entities,
  relationships,
  selectedEntityName,
  selectedColumnName,
  onSelectEntity,
  onSelectColumn,
}: SchemaDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Pan & Zoom state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 40, y: 40 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Custom user-dragged node positions: map entity name -> { x, y }
  const [draggedPositions, setDraggedPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [draggingEntity, setDraggingEntity] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Hovered relationship for highlight
  const [hoveredRelId, setHoveredRelId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // ─── Computed Node Positions ───────────────────────────────────
  const nodePositions = useMemo(() => {
    const positions: Record<string, NodePosition> = {};
    const cols = Math.max(1, Math.min(3, Math.ceil(Math.sqrt(entities.length))));
    const colSpacing = 360;
    const rowSpacing = 320;

    entities.forEach((ent, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const estHeight = HEADER_HEIGHT + ent.columns.length * ROW_HEIGHT + PADDING_BOTTOM;
      const defaultX = 60 + col * colSpacing;
      const defaultY = 60 + row * rowSpacing;

      const dragged = draggedPositions[ent.name];

      positions[ent.name] = {
        x: dragged ? dragged.x : defaultX,
        y: dragged ? dragged.y : defaultY,
        width: NODE_WIDTH,
        height: estHeight,
      };
    });

    return positions;
  }, [entities, draggedPositions]);

  // Filter mapped vs unmapped relationships
  const mappedRelationships = useMemo(
    () => relationships.filter((r) => r.is_mapped_to_entities),
    [relationships]
  );
  const unmappedCount = relationships.length - mappedRelationships.length;

  // ─── Panning Handlers ──────────────────────────────────────────
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    // Only pan if clicking canvas background directly
    if (e.target === containerRef.current || (e.target as HTMLElement).tagName === 'svg') {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isPanning) {
        setPan({
          x: e.clientX - panStart.x,
          y: e.clientY - panStart.y,
        });
      } else if (draggingEntity && nodePositions[draggingEntity]) {
        const newX = (e.clientX - pan.x) / zoom - dragOffset.x;
        const newY = (e.clientY - pan.y) / zoom - dragOffset.y;

        setDraggedPositions((prev) => ({
          ...prev,
          [draggingEntity]: {
            x: Math.max(10, Math.round(newX)),
            y: Math.max(10, Math.round(newY)),
          },
        }));
      }
    },
    [isPanning, draggingEntity, nodePositions, pan, zoom, panStart, dragOffset]
  );

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
    setDraggingEntity(null);
  }, []);

  // ─── Drag Node Handlers ────────────────────────────────────────
  const handleNodeHeaderMouseDown = (e: React.MouseEvent, entityName: string) => {
    e.stopPropagation();
    const pos = nodePositions[entityName];
    if (!pos) return;

    setDraggingEntity(entityName);
    const clickXInCanvas = (e.clientX - pan.x) / zoom;
    const clickYInCanvas = (e.clientY - pan.y) / zoom;
    setDragOffset({
      x: clickXInCanvas - pos.x,
      y: clickYInCanvas - pos.y,
    });
    onSelectEntity(entityName);
  };

  // ─── Zoom Controls ─────────────────────────────────────────────
  const handleZoomIn = () => setZoom((z) => Math.min(2.0, z + 0.15));
  const handleZoomOut = () => setZoom((z) => Math.max(0.4, z - 0.15));
  const handleResetZoom = () => {
    setZoom(1);
    setPan({ x: 40, y: 40 });
  };

  const handleFitToView = () => {
    const keys = Object.keys(nodePositions);
    if (keys.length === 0 || !containerRef.current) return;

    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;

    keys.forEach((k) => {
      const p = nodePositions[k];
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x + p.width);
      maxY = Math.max(maxY, p.y + p.height);
    });

    const rect = containerRef.current.getBoundingClientRect();
    const width = maxX - minX + 100;
    const height = maxY - minY + 100;

    const scaleX = rect.width / width;
    const scaleY = rect.height / height;
    const newZoom = Math.min(1.2, Math.max(0.4, Math.min(scaleX, scaleY)));

    setZoom(newZoom);
    setPan({
      x: (rect.width - width * newZoom) / 2 - minX * newZoom + 50,
      y: (rect.height - height * newZoom) / 2 - minY * newZoom + 50,
    });
  };

  // ─── Search Highlight ──────────────────────────────────────────
  const searchMatchedEntities = useMemo(() => {
    if (!searchQuery.trim()) return new Set<string>();
    const q = searchQuery.toLowerCase();
    const set = new Set<string>();
    entities.forEach((ent) => {
      if (
        ent.name.toLowerCase().includes(q) ||
        ent.columns.some((c) => c.name.toLowerCase().includes(q))
      ) {
        set.add(ent.name);
      }
    });
    return set;
  }, [entities, searchQuery]);

  return (
    <div className="schema-diagram-card">
      {/* Diagram Toolbar */}
      <div className="schema-diagram-toolbar">
        <div className="schema-diagram-toolbar__left">
          <div className="diagram-title-badge">
            <IconDatabase size={16} />
            <span>Interactive ER Diagram</span>
          </div>
          <span className="diagram-meta-pill">
            {entities.length} Tables · {mappedRelationships.length} Mapped Links
            {unmappedCount > 0 && ` (${unmappedCount} Unresolved)`}
          </span>
        </div>

        <div className="schema-diagram-toolbar__right">
          {/* Quick Search */}
          <div className="diagram-search-box">
            <IconSearch size={14} className="diagram-search-icon" />
            <input
              type="text"
              placeholder="Highlight table or column…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="diagram-search-input"
            />
          </div>

          {/* Zoom controls */}
          <div className="diagram-btn-group">
            <button
              className="diagram-btn"
              onClick={handleZoomIn}
              title="Zoom In"
              aria-label="Zoom In"
            >
              <IconZoomIn size={15} />
            </button>
            <span className="diagram-zoom-level">{Math.round(zoom * 100)}%</span>
            <button
              className="diagram-btn"
              onClick={handleZoomOut}
              title="Zoom Out"
              aria-label="Zoom Out"
            >
              <IconZoomOut size={15} />
            </button>
            <button
              className="diagram-btn"
              onClick={handleResetZoom}
              title="Reset View"
              aria-label="Reset View"
            >
              <IconReset size={15} />
            </button>
            <button
              className="diagram-btn"
              onClick={handleFitToView}
              title="Fit to Screen"
              aria-label="Fit to Screen"
            >
              <IconMaximize size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Legend & Notification Bar */}
      <div className="diagram-legend-bar">
        <div className="diagram-legend-items">
          <div className="diagram-legend-item">
            <span className="legend-line legend-line--confirmed" />
            <span>Confirmed Link ({mappedRelationships.filter((r) => r.status === 'confirmed').length})</span>
          </div>
          <div className="diagram-legend-item">
            <span className="legend-line legend-line--uncertain" />
            <span>Uncertain Link ({mappedRelationships.filter((r) => r.status !== 'confirmed').length})</span>
          </div>
          <div className="diagram-legend-item">
            <span className="legend-pk-badge">PK</span>
            <span>Primary Key</span>
          </div>
          <div className="diagram-legend-item">
            <span className="legend-fk-badge">FK</span>
            <span>Foreign Key</span>
          </div>
          <div className="diagram-legend-item">
            <span className="legend-multi-badge">M</span>
            <span>Multi-Source</span>
          </div>
        </div>

        {unmappedCount > 0 && (
          <div className="diagram-unmapped-hint">
            <IconInfo size={14} />
            <span>
              {unmappedCount} source-level relationship{unmappedCount > 1 ? 's' : ''} unmapped (view in details tab)
            </span>
          </div>
        )}
      </div>

      {/* Canvas Area */}
      <div
        ref={containerRef}
        className={`schema-canvas-container ${isPanning ? 'schema-canvas-container--panning' : ''}`}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div
          className="schema-canvas-world"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
          }}
        >
          {/* SVG Connectors Layer */}
          <svg
            className="schema-svg-layer"
            style={{
              width: 10000,
              height: 10000,
              position: 'absolute',
              top: 0,
              left: 0,
              pointerEvents: 'none',
              zIndex: 1,
            }}
          >
            <defs>
              {/* Confirmed Arrow Marker */}
              <marker
                id="marker-confirmed"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#064ee3" />
              </marker>

              {/* Uncertain Arrow Marker */}
              <marker
                id="marker-uncertain"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#d97706" />
              </marker>

              {/* Highlight Arrow Marker */}
              <marker
                id="marker-highlight"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="7"
                markerHeight="7"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#0540b8" />
              </marker>
            </defs>

            {mappedRelationships.map((rel) => {
              const srcPos = nodePositions[rel.source_entity];
              const tgtPos = nodePositions[rel.target_entity];
              if (!srcPos || !tgtPos) return null;

              // Find column vertical offsets if column matches
              const srcEntity = entities.find((e) => e.name === rel.source_entity);
              const tgtEntity = entities.find((e) => e.name === rel.target_entity);

              const srcColIdx = srcEntity?.columns.findIndex((c) => c.name === rel.source_column) ?? -1;
              const tgtColIdx = tgtEntity?.columns.findIndex((c) => c.name === rel.target_column) ?? -1;

              const srcY =
                srcPos.y +
                HEADER_HEIGHT +
                (srcColIdx >= 0 ? srcColIdx * ROW_HEIGHT + ROW_HEIGHT / 2 : srcPos.height / 2);

              const tgtY =
                tgtPos.y +
                HEADER_HEIGHT +
                (tgtColIdx >= 0 ? tgtColIdx * ROW_HEIGHT + ROW_HEIGHT / 2 : tgtPos.height / 2);

              // Connect from left or right side of nodes based on relative X
              const isSrcLeftOfTgt = srcPos.x + srcPos.width < tgtPos.x;
              const isSrcRightOfTgt = srcPos.x > tgtPos.x + tgtPos.width;

              let startX = srcPos.x + srcPos.width;
              let startY = srcY;
              let endX = tgtPos.x;
              let endY = tgtY;

              if (isSrcRightOfTgt) {
                startX = srcPos.x;
                endX = tgtPos.x + tgtPos.width;
              } else if (!isSrcLeftOfTgt) {
                // Nodes overlap horizontally
                startX = srcPos.x + srcPos.width;
                endX = tgtPos.x + tgtPos.width;
              }

              const deltaX = Math.abs(endX - startX) * 0.5 + 40;
              const cp1X = isSrcRightOfTgt ? startX - deltaX : startX + deltaX;
              const cp2X = isSrcRightOfTgt ? endX + deltaX : endX - deltaX;

              const pathData = `M ${startX} ${startY} C ${cp1X} ${startY}, ${cp2X} ${endY}, ${endX} ${endY}`;
              const midX = (startX + endX) / 2;
              const midY = (startY + endY) / 2;

              const isConfirmed = rel.status === 'confirmed';
              const isHovered = hoveredRelId === rel.id;

              const columnLabel =
                rel.source_column && rel.target_column
                  ? `${rel.source_column} ➔ ${rel.target_column}`
                  : rel.type || '1:N';

              return (
                <g
                  key={rel.id}
                  className={`schema-rel-group ${isHovered ? 'schema-rel-group--hovered' : ''}`}
                  onMouseEnter={() => setHoveredRelId(rel.id)}
                  onMouseLeave={() => setHoveredRelId(null)}
                  style={{ pointerEvents: 'auto', cursor: 'pointer' }}
                  onClick={() => {
                    onSelectEntity(rel.source_entity);
                    if (rel.source_column) onSelectColumn(rel.source_entity, rel.source_column);
                  }}
                >
                  {/* Invisible wide stroke for easy hover */}
                  <path
                    d={pathData}
                    fill="none"
                    stroke="transparent"
                    strokeWidth="18"
                  />

                  {/* Glow effect on hover */}
                  {isHovered && (
                    <path
                      d={pathData}
                      fill="none"
                      stroke="rgba(6, 78, 227, 0.25)"
                      strokeWidth="8"
                      strokeLinecap="round"
                    />
                  )}

                  {/* Main Connector Path */}
                  <path
                    d={pathData}
                    fill="none"
                    stroke={isHovered ? '#0540b8' : isConfirmed ? '#064ee3' : '#d97706'}
                    strokeWidth={isHovered ? 2.5 : 1.8}
                    strokeDasharray={isConfirmed ? undefined : '5,4'}
                    markerEnd={
                      isHovered
                        ? 'url(#marker-highlight)'
                        : isConfirmed
                        ? 'url(#marker-confirmed)'
                        : 'url(#marker-uncertain)'
                    }
                  />

                  {/* Midpoint Label Pill */}
                  <foreignObject
                    x={midX - 100}
                    y={midY - 14}
                    width={200}
                    height={28}
                    style={{ overflow: 'visible', pointerEvents: 'none', display: 'flex', justifyContent: 'center' }}
                  >
                    <div
                      className={`rel-label-pill ${
                        isConfirmed ? 'rel-label-pill--confirmed' : 'rel-label-pill--uncertain'
                      } ${isHovered ? 'rel-label-pill--hovered' : ''}`}
                      title={`${rel.source_entity}.${rel.source_column} → ${rel.target_entity}.${rel.target_column} (${rel.type})`}
                    >
                      <span>{columnLabel}</span>
                      {rel.type && <span style={{ opacity: 0.75, marginLeft: 4 }}>({rel.type})</span>}
                    </div>
                  </foreignObject>
                </g>
              );
            })}
          </svg>

          {/* HTML Entity Nodes Layer */}
          {entities.map((entity) => {
            const pos = nodePositions[entity.name] || { x: 60, y: 60, width: NODE_WIDTH, height: 200 };
            const isSelected = selectedEntityName === entity.name;
            const isSearchMatched = searchMatchedEntities.has(entity.name);
            const isDragging = draggingEntity === entity.name;

            return (
              <div
                key={entity.id}
                className={`schema-table-node ${isSelected ? 'schema-table-node--selected' : ''} ${
                  isSearchMatched ? 'schema-table-node--search-match' : ''
                } ${isDragging ? 'schema-table-node--dragging' : ''}`}
                style={{
                  transform: `translate(${pos.x}px, ${pos.y}px)`,
                  width: pos.width,
                  position: 'absolute',
                  top: 0,
                  left: 0,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectEntity(entity.name);
                }}
              >
                {/* Entity Node Header */}
                <div
                  className="schema-table-node__header"
                  onMouseDown={(e) => handleNodeHeaderMouseDown(e, entity.name)}
                >
                  <div className="schema-table-node__title">
                    <IconDatabase size={15} className="schema-table-node__icon" />
                    <span title={entity.name}>{entity.name}</span>
                  </div>
                  <span className="schema-table-node__badge">
                    {entity.columns.length} col{entity.columns.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* Entity Node Columns List */}
                <div className="schema-table-node__columns">
                  {entity.columns.map((col) => {
                    const isColSelected = isSelected && selectedColumnName === col.name;
                    const hasMultiSources = col.sources.length > 1;

                    return (
                      <div
                        key={col.id}
                        className={`schema-table-node__col-row ${
                          isColSelected ? 'schema-table-node__col-row--selected' : ''
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectEntity(entity.name);
                          onSelectColumn(entity.name, col.name);
                        }}
                        title={`${col.name} (${col.data_type})${
                          col.sources.length > 0
                            ? ` · Source: ${col.sources.map((s) => `${s.table}.${s.column}`).join(', ')}`
                            : ''
                        }`}
                      >
                        <div className="schema-table-node__col-left">
                          {col.is_primary_key && (
                            <span className="schema-col-key schema-col-key--pk" title="Primary Key">
                              <IconKey size={11} />
                            </span>
                          )}
                          {!col.is_primary_key && col.is_foreign_key && (
                            <span className="schema-col-key schema-col-key--fk" title="Foreign Key">
                              FK
                            </span>
                          )}
                          <span className="schema-col-name">{col.name}</span>
                        </div>

                        <div className="schema-table-node__col-right">
                          {hasMultiSources && (
                            <span
                              className="schema-col-multi-tag"
                              title={`${col.sources.length} source references mapped`}
                            >
                              {col.sources.length}s
                            </span>
                          )}
                          <span className="schema-col-type">{col.data_type}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
