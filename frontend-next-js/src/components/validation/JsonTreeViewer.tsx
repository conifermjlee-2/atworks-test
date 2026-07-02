"use client";
import React, { useState } from 'react';

interface JsonNodeProps {
  data: any;
  nodeKey: string | number;
  path: string;
  isLast: boolean;
  onNodeClick: (path: string, value: any, type: string) => void;
  highlightPath?: string | null;
}

const JsonNode: React.FC<JsonNodeProps> = ({ data, nodeKey, path, isLast, onNodeClick, highlightPath }) => {
  const [expanded, setExpanded] = useState(true);

  const getType = (value: any) => {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    return typeof value;
  };

  const type = getType(data);
  
  const handleLeafClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onNodeClick(path, data, type === 'number' ? 'NUMBER' : type === 'boolean' ? 'BOOLEAN' : 'STRING');
  };

  if (type === 'object' || type === 'array') {
    const isArray = type === 'array';
    const keys = Object.keys(data);
    const bracketOpen = isArray ? '[' : '{';
    const bracketClose = isArray ? ']' : '}';

    if (keys.length === 0) {
      return (
        <div style={{ marginLeft: '24px' }}>
          <span style={{ color: '#0ea5e9' }}>{nodeKey !== '' ? (String(nodeKey).startsWith('[') ? `${nodeKey}: ` : `"${nodeKey}": `) : ''}</span>
          <span style={{ color: '#9ca3af' }}>{bracketOpen}{bracketClose}{!isLast && ','}</span>
        </div>
      );
    }

    return (
      <div>
        <div onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }} style={{ cursor: 'pointer', display: 'inline-block' }}>
          <span style={{ color: '#9ca3af', width: '24px', display: 'inline-block', textAlign: 'center' }}>{expanded ? '▼' : '▶'}</span>
          {nodeKey !== '' && <span style={{ color: '#0ea5e9' }}>{String(nodeKey).startsWith('[') ? nodeKey : `"${nodeKey}"`}: </span>}
          <span style={{ color: '#9ca3af' }}>{bracketOpen}</span>
          {isArray && <span style={{ color: '#6b7280', fontSize: '0.85em', marginLeft: '6px', fontStyle: 'italic' }}>{keys.length} items</span>}
        </div>
        
        {expanded && (
          <div style={{ paddingLeft: '24px', marginLeft: '12px', borderLeft: '1px dashed #e5e7eb' }}>
            {keys.map((key, index) => {
              const childPath = isArray ? `${path}[${key}]` : path === '' ? String(key) : `${path}.${key}`;
              return (
                <JsonNode 
                  key={key} 
                  data={data[key as keyof typeof data]} 
                  nodeKey={isArray ? `[${key}]` : key} 
                  path={childPath} 
                  isLast={index === keys.length - 1}
                  onNodeClick={onNodeClick}
                  highlightPath={highlightPath}
                />
              );
            })}
          </div>
        )}
        
        <div>
          <span style={{ color: '#9ca3af', display: 'inline-block', marginLeft: '24px' }}>{bracketClose}{!isLast && ','}</span>
        </div>
      </div>
    );
  }

  // Leaf node
  let displayValue = String(data);
  let color = '#059669'; // string color (greenish)
  if (type === 'number') color = '#d97706'; // orange
  else if (type === 'boolean') color = '#e11d48'; // red
  else if (type === 'null') color = '#9ca3af'; // gray
  
  if (type === 'string') displayValue = `"${data}"`;

  const [isHovered, setIsHovered] = useState(false);

  const isHighlighted = highlightPath === path;

  return (
    <div 
      className="json-leaf" 
      data-json-path={path}
      onClick={handleLeafClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        padding: '2px 4px',
        transition: 'background 0.3s',
        background: isHighlighted ? '#fef9c3' : undefined,
        borderRadius: isHighlighted ? '4px' : undefined,
        outline: isHighlighted ? '1.5px solid #eab308' : undefined,
      }}
    >
      <div style={{ marginLeft: '24px' }}>
        {nodeKey !== '' && <span style={{ color: '#0ea5e9' }}>{String(nodeKey).startsWith('[') ? nodeKey : `"${nodeKey}"`}: </span>}
        <span style={{ color: color }}>{displayValue}</span>
        <span style={{ color: '#9ca3af' }}>{!isLast && ','}</span>
      </div>
      {isHovered && (
        <span style={{ marginLeft: '10px', color: '#10b981', fontSize: '0.8rem', fontWeight: 'bold' }}>
          + 추가
        </span>
      )}
    </div>
  );
};

export default function JsonTreeViewer({ jsonData, onNodeClick, highlightPath }: { jsonData: string, onNodeClick: (path: string, value: any, type: string) => void, highlightPath?: string | null }) {
  let parsed;
  try {
    parsed = JSON.parse(jsonData);
  } catch (e) {
    return <pre>{jsonData}</pre>;
  }

  return (
    <div className="json-view" style={{ fontFamily: 'monospace', fontSize: '0.9rem', overflowX: 'auto', padding: '1rem', background: '#ffffff', borderRadius: 8, border: '1px solid #e5e7eb' }}>
      <style>{`
        .json-leaf:hover {
          background: #f3f4f6;
        }
      `}</style>
      <JsonNode data={parsed} nodeKey="" path="" isLast={true} onNodeClick={onNodeClick} highlightPath={highlightPath} />
    </div>
  );
}
