import { formatPromptEvalReport, runPromptEval } from './runner.js';

const report = runPromptEval();

console.log(formatPromptEvalReport(report));

if (!report.ok) {
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = 1;
}
