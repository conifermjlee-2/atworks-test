"use client";
import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useRouter } from 'next/navigation';

export default function ApiRegistryPage() {
  const [apis, setApis] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const fetchApis = async () => {
    try {
      const res = await fetch('/api/tester/apis');
      const data = await res.json();
      setApis(Array.isArray(data) ? data : []);
    } catch (e) {
      toast.error('API 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApis();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    try {
      const res = await fetch(`/api/tester/apis?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('삭제되었습니다.');
        fetchApis();
      } else {
        toast.error('삭제 실패');
      }
    } catch (e) {
      toast.error('오류 발생');
    }
  };

  const handleLoad = (id: string) => {
    // 이동 시 URL 쿼리 파라미터로 id를 넘겨서 validation 페이지가 로드할 수 있게 함
    router.push(`/validation?loadApi=${id}`);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in zoom-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
            API Registry
          </h1>
          <p className="text-gray-500 mt-2">등록된 API 및 검증 규칙(Rule) 목록을 관리합니다.</p>
        </div>
        <Button onClick={() => router.push('/validation')} className="bg-blue-600 hover:bg-blue-700">
          + 새 테스트 작성
        </Button>
      </div>

      <Card className="shadow-lg border-0 ring-1 ring-black/5 rounded-xl overflow-hidden">
        <CardHeader className="bg-gray-50 border-b">
          <CardTitle className="text-lg">등록된 API 목록 ({apis.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-gray-500">로딩 중...</div>
          ) : apis.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <div className="text-4xl mb-4">📭</div>
              등록된 API가 없습니다.<br/>
              값 검증 페이지에서 테스트 후 저장해보세요.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead>그룹</TableHead>
                  <TableHead>이름 (설명)</TableHead>
                  <TableHead>Method / URL</TableHead>
                  <TableHead className="text-center">등록된 규칙 수</TableHead>
                  <TableHead className="text-center">생성일</TableHead>
                  <TableHead className="text-right">관리</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apis.map(api => (
                  <TableRow key={api.id} className="hover:bg-blue-50/50 transition-colors">
                    <TableCell>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                        {api.group}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-gray-900">{api.name}</div>
                      <div className="text-sm text-gray-500">{api.description}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold ${api.method === 'GET' ? 'text-blue-600' : 'text-green-600'}`}>
                          {api.method}
                        </span>
                        <span className="text-sm text-gray-600 truncate max-w-xs">{api.url}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold text-xs">
                        {api.rules?.length || 0}
                      </span>
                    </TableCell>
                    <TableCell className="text-center text-sm text-gray-500">
                      {new Date(api.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => handleLoad(api.id)} className="bg-white hover:bg-blue-50 text-blue-600 border-blue-200">
                          불러오기
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => handleDelete(api.id)}>
                          삭제
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
