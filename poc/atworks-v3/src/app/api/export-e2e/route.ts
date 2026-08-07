import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { url, scenario } = await req.json();
    if (!scenario) {
      return NextResponse.json({ error: 'No scenario provided' }, { status: 400 });
    }

    let code = `import { test, expect } from '@playwright/test';\n\n`;
    code += `test('${scenario.title || 'Auto-generated AI Scenario'}', async ({ page }) => {\n`;
    code += `  // Navigate to target URL\n`;
    code += `  await page.goto('${url || 'http://localhost:3002'}');\n\n`;

    const steps = scenario.flow || scenario.steps || scenario.actions || scenario.scenario || [];
    
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      let stepName = typeof step === 'string' ? step : (step.description || step.user_action || step.userAction || step.action || step.task || step.activity || step.name || step.title || `Step ${i + 1}`);
      
      code += `  await test.step('${stepName.replace(/'/g, "\\'")}', async () => {\n`;
      
      if (typeof step === 'object') {
        if (step.type === 'navigate' && step.target) {
          code += `    // AI Action: Navigate to ${step.target}\n`;
          code += `    // await page.goto('${url}' + '${step.target}');\n`;
        } else if (step.type === 'api_call' && step.endpoint) {
          if ((step.method || 'GET').toUpperCase() === 'GET') {
            code += `    // Wait for GET API response\n`;
            code += `    // const response = await page.waitForResponse(res => res.url().includes('${step.endpoint}'));\n`;
            code += `    // expect(response.status()).toBe(200);\n`;
          } else {
            code += `    // AI Action: Trigger ${step.method || 'POST'} API ${step.endpoint}\n`;
          }
        } else {
          code += `    // AI Action: ${stepName}\n`;
        }

        const apis = step.apis || step.apiCalls || step.triggered_apis || (step.api_call ? [step.api_call] : step.apiCall ? [step.apiCall] : step.api ? [step.api] : []);
        for (const api of apis) {
          if (typeof api === 'string') {
             code += `    // API: ${api}\n`;
          } else {
             if ((api.method || 'GET').toUpperCase() === 'GET') {
               code += `    // Wait for GET API response\n`;
               code += `    // const response = await page.waitForResponse(res => res.url().includes('${api.endpoint || api.url}'));\n`;
               code += `    // expect(response.status()).toBe(200);\n`;
             } else {
               code += `    // API: ${api.method || 'POST'} ${api.endpoint || api.url}\n`;
             }
          }
        }
      } else {
        code += `    // AI Action: ${stepName}\n`;
      }
      
      code += `  });\n\n`;
    }

    code += `});\n`;

    return new NextResponse(code, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8'
      }
    });

  } catch (err: any) {
    console.error('Export Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
