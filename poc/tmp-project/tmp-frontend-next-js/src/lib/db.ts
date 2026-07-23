import fs from 'fs';
import path from 'path';

const dbPath = path.resolve(process.cwd(), 'database.json');

// 초기 데이터 구조
type User = {
  id: number;
  name: string;
  password?: string;
};

// 파일 DB 초기화 및 읽기
const readDB = (): { users: User[] } => {
  if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, JSON.stringify({ users: [] }, null, 2));
  }
  const data = fs.readFileSync(dbPath, 'utf8');
  return JSON.parse(data);
};

// 파일 DB 쓰기
const writeDB = (data: { users: User[] }) => {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
};

// 비동기 쿼리 래퍼 (기존 코드와의 호환성을 위해 Promise 반환)
export const getQuery = async <T>(query: string, params: any[] = []): Promise<T[]> => {
  const db = readDB();
  // 매우 단순한 형태의 쿼리 에뮬레이션
  if (query.includes('ORDER BY id DESC')) {
    return [...db.users].reverse() as unknown as T[];
  }
  return db.users as unknown as T[];
};

export const getQuerySingle = async <T>(query: string, params: any[] = []): Promise<T> => {
  const db = readDB();
  const id = parseInt(params[0], 10);
  const user = db.users.find(u => u.id === id);
  return user as unknown as T;
};

export const runQuery = async (query: string, params: any[] = []): Promise<void> => {
  const db = readDB();
  
  if (query.includes('INSERT INTO')) {
    const newId = db.users.length > 0 ? Math.max(...db.users.map(u => u.id)) + 1 : 1;
    db.users.push({
      id: newId,
      name: params[0],
      password: params[1],
    });
  } else if (query.includes('UPDATE')) {
    const id = parseInt(params[2], 10);
    const userIndex = db.users.findIndex(u => u.id === id);
    if (userIndex !== -1) {
      db.users[userIndex].name = params[0];
      db.users[userIndex].password = params[1];
    }
  } else if (query.includes('DELETE')) {
    const id = parseInt(params[0], 10);
    db.users = db.users.filter(u => u.id !== id);
  }
  
  writeDB(db);
};
