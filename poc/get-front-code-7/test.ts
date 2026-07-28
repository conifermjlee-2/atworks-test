import * as path from 'path';
import { parseFile } from './src/features/analysis/ast/Parser';
import { findScenarios } from './src/core/parser/ast-traverser';
import { AxiosFetchResolver } from './src/resolvers/axios-fetch-resolver';
import { ReactQueryResolver } from './src/resolvers/react-query-resolver';

const file = 'C:/Users/lee/Desktop/atworks-test/poc/tmp-project/tmp-project-5-shopping-mall/src/app/page.tsx';
const root = 'C:/Users/lee/Desktop/atworks-test/poc/tmp-project/tmp-project-5-shopping-mall';

const ast = parseFile(file);
if (ast) {
  const resolvers = [new AxiosFetchResolver(), new ReactQueryResolver()];
  const scenarios = findScenarios(ast, resolvers, file, root);
  console.log(JSON.stringify(scenarios, null, 2));
} else {
  console.log("Failed to parse");
}
