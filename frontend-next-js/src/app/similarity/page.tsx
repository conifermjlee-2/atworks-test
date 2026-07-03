"use client";
import React, { useState } from 'react';
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

export default function SimilarityPage() {
  const [swaggerUrl, setSwaggerUrl] = useState('http://localhost:8080/v3/api-docs');
  const [targetUrl, setTargetUrl] = useState('http://localhost:8080/api/delivery/standard');
  const [targetMethod, setTargetMethod] = useState('GET');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);

  const handleAnalyze = async () => {
    if (!swaggerUrl || !targetUrl) {
      toast.error("Swagger URL과 기준 API URL을 모두 입력해주세요.");
      return;
    }

    setLoading(true);
    setResults([]);
    try {
      toast.info("AI 모델이 텍스트를 분석 중입니다... (최초 로딩 시 약 5초 소요)");

      const res = await fetch(`http://localhost:8080/api/similarity/recommend?swaggerUrl=${encodeURIComponent(swaggerUrl)}&targetUrl=${encodeURIComponent(targetUrl)}&targetMethod=${targetMethod}`);
      
      if (!res.ok) {
        throw new Error("서버 에러 발생");
      }
      
      const data = await res.json();
      setResults(data);
      toast.success("유사 API 분석 완료!");
    } catch (error: any) {
      toast.error(error.message || "유사도 분석에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
          <span>🔍</span> 유사 API 분석 (AI 기반)
        </h1>
        <p className="text-sm text-gray-500">순수 인메모리 ONNX 모델을 활용하여 의미(Semantic) 기반으로 유사한 API를 찾아냅니다.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>분석 대상 설정</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-12 gap-4">
            <div className="col-span-12">
              <label className="text-sm font-medium mb-1 block">Swagger URL</label>
              <Input 
                value={swaggerUrl}
                onChange={(e) => setSwaggerUrl(e.target.value)}
                placeholder="http://localhost:8080/v3/api-docs"
              />
            </div>
            
            <div className="col-span-3">
              <label className="text-sm font-medium mb-1 block">Method</label>
              <Select value={targetMethod} onValueChange={setTargetMethod}>
                <SelectTrigger><SelectValue placeholder="메서드" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="GET">GET</SelectItem>
                  <SelectItem value="POST">POST</SelectItem>
                  <SelectItem value="PUT">PUT</SelectItem>
                  <SelectItem value="DELETE">DELETE</SelectItem>
                  <SelectItem value="PATCH">PATCH</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="col-span-9">
              <label className="text-sm font-medium mb-1 block">기준 API URL (Target)</label>
              <Input 
                value={targetUrl}
                onChange={(e) => setTargetUrl(e.target.value)}
                placeholder="/api/delivery/standard"
              />
            </div>
          </div>

          <Button 
            className="w-full h-12 text-lg mt-4 bg-indigo-600 hover:bg-indigo-700" 
            onClick={handleAnalyze} 
            disabled={loading}
          >
            {loading ? "AI 분석 중... ⏳" : "유사 API 찾기 🚀"}
          </Button>
        </CardContent>
      </Card>

      {results.length > 0 && (
        <Card className="border-green-200 shadow-md">
          <CardHeader className="bg-green-50 border-b border-green-100">
            <CardTitle className="text-green-800">💡 AI가 추천하는 가장 유사한 API Top 5</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16 text-center">순위</TableHead>
                  <TableHead className="w-24">유사도</TableHead>
                  <TableHead className="w-24">Method</TableHead>
                  <TableHead>API Path</TableHead>
                  <TableHead>Summary / 설명</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((api, idx) => (
                  <TableRow key={idx} className="hover:bg-slate-50 transition-colors">
                    <TableCell className="text-center font-bold text-gray-500">{idx + 1}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        {api.similarityScore}%
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={`text-xs font-bold ${
                        api.method === 'GET' ? 'text-blue-600' :
                        api.method === 'POST' ? 'text-green-600' :
                        api.method === 'PUT' ? 'text-orange-600' :
                        api.method === 'DELETE' ? 'text-red-600' : 'text-gray-600'
                      }`}>
                        {api.method}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{api.path}</TableCell>
                    <TableCell>
                      <div className="font-medium text-gray-900">{api.summary || 'N/A'}</div>
                      <div className="text-xs text-gray-500 mt-1 truncate max-w-md" title={api.description}>
                        {api.description || '설명 없음'}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
