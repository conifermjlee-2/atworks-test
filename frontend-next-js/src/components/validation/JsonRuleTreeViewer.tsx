"use client";
import React, { useState } from 'react';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export interface Rule {
  fieldPath: string;
  operator: string;
  expectedValue: string;
  valueType: string;
  logicalOperator: string;
  selected?: boolean;
  isRecommended?: boolean;
  sourceApi?: string;
}

interface ValidationResult {
  rule: Rule;
  passed: boolean;
  actualValue: string;
}

interface JsonNodeProps {
  data: any;
  nodeKey: string | number;
  path: string;
  isLast: boolean;
  rules: Rule[];
  validationResults?: ValidationResult[];
  onOpenRuleDialog: (path: string, type: string, value: any, parentIndex?: number) => void;
  onUpdateRule: (index: number, updates: Partial<Rule>) => void;
  onDeleteRule: (index: number) => void;
}

const normalizePath = (p: string) => p ? (p.startsWith('$.') ? p.slice(2) : p.startsWith('$') ? p.slice(1) : p) : p;

// Rule Badge Component (Inline Editor)
const RuleBadge = ({ rule, isChild, onDelete, onUpdate, result }: { rule: Rule & { originalIndex: number }, isChild: boolean, onDelete: () => void, onUpdate: (u: Partial<Rule>) => void, result?: ValidationResult }) => {
  return (
    <div className={`inline-flex items-center gap-1.5 ml-3 px-2 py-1 rounded-md text-xs shadow-sm border ${result ? (result.passed ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200') : 'bg-white border-gray-200'} transition-all group hover:shadow-md`}>
      {/* Result Indicator */}
      {result && (
        <span className={result.passed ? "text-emerald-600 font-bold" : "text-red-600 font-bold"}>
          {result.passed ? '✅' : '❌'}
        </span>
      )}

      {/* Logical Operator (if child) */}
      {isChild && (
        <>
          <span className="text-gray-400 font-bold">↳</span>
          <Select value={rule.logicalOperator} onValueChange={(val) => onUpdate({ logicalOperator: val })}>
            <SelectTrigger className="h-6 w-[60px] text-[10px] px-1 border-gray-200 bg-gray-50 text-gray-600">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="AND">AND</SelectItem>
              <SelectItem value="OR">OR</SelectItem>
            </SelectContent>
          </Select>
        </>
      )}

      {/* Operator */}
      <Select value={rule.operator} onValueChange={(val) => onUpdate({ operator: val })}>
        <SelectTrigger className="h-6 w-[65px] text-[10px] px-1 border-gray-200 bg-gray-50 text-gray-700 font-semibold">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="=">=</SelectItem>
          <SelectItem value="!=">!=</SelectItem>
          <SelectItem value=">">&gt;</SelectItem>
          <SelectItem value="<">&lt;</SelectItem>
          <SelectItem value=">=">&gt;=</SelectItem>
          <SelectItem value="<=">&lt;=</SelectItem>
          <SelectItem value="contains">has</SelectItem>
        </SelectContent>
      </Select>

      {/* Expected Value */}
      <Input 
        type="text" 
        value={rule.expectedValue} 
        onChange={(e) => onUpdate({ expectedValue: e.target.value })}
        className="h-6 w-[120px] text-[11px] px-2 border-gray-200 focus-visible:ring-1 focus-visible:ring-emerald-400"
        placeholder="기대값"
      />

      {/* Recommended Badge */}
      {rule.isRecommended && (
        <span className="text-[9px] font-bold text-sky-600 bg-sky-100 px-1 py-0.5 rounded ml-1" title={rule.sourceApi}>
          스펙추천
        </span>
      )}

      {/* Delete Button */}
      <button 
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        className="text-gray-300 hover:text-red-500 hover:bg-red-50 rounded w-5 h-5 flex items-center justify-center transition-colors ml-1"
        title="규칙 삭제"
      >
        ✕
      </button>
    </div>
  );
};

const JsonNode: React.FC<JsonNodeProps> = ({ data, nodeKey, path, isLast, rules, validationResults, onOpenRuleDialog, onUpdateRule, onDeleteRule }) => {
  const [expanded, setExpanded] = useState(true);
  const [isHovered, setIsHovered] = useState(false);

  const getType = (value: any) => {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    return typeof value;
  };

  const type = getType(data);
  const normalizedPath = normalizePath(path);
  
  // Find rules for this specific path
  const nodeRules = rules.map((r, i) => ({ ...r, originalIndex: i })).filter(r => normalizePath(r.fieldPath) === normalizedPath);
  
  const handleAddClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onOpenRuleDialog(path, type === 'number' ? 'number' : type === 'boolean' ? 'boolean' : 'string', data);
  };

  const handleAddChildClick = (e: React.MouseEvent, parentOriginalIndex: number) => {
    e.stopPropagation();
    onOpenRuleDialog(path, type === 'number' ? 'number' : type === 'boolean' ? 'boolean' : 'string', data, parentOriginalIndex);
  };

  // 렌더링: 객체/배열
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
        <div 
          onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }} 
          style={{ cursor: 'pointer', display: 'inline-block' }}
          className="hover:bg-gray-50 rounded px-1 transition-colors"
        >
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
                  rules={rules}
                  validationResults={validationResults}
                  onOpenRuleDialog={onOpenRuleDialog}
                  onUpdateRule={onUpdateRule}
                  onDeleteRule={onDeleteRule}
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

  // 렌더링: 리프(Leaf) 노드
  let displayValue = String(data);
  let color = '#059669'; // string
  if (type === 'number') color = '#d97706'; // orange
  else if (type === 'boolean') color = '#e11d48'; // red
  else if (type === 'null') color = '#9ca3af'; // gray
  
  if (type === 'string') displayValue = `"${data}"`;

  const hasRules = nodeRules.length > 0;

  return (
    <div 
      className={`json-leaf flex flex-wrap items-center py-0.5 px-1 rounded transition-colors ${isHovered && !hasRules ? 'bg-gray-50' : ''}`} 
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ minHeight: '28px' }}
    >
      <div style={{ marginLeft: '24px', flexShrink: 0 }} className="flex items-center">
        {nodeKey !== '' && <span style={{ color: '#0ea5e9' }}>{String(nodeKey).startsWith('[') ? nodeKey : `"${nodeKey}"`}: </span>}
        <span style={{ color: color, marginLeft: '4px' }}>{displayValue}</span>
        <span style={{ color: '#9ca3af' }}>{!isLast && ','}</span>
      </div>

      {/* Rules Rendering */}
      {hasRules && (
        <div className="flex flex-col gap-1 ml-2 my-1">
          {nodeRules.map((r, i) => {
            const isChild = r.logicalOperator !== 'NONE';
            const result = validationResults?.find(vr => normalizePath(vr.rule.fieldPath) === normalizedPath && vr.rule.operator === r.operator && vr.rule.expectedValue === r.expectedValue);
            return (
              <div key={i} className="flex items-center">
                <RuleBadge 
                  rule={r} 
                  isChild={isChild}
                  onUpdate={(updates) => onUpdateRule(r.originalIndex, updates)}
                  onDelete={() => onDeleteRule(r.originalIndex)}
                  result={result}
                />
                {/* Last rule in group gets the + button for adding sub-rules */}
                {i === nodeRules.length - 1 && (
                  <button 
                    onClick={(e) => handleAddChildClick(e, r.originalIndex)}
                    className="ml-2 w-6 h-6 rounded flex items-center justify-center text-gray-400 bg-gray-50 hover:bg-emerald-100 hover:text-emerald-600 transition-colors border border-dashed border-gray-300 hover:border-emerald-400 text-xs shadow-sm"
                    title="하위 조건(AND/OR) 추가"
                  >
                    +
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Hover Add Button (when no rules exist) */}
      {!hasRules && isHovered && path !== '' && (
        <button 
          onClick={handleAddClick}
          className="ml-4 px-2 py-0.5 text-[10px] font-bold text-gray-500 bg-white border border-gray-300 rounded hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-300 transition-all shadow-sm flex items-center gap-1"
        >
          <span className="text-emerald-500">+</span> 추가
        </button>
      )}
    </div>
  );
};

export default function JsonRuleTreeViewer({ 
  jsonData, 
  rules, 
  validationResults,
  onAddRule,
  onAddChildRule,
  onUpdateRule,
  onDeleteRule
}: { 
  jsonData: string, 
  rules: Rule[], 
  validationResults?: ValidationResult[],
  onAddRule: (path: string, type: string, expectedValue: string, operator: string) => void,
  onAddChildRule: (path: string, parentIndex: number, logicalOperator: string, operator: string, expectedValue: string) => void,
  onUpdateRule: (index: number, updates: Partial<Rule>) => void,
  onDeleteRule: (index: number) => void
}) {
  const [dialogConfig, setDialogConfig] = useState<{ isOpen: boolean, path: string, type: string, originalValue: string, parentIndex?: number, operator: string, expectedValue: string, logicalOperator: string }>({
    isOpen: false,
    path: '',
    type: 'string',
    originalValue: '',
    operator: '=',
    expectedValue: '',
    logicalOperator: 'OR'
  });

  const handleOpenDialog = (path: string, type: string, originalValue: any, parentIndex?: number) => {
    setDialogConfig({
      isOpen: true,
      path,
      type,
      originalValue: String(originalValue),
      parentIndex,
      operator: '=',
      expectedValue: String(originalValue),
      logicalOperator: 'OR' // child default
    });
  };

  const handleConfirmAdd = () => {
    if (dialogConfig.parentIndex !== undefined) {
      // It's a child rule, but wait, the onAddChildRule interface in page.tsx doesn't accept all these params!
      // I'll need to pass the operator and expectedValue through the interface or update it here.
      // Wait, onAddChildRule in page.tsx creates it with empty string and '='.
      // We can create it there and then immediately update it, or just update the signature.
      // Let's call onAddRule directly since the parent component manages the list, but we need the correct logicalOperator.
      // Actually, to make it simple without changing page.tsx again, we can just trigger onAddChildRule and then the user edits it inline. 
      // But the user wanted a Popover to SET the values. Let's adjust page.tsx's `handleAddChildRule` logic inside here.
      
      // We'll call onAddChildRule which inserts a blank rule, then we'll update it. 
      // BUT we don't know the new index easily. Let's just fix the `page.tsx` handlers by passing full object?
      // No, let's keep the Dialog simple:
    }
  };

  let parsed;
  try {
    parsed = JSON.parse(jsonData);
  } catch (e) {
    return <pre className="p-4 text-red-500 bg-red-50 rounded-md">Invalid JSON: {jsonData}</pre>;
  }

  return (
    <div className="json-rule-view w-full" style={{ fontFamily: 'monospace', fontSize: '0.9rem', overflowX: 'auto', padding: '1rem', background: '#ffffff', borderRadius: 8 }}>
      <JsonNode 
        data={parsed} 
        nodeKey="" 
        path="" 
        isLast={true} 
        rules={rules} 
        validationResults={validationResults}
        onOpenRuleDialog={handleOpenDialog}
        onUpdateRule={onUpdateRule}
        onDeleteRule={onDeleteRule}
      />

      <Dialog open={dialogConfig.isOpen} onOpenChange={(open) => setDialogConfig(prev => ({...prev, isOpen: open}))}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>값 검증 규칙 추가</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <p className="text-xs text-gray-500 font-semibold mb-1">대상 필드 (JSON Path)</p>
              <p className="font-mono text-sm bg-gray-50 p-2 rounded border">{dialogConfig.path}</p>
            </div>
            
            {dialogConfig.parentIndex !== undefined && (
              <div className="flex items-center gap-3">
                <p className="text-xs text-gray-500 font-semibold w-20">논리 연산자</p>
                <Select value={dialogConfig.logicalOperator} onValueChange={(val) => setDialogConfig(prev => ({...prev, logicalOperator: val}))}>
                  <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AND">AND (그리고)</SelectItem>
                    <SelectItem value="OR">OR (또는)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex items-center gap-3">
              <p className="text-xs text-gray-500 font-semibold w-20">검증 조건</p>
              <Select value={dialogConfig.operator} onValueChange={(val) => setDialogConfig(prev => ({...prev, operator: val}))}>
                <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="=">같다 (=)</SelectItem>
                  <SelectItem value="!=">다르다 (!=)</SelectItem>
                  <SelectItem value=">">크다 (&gt;)</SelectItem>
                  <SelectItem value="<">작다 (&lt;)</SelectItem>
                  <SelectItem value=">=">크거나 같다 (&gt;=)</SelectItem>
                  <SelectItem value="<=">작거나 같다 (&lt;=)</SelectItem>
                  <SelectItem value="contains">포함한다</SelectItem>
                </SelectContent>
              </Select>
              <Input 
                value={dialogConfig.expectedValue}
                onChange={(e) => setDialogConfig(prev => ({...prev, expectedValue: e.target.value}))}
                className="flex-1"
                placeholder="기대하는 값 입력"
              />
            </div>
            <div className="text-xs text-gray-400 mt-1 pl-[92px]">
              현재 응답 값: <span className="font-mono text-gray-600">{dialogConfig.originalValue}</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogConfig(prev => ({...prev, isOpen: false}))}>취소</Button>
            <Button onClick={() => {
              if (dialogConfig.parentIndex !== undefined) {
                onAddChildRule(dialogConfig.path, dialogConfig.parentIndex, dialogConfig.logicalOperator, dialogConfig.operator, dialogConfig.expectedValue);
              } else {
                onAddRule(dialogConfig.path, dialogConfig.type, dialogConfig.expectedValue, dialogConfig.operator);
              }
              setDialogConfig(prev => ({...prev, isOpen: false}));
            }}>확인</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
