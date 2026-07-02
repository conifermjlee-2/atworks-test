import { NextRequest, NextResponse } from 'next/server';
import { JSONPath } from 'jsonpath-plus';

// Disable TLS verification for PoC/testing local self-signed APIs
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { url, method, headers, rules } = body;

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    // 1. 외부 API 대리 호출 (프론트에서 넘겨준 URL 찌르기)
    // 주의: 프론트에서 넘어온 'rules(검증 규칙)'는 이 단계에서 외부 API로 전송하지 않습니다!
    // 순수하게 데이터만 받아오기 위해 요청(request)만 수행합니다.
    let statusCode = 500;
    let responseBody = '';

    try {
      const fetchRes = await fetch(url, {
        method: method || 'GET',
        headers: headers || {},
      });
      statusCode = fetchRes.status;
      const text = await fetchRes.text();
      responseBody = text;
    } catch (e: any) {
      console.error('API Fetch Error:', e);
      responseBody = e.message;
    }

    const executionResult = {
      statusCode,
      responseBody
    };

    // 2. 응답 데이터 검증 (채점 단계)
    // 프론트엔드에서 'rules(검증 규칙)'를 보냈을 경우에만 이 블록이 실행됩니다.
    // 만약 빈 배열([])을 보냈다면 이 과정은 통째로 건너뜁니다.
    let validationResults = null;
    let globalPassed = null;

    if (rules && rules.length > 0) {
      validationResults = [];
      globalPassed = true;
      let parsedJson = null;
      try {
        parsedJson = JSON.parse(responseBody);
      } catch (e) {
        // Not JSON
      }

      for (let i = 0; i < rules.length; i++) {
        const rule = rules[i];
        let actualValue = 'N/A (Invalid JSON)';
        let passed = false;

        if (parsedJson) {
          try {
            // [핵심 배려 코드] JSONPath 문법 자동 교정
            // JSONPath-plus 라이브러리는 무조건 경로가 '$' 로 시작해야 작동합니다.
            // 사용자가 화면에서 편하게 '[0].name' 이나 'data.id' 라고 대충 입력하더라도,
            // 서버가 찰떡같이 알아듣고 맨 앞에 '$'를 붙여주는 똑똑한 방어 코드입니다!
            let path = rule.fieldPath;
            if (path && !path.startsWith('$')) {
              // '[' 로 시작하면 그대로 '$'만 붙이고 ($[0].name),
              // 알파벳으로 시작하면 중간에 점(.)을 찍어줍니다 ($.data.id)
              path = '$' + (path.startsWith('[') ? '' : '.') + path;
            }

            const result = JSONPath({ path, json: parsedJson });

            console.log("result", result);

            if (result && result.length > 0) {
              actualValue = String(result[0]);
              // [채점 실행] 빨간펜 선생님(evaluateCondition) 호출!
              // 찾은 실제값(actualValue)과 정답지(연산자, 기대값, 타입)를 넘겨서 통과 여부(true/false)를 받아옵니다.
              passed = evaluateCondition(actualValue, rule.operator, rule.expectedValue, rule.valueType);
            } else {
              actualValue = 'N/A (Path not found)';
              passed = false;
            }
          } catch (e: any) {
            actualValue = `Error: ${e.message}`;
            passed = false;
          }
        }

        validationResults.push({
          rule,
          actualValue,
          passed
        });
      }

      // 3. 최종 합격 여부(globalPassed) 판정
      // 단순히 모든 규칙을 채점한 것을 넘어서, 논리 연산자(AND, OR, NONE)를 바탕으로
      // 최종적으로 이 API 테스트가 통과(true)인지 실패(false)인지 계산합니다.
      globalPassed = true;
      let currentGroupPassed = true;

      for (let i = 0; i < rules.length; i++) {
        const rule = rules[i];
        const passed = validationResults[i].passed;

        if (rule.logicalOperator === 'NONE') {
          // If previous group failed, global fails
          if (!currentGroupPassed) globalPassed = false;
          // Start new group
          currentGroupPassed = passed;
        } else if (rule.logicalOperator === 'AND') {
          currentGroupPassed = currentGroupPassed && passed;
        } else if (rule.logicalOperator === 'OR') {
          currentGroupPassed = currentGroupPassed || passed;
        }
      }
      // Check last group
      if (!currentGroupPassed) globalPassed = false;
    }

    // 4. 성적표 반환
    // 프론트엔드 화면으로 원본 데이터(executionResult), 채점 내역(validationResults), 최종 합격 도장(globalPassed)을 돌려보냅니다.
    return NextResponse.json({
      executionResult,
      validationResults,
      globalPassed
    });

  } catch (error: any) {
    console.error('Execution Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// [빨간펜 선생님] 실제 채점 로직 함수
// 데이터 타입(숫자, 불리언, 문자열)에 따라 다르게 비교하여 정답(true)인지 오답(false)인지 판정합니다.
function evaluateCondition(actualStr: string, operator: string, expectedStr: string, valueType: string): boolean {
  try {
    if (valueType === 'NUMBER' || valueType === 'number') {
      // 1. 숫자(NUMBER)일 경우: 글자를 진짜 숫자로 변환(parseFloat)하여 크기 및 일치 여부를 엄격하게 비교합니다.
      const actual = parseFloat(actualStr);
      const expected = parseFloat(expectedStr);
      switch (operator) {
        case '=': return actual === expected;
        case '!=': return actual !== expected;
        case '>': return actual > expected;
        case '<': return actual < expected;
        case '>=': return actual >= expected;
        case '<=': return actual <= expected;
        default: return false;
      }
    } else if (valueType === 'BOOLEAN' || valueType === 'boolean') {
      // 2. 참/거짓(BOOLEAN)일 경우: 글자가 'true'인지 논리적으로 확인하여 일치 여부만 단순 비교합니다.
      const actual = actualStr.toLowerCase() === 'true';
      const expected = expectedStr.toLowerCase() === 'true';
      switch (operator) {
        case '=': return actual === expected;
        case '!=': return actual !== expected;
        default: return false;
      }
    } else {
      // 3. 문자열(STRING)일 경우: 글자가 완전히 똑같은지(=), 혹은 일부 문자가 포함되어 있는지(contains) 등을 검사합니다.
      switch (operator) {
        case '=': return actualStr === expectedStr;
        case '!=': return actualStr !== expectedStr;
        case '>': return actualStr > expectedStr;
        case '<': return actualStr < expectedStr;
        case '>=': return actualStr >= expectedStr;
        case '<=': return actualStr <= expectedStr;
        case 'contains': return actualStr.includes(expectedStr);
        default: return false;
      }
    }
  } catch (e) {
    return false;
  }
}
