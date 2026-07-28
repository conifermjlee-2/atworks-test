import fs from "node:fs/promises";
import path from "node:path";

const SOURCE_EXTENSIONS = new Set([".js", ".jsx", ".ts", ".tsx"]);
const IGNORE_DIRS = new Set([
  ".git",
  ".next",
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".turbo",
]);

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

export async function analyzeProject(projectRoot) {
  const files = await listSourceFiles(projectRoot);
  const fileAnalyses = [];

  for (const file of files) {
    const text = await fs.readFile(file, "utf8");
    fileAnalyses.push(analyzeFile(projectRoot, file, text));
  }

  const routes = buildRoutes(projectRoot, fileAnalyses);
  const routeComponents = resolveRouteComponents(projectRoot, routes, fileAnalyses);
  const queryIndex = buildQueryIndex(fileAnalyses);
  const components = fileAnalyses
    .map((analysis) => attachQueryMatches(analysis, queryIndex))
    .filter((analysis) => analysis.calls.length > 0 || analysis.followUps.length > 0);

  return {
    projectRoot,
    generatedAt: new Date().toISOString(),
    routes: routeComponents,
    components,
    queryIndex,
    stats: {
      sourceFiles: files.length,
      apiCalls: components.reduce((sum, item) => sum + item.calls.length, 0),
      confirmed: components.reduce(
        (sum, item) => sum + item.calls.filter((call) => call.confidence === "확정").length,
        0,
      ),
      estimated: components.reduce(
        (sum, item) => sum + item.calls.filter((call) => call.confidence === "(추정)").length,
        0,
      ),
    },
  };
}

async function listSourceFiles(root) {
  const results = [];

  async function walk(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!IGNORE_DIRS.has(entry.name)) {
          await walk(path.join(dir, entry.name));
        }
        continue;
      }

      const fullPath = path.join(dir, entry.name);
      if (SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
        results.push(fullPath);
      }
    }
  }

  await walk(root);
  return results.sort();
}

function analyzeFile(root, filePath, text) {
  const relativePath = normalizePath(path.relative(root, filePath));
  const lines = text.split(/\r?\n/);
  const imports = parseImports(text, filePath, root);
  const exportedNames = parseExports(text);
  const componentNames = parseComponentNames(text, filePath);
  const queryKeys = collectQueryKeys(text);
  const calls = [];
  const followUps = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const lineNumber = i + 1;
    const localContext = getContext(lines, i);
    const trigger = inferTrigger(lines, i);

    const apiCalls = detectApiCalls(line, localContext, lineNumber, relativePath, trigger);
    calls.push(...apiCalls);

    const reactQueryCalls = detectReactQuery(line, localContext, lineNumber, relativePath, trigger);
    calls.push(...reactQueryCalls);

    const followUp = detectFollowUp(line, localContext, lineNumber, relativePath);
    if (followUp) {
      followUps.push(followUp);
    }
  }

  return {
    filePath,
    relativePath,
    imports,
    exportedNames,
    componentNames,
    renderedComponents: parseRenderedComponents(text),
    queryKeys,
    calls: dedupeByLocation(calls),
    followUps,
    notes: collectNotes(text),
  };
}

function detectApiCalls(line, context, lineNumber, relativePath, trigger) {
  const calls = [];
  const fetchMatch = line.match(/\bfetch\s*\(\s*([^,\)]+)/);
  if (fetchMatch) {
    calls.push({
      trigger,
      kind: "fetch",
      method: inferFetchMethod(context),
      endpoint: normalizeEndpoint(fetchMatch[1]),
      functionName: enclosingFunction(context) ?? "fetch",
      location: `${relativePath}:${lineNumber}`,
      line: lineNumber,
      queryKey: null,
      confidence: endpointConfidence(fetchMatch[1]),
      condition: inferCondition(context),
      followUps: [],
    });
  }

  const axiosMethod = line.match(/\baxios\.(get|post|put|patch|delete)\s*\(\s*([^,\)]+)/i);
  if (axiosMethod) {
    calls.push({
      trigger,
      kind: "axios",
      method: axiosMethod[1].toUpperCase(),
      endpoint: normalizeEndpoint(axiosMethod[2]),
      functionName: enclosingFunction(context) ?? `axios.${axiosMethod[1]}`,
      location: `${relativePath}:${lineNumber}`,
      line: lineNumber,
      queryKey: null,
      confidence: endpointConfidence(axiosMethod[2]),
      condition: inferCondition(context),
      followUps: [],
    });
  }

  const clientMethod = line.match(/\b(?:api|apiClient|client|http|request)\.(get|post|put|patch|delete)\s*\(\s*([^,\)]+)/i);
  if (clientMethod) {
    calls.push({
      trigger,
      kind: "api-client",
      method: clientMethod[1].toUpperCase(),
      endpoint: normalizeEndpoint(clientMethod[2]),
      functionName: enclosingFunction(context) ?? `client.${clientMethod[1]}`,
      location: `${relativePath}:${lineNumber}`,
      line: lineNumber,
      queryKey: null,
      confidence: endpointConfidence(clientMethod[2]),
      condition: inferCondition(context),
      followUps: [],
    });
  }

  return calls;
}

function detectReactQuery(line, context, lineNumber, relativePath, fallbackTrigger) {
  const calls = [];
  const queryMatch = line.match(/\buseQuery\s*\(/);
  if (queryMatch) {
    calls.push({
      trigger: "MOUNT",
      kind: "useQuery",
      method: "GET",
      endpoint: inferEndpointFromContext(context),
      functionName: inferQueryFn(context) ?? "useQuery",
      location: `${relativePath}:${lineNumber}`,
      line: lineNumber,
      queryKey: inferQueryKey(context),
      confidence: inferEndpointFromContext(context) === "확인 필요" ? "확인 필요" : "(추정)",
      condition: inferCondition(context),
      followUps: [],
    });
  }

  const mutationMatch = line.match(/\buseMutation\s*\(/);
  if (mutationMatch) {
    calls.push({
      trigger: fallbackTrigger === "SERVER" ? "SERVER" : "EVENT",
      kind: "useMutation",
      method: inferMutationMethod(context),
      endpoint: inferEndpointFromContext(context),
      functionName: inferMutationFn(context) ?? "useMutation",
      location: `${relativePath}:${lineNumber}`,
      line: lineNumber,
      queryKey: null,
      confidence: inferEndpointFromContext(context) === "확인 필요" ? "확인 필요" : "(추정)",
      condition: inferCondition(context),
      followUps: [],
    });
  }

  return calls;
}

function detectFollowUp(line, context, lineNumber, relativePath) {
  const navigation = line.match(/\b(?:router\.push|router\.replace|navigate|redirect)\s*\(\s*([^\)]+)/);
  if (navigation) {
    return {
      type: "후행-이동",
      value: normalizeEndpoint(navigation[1]),
      location: `${relativePath}:${lineNumber}`,
      confidence: endpointConfidence(navigation[1]),
    };
  }

  const invalidation = line.match(/\b(?:invalidateQueries|refetchQueries)\s*\(\s*([^\)]+)/);
  if (invalidation) {
    return {
      type: "후행-재조회",
      value: normalizeQueryKey(invalidation[1]),
      location: `${relativePath}:${lineNumber}`,
      confidence: "(추정)",
    };
  }

  if (/\brefetch\s*\(/.test(line)) {
    return {
      type: "후행-재조회",
      value: "refetch()",
      location: `${relativePath}:${lineNumber}`,
      confidence: "확인 필요",
    };
  }

  if (/\bonError\b|\.catch\s*\(|\btoast\.|alert\s*\(|setError\s*\(/.test(line)) {
    return {
      type: "후행-에러처리",
      value: line.trim(),
      location: `${relativePath}:${lineNumber}`,
      confidence: "확정",
    };
  }

  return null;
}

function buildRoutes(root, analyses) {
  return analyses
    .filter((analysis) => isRouteFile(analysis.relativePath))
    .map((analysis) => ({
      route: routeFromFile(analysis.relativePath),
      entryFile: analysis.relativePath,
      filePath: analysis.filePath,
      calls: analysis.calls,
      followUps: analysis.followUps,
      renderedComponents: analysis.renderedComponents,
      components: [],
    }))
    .sort((a, b) => a.route.localeCompare(b.route));
}

function resolveRouteComponents(root, routes, analyses) {
  const byPath = new Map(analyses.map((analysis) => [analysis.filePath, analysis]));
  const byExport = new Map();

  for (const analysis of analyses) {
    for (const name of [...analysis.exportedNames, ...analysis.componentNames]) {
      if (!byExport.has(name)) {
        byExport.set(name, []);
      }
      byExport.get(name).push(analysis);
    }
  }

  return routes.map((route) => {
    const visited = new Set();
    const collected = [];

    function visit(filePath, depth) {
      if (visited.has(filePath) || depth > 5) {
        return;
      }
      visited.add(filePath);
      const analysis = byPath.get(filePath);
      if (!analysis) {
        return;
      }
      collected.push(analysis);

      for (const imported of analysis.imports) {
        const importedAnalysis = byPath.get(imported.resolvedPath);
        if (importedAnalysis) {
          visit(imported.resolvedPath, depth + 1);
        }
      }

      for (const rendered of analysis.renderedComponents) {
        const candidates = byExport.get(rendered) ?? [];
        for (const candidate of candidates) {
          visit(candidate.filePath, depth + 1);
        }
      }
    }

    visit(route.filePath, 0);

    return {
      ...route,
      components: collected.map((analysis) => ({
        relativePath: analysis.relativePath,
        calls: analysis.calls,
        followUps: analysis.followUps,
      })),
    };
  });
}

function buildQueryIndex(analyses) {
  const index = [];
  for (const analysis of analyses) {
    for (const key of analysis.queryKeys) {
      index.push({
        queryKey: key,
        file: analysis.relativePath,
      });
    }
  }
  return index;
}

function attachQueryMatches(analysis, queryIndex) {
  const calls = analysis.calls.map((call) => ({
    ...call,
    followUps: analysis.followUps.map((followUp) => {
      if (followUp.type !== "후행-재조회") {
        return followUp;
      }
      return {
        ...followUp,
        matchedQueries: matchQueryKey(followUp.value, queryIndex),
      };
    }),
  }));

  return {
    ...analysis,
    calls,
  };
}

function matchQueryKey(value, queryIndex) {
  const normalized = normalizeQueryKey(value);
  const direct = queryIndex.filter((item) => normalizeQueryKey(item.queryKey) === normalized);
  if (direct.length > 0) {
    return direct.map((item) => `${item.queryKey} (${item.file})`);
  }

  const token = normalized.replace(/[^\w가-힣]/g, "");
  if (!token) {
    return [];
  }
  return queryIndex
    .filter((item) => normalizeQueryKey(item.queryKey).replace(/[^\w가-힣]/g, "").includes(token))
    .map((item) => `${item.queryKey} (${item.file}) 매칭 불확실(추정)`);
}

function isRouteFile(relativePath) {
  const normalized = normalizePath(relativePath);
  return (
    /^app\/.*\/(page|layout|route)\.(js|jsx|ts|tsx)$/.test(normalized) ||
    /^pages\/.*\.(js|jsx|ts|tsx)$/.test(normalized) ||
    /^src\/app\/.*\/(page|layout|route)\.(js|jsx|ts|tsx)$/.test(normalized) ||
    /^src\/pages\/.*\.(js|jsx|ts|tsx)$/.test(normalized)
  );
}

function routeFromFile(relativePath) {
  let route = normalizePath(relativePath)
    .replace(/^src\//, "")
    .replace(/\.(js|jsx|ts|tsx)$/, "");

  if (route.startsWith("app/")) {
    route = route.replace(/^app/, "").replace(/\/(page|layout|route)$/, "");
  } else if (route.startsWith("pages/")) {
    route = route.replace(/^pages/, "").replace(/\/index$/, "");
  }

  route = route
    .replace(/\([^)]+\)\//g, "")
    .replace(/\/\[[^\]]+\]/g, (segment) => `/:${segment.slice(2, -1)}`)
    .replace(/\/+$/, "");

  return route || "/";
}

function parseImports(text, filePath, root) {
  const imports = [];
  const regex = /import\s+(?:[^'"]+from\s+)?['"]([^'"]+)['"]/g;
  for (const match of text.matchAll(regex)) {
    const source = match[1];
    if (!source.startsWith(".")) {
      continue;
    }
    const resolvedPath = resolveImport(filePath, source, root);
    if (resolvedPath) {
      imports.push({ source, resolvedPath });
    }
  }
  return imports;
}

function resolveImport(filePath, source) {
  const base = path.resolve(path.dirname(filePath), source);
  const candidates = [
    base,
    ...[...SOURCE_EXTENSIONS].map((extension) => `${base}${extension}`),
    ...[...SOURCE_EXTENSIONS].map((extension) => path.join(base, `index${extension}`)),
  ];

  for (const candidate of candidates) {
    try {
      if (fs.statSync?.(candidate)?.isFile?.()) {
        return candidate;
      }
    } catch {
      // fs/promises has no sync API in ESM import; fallback below.
    }
  }
  return null;
}

function parseExports(text) {
  const names = new Set();
  for (const match of text.matchAll(/export\s+(?:default\s+)?(?:function|const|class)\s+([A-Z][A-Za-z0-9_]*)/g)) {
    names.add(match[1]);
  }
  return [...names];
}

function parseComponentNames(text, filePath) {
  const names = new Set();
  const basename = path.basename(filePath, path.extname(filePath));
  if (/^[A-Z]/.test(basename)) {
    names.add(basename);
  }
  for (const match of text.matchAll(/(?:function|const)\s+([A-Z][A-Za-z0-9_]*)\b/g)) {
    names.add(match[1]);
  }
  return [...names];
}

function parseRenderedComponents(text) {
  const names = new Set();
  for (const match of text.matchAll(/<([A-Z][A-Za-z0-9_]*)\b/g)) {
    names.add(match[1]);
  }
  return [...names];
}

function collectQueryKeys(text) {
  const keys = new Set();
  for (const match of text.matchAll(/queryKey\s*:\s*([^,\n\}]+)/g)) {
    keys.add(normalizeQueryKey(match[1]));
  }
  for (const match of text.matchAll(/useQuery\s*\(\s*([^,\n\)]+)/g)) {
    keys.add(normalizeQueryKey(match[1]));
  }
  return [...keys].filter(Boolean);
}

function collectNotes(text) {
  const notes = [];
  if (/process\.env|NEXT_PUBLIC_|import\.meta\.env/.test(text)) {
    notes.push("환경 변수 의존 항목 있음");
  }
  if (/`[^`]*\$\{/.test(text)) {
    notes.push("동적 문자열 조합 있음: 엔드포인트 추정 가능성");
  }
  return notes;
}

function getContext(lines, index) {
  const start = Math.max(0, index - 8);
  const end = Math.min(lines.length, index + 12);
  return lines.slice(start, end).join("\n");
}

function inferTrigger(lines, index) {
  const context = getContext(lines, index);
  if (/getServerSideProps|getStaticProps|getInitialProps|export\s+default\s+async\s+function|async\s+function\s+Page/.test(context)) {
    return "SERVER";
  }
  if (/useEffect\s*\(/.test(context) || /\buseQuery\s*\(/.test(context)) {
    return "MOUNT";
  }
  if (/onClick|onSubmit|onChange|handle[A-Z]|useMutation\s*\(/.test(context)) {
    return "EVENT";
  }
  return "확인 필요";
}

function inferFetchMethod(context) {
  const method = context.match(/method\s*:\s*['"`](GET|POST|PUT|PATCH|DELETE)['"`]/i);
  return method ? method[1].toUpperCase() : "GET";
}

function inferMutationMethod(context) {
  for (const method of HTTP_METHODS.filter((item) => item !== "GET")) {
    if (new RegExp(`\\b${method.toLowerCase()}\\b|['"\`]${method}['"\`]`, "i").test(context)) {
      return method;
    }
  }
  return "확인 필요";
}

function inferEndpointFromContext(context) {
  const fetchEndpoint = context.match(/\bfetch\s*\(\s*([^,\)]+)/);
  if (fetchEndpoint) {
    return normalizeEndpoint(fetchEndpoint[1]);
  }
  const clientEndpoint = context.match(/\b(?:axios|api|apiClient|client|http|request)\.(?:get|post|put|patch|delete)\s*\(\s*([^,\)]+)/i);
  if (clientEndpoint) {
    return normalizeEndpoint(clientEndpoint[1]);
  }
  const pathLike = context.match(/['"`](\/api\/[^'"`\s\)]*)['"`]/);
  if (pathLike) {
    return pathLike[1];
  }
  return "확인 필요";
}

function inferQueryFn(context) {
  const queryFn = context.match(/queryFn\s*:\s*([A-Za-z0-9_]+)/);
  if (queryFn) {
    return queryFn[1];
  }
  const positional = context.match(/useQuery\s*\([^,]+,\s*([A-Za-z0-9_]+)/);
  return positional?.[1] ?? null;
}

function inferMutationFn(context) {
  const mutationFn = context.match(/mutationFn\s*:\s*([A-Za-z0-9_]+)/);
  if (mutationFn) {
    return mutationFn[1];
  }
  const positional = context.match(/useMutation\s*\(\s*([A-Za-z0-9_]+)/);
  return positional?.[1] ?? null;
}

function inferQueryKey(context) {
  const objectStyle = context.match(/queryKey\s*:\s*([^,\n\}]+)/);
  if (objectStyle) {
    return normalizeQueryKey(objectStyle[1]);
  }
  const positional = context.match(/useQuery\s*\(\s*([^,\n\)]+)/);
  return positional ? normalizeQueryKey(positional[1]) : null;
}

function inferCondition(context) {
  const enabled = context.match(/enabled\s*:\s*([^,\n\}]+)/);
  if (enabled) {
    return `enabled: ${enabled[1].trim()}`;
  }
  const guard = context.match(/if\s*\(([^\)]+)\)\s*\{/);
  return guard ? `조건부 실행 가능: if (${guard[1].trim()})` : "없음 또는 확인 필요";
}

function enclosingFunction(context) {
  const matches = [...context.matchAll(/(?:function\s+|const\s+)([A-Za-z0-9_]+)\b/g)];
  return matches.at(-1)?.[1] ?? null;
}

function normalizeEndpoint(raw) {
  return raw
    .trim()
    .replace(/^[`'"]|[`'"]$/g, "")
    .replace(/,$/, "")
    .trim();
}

function endpointConfidence(raw) {
  return /[`]\s*[^`]*\$\{|[A-Za-z0-9_]+\s*\+|process\.env|import\.meta\.env/.test(raw) ? "(추정)" : "확정";
}

function normalizeQueryKey(raw) {
  return String(raw ?? "")
    .trim()
    .replace(/^\{\s*queryKey\s*:\s*/, "")
    .replace(/^[`'"]|[`'"]$/g, "")
    .replace(/,$/, "")
    .trim();
}

function dedupeByLocation(calls) {
  const seen = new Set();
  return calls.filter((call) => {
    const key = `${call.kind}:${call.location}:${call.endpoint}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function normalizePath(value) {
  return value.replace(/\\/g, "/");
}
