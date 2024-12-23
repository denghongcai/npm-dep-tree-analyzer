import { NpmDepTreeAnalyzer } from '../index';

async function main() {
  // Initialize analyzer with custom registry
  const analyzer = new NpmDepTreeAnalyzer({
    registry: 'https://registry.anpm.alibaba-inc.com',
    timeout: 30000,
    headers: {
      'User-Agent': 'npm-dep-tree-analyzer-example'
    }
  });

  // Example package to analyze
  const packageName = 'tailwindcss';
  const version = 'latest';

  console.log(`\nExample 1: Analyzing ${packageName}@${version}...`);
  const result = await analyzer.analyze(packageName, version);

  // Print dependency tree
  console.log('\nDependency Tree:');
  NpmDepTreeAnalyzer.printDependencyTree(result.dependencyTree);

  // Print hoisted tree
  console.log('\nHoisted Tree:');
  NpmDepTreeAnalyzer.printHoistedTree(result.hoistedTree);
}

main().catch(console.error);
