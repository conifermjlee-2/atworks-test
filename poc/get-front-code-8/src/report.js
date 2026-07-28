import fs from "node:fs/promises";
import path from "node:path";

export async function writeReports(result, outDir) {
  await fs.mkdir(outDir, { recursive: true });
  await Promise.all([
    fs.writeFile(path.join(outDir, "component-api-scenarios.md"), renderComponentReport(result), "utf8"),
    fs.writeFile(path.join(outDir, "route-api-scenarios.md"), renderRouteReport(result), "utf8"),
    fs.writeFile(path.join(outDir, "analysis-summary.json"), `${JSON.stringify(result, null, 2)}\n`, "utf8"),
  ]);
}

function renderComponentReport(result) {
  const lines = [
    "# 컴포넌트별 API 시나리오 문서",
    "",
    `- 분석 대상: \`${result.projectRoot}\``,
    `- 생성 시각: ${result.generatedAt}`,
    `- API 호출: ${result.stats.apiCalls}건`,
    `- 확정: ${result.stats.confirmed}건 / 추정: ${result.stats.estimated}건`,
    "",
  ];

  if (result.components.length === 0) {
    lines.push("API 호출 지점을 찾지 못했습니다.");
    return lines.join("\n");
  }

  for (const component of result.components) {
    lines.push(`## ${component.relativePath}`, "");

    if (component.notes.length > 0) {
      lines.push(`- 참고: ${component.notes.join(", ")}`, "");
    }

    component.calls.forEach((call, index) => {
      lines.push(`${String(index + 1).padStart(2, "0")}. ${triggerIcon(call.trigger)} ${call.trigger} \`${call.kind}\` (${call.location})`);
      lines.push(`    ${call.method} ${call.endpoint} (${call.functionName})`);
      if (call.queryKey) {
        lines.push(`    - queryKey: \`${call.queryKey}\``);
      }
      lines.push(`    - 호출 조건: ${call.condition}`);
      lines.push(`    - 신뢰도: ${call.confidence}`);
      const followUps = call.followUps.length > 0 ? call.followUps : component.followUps;
      if (followUps.length === 0) {
        lines.push("    - 후행 동작: 확인 필요");
      } else {
        for (const followUp of followUps) {
          lines.push(`    - ${followUp.type}: ${followUp.value} (${followUp.location}, ${followUp.confidence})`);
          if (followUp.matchedQueries?.length > 0) {
            lines.push(`      매칭 useQuery: ${followUp.matchedQueries.join("; ")}`);
          }
        }
      }
      lines.push("");
    });

    if (component.calls.length === 0 && component.followUps.length > 0) {
      lines.push("- API 호출은 확인되지 않았지만 후행 동작 후보가 있습니다.");
      for (const followUp of component.followUps) {
        lines.push(`  - ${followUp.type}: ${followUp.value} (${followUp.location})`);
      }
      lines.push("");
    }
  }

  return lines.join("\n");
}

function renderRouteReport(result) {
  const lines = [
    "# 라우팅별 API 시나리오 문서",
    "",
    `- 분석 대상: \`${result.projectRoot}\``,
    `- 생성 시각: ${result.generatedAt}`,
    `- 라우트 수: ${result.routes.length}`,
    "",
    "## 라우트 맵",
    "",
  ];

  if (result.routes.length === 0) {
    lines.push("Next.js 라우트 파일을 찾지 못했습니다.");
    return lines.join("\n");
  }

  for (const route of result.routes) {
    lines.push(`- \`${route.route}\` -> \`${route.entryFile}\``);
  }

  lines.push("");

  for (const route of result.routes) {
    lines.push(`## [ ${route.route} ]`, "");
    lines.push(`- 진입 파일: \`${route.entryFile}\``);
    lines.push(`- 렌더링/참조 컴포넌트: ${route.components.map((item) => `\`${item.relativePath}\``).join(", ") || "확인 필요"}`);
    lines.push("");

    const calls = route.components.flatMap((component) =>
      component.calls.map((call) => ({
        ...call,
        component: component.relativePath,
      })),
    );

    if (calls.length === 0) {
      lines.push("- API 호출 지점: 확인 필요", "");
      continue;
    }

    for (const call of sortCallsByTrigger(calls)) {
      lines.push(`- ${routePhase(call.trigger)}: ${call.method} ${call.endpoint}`);
      lines.push(`  - 위치: \`${call.location}\` / 컴포넌트: \`${call.component}\``);
      lines.push(`  - 호출 함수명: ${call.functionName}`);
      if (call.queryKey) {
        lines.push(`  - queryKey: \`${call.queryKey}\``);
      }
      lines.push(`  - 호출 조건: ${call.condition}`);
      lines.push(`  - 신뢰도: ${call.confidence}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

function sortCallsByTrigger(calls) {
  const order = { SERVER: 0, MOUNT: 1, EVENT: 2, "확인 필요": 3 };
  return [...calls].sort((a, b) => (order[a.trigger] ?? 9) - (order[b.trigger] ?? 9) || a.line - b.line);
}

function triggerIcon(trigger) {
  if (trigger === "SERVER") return "서버";
  if (trigger === "MOUNT") return "마운트";
  if (trigger === "EVENT") return "이벤트";
  return "확인";
}

function routePhase(trigger) {
  if (trigger === "SERVER") return "진입-서버";
  if (trigger === "MOUNT") return "진입-클라이언트";
  if (trigger === "EVENT") return "이벤트";
  return "확인 필요";
}
