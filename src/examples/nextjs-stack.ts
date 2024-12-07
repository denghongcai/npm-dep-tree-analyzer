import { NpmDependencyAnalyzer } from '../index';

async function main() {
  // Initialize analyzer with custom registry
  const analyzer = new NpmDependencyAnalyzer({
    registry: 'https://registry.npmmirror.com',
    timeout: 30000,
    headers: {
      'User-Agent': 'npm-dependency-analyzer-example',
    },
  });

  // Analyze Next.js stack packages
  const packages = [
    { name: 'next', version: '14.0.3' },
    { name: 'react', version: '18.2.0' },
    { name: 'typescript', version: '5.3.2' },
  ];

  console.log('\nExample 3: Analyzing Next.js stack...');
  const result = await analyzer.analyze(packages);

  // Print combined hoisted tree
  console.log('\nCombined Hoisted Tree:');
  NpmDependencyAnalyzer.printHoistedTree(result.combined.hoistedTree);

  // Print individual dependency trees
  console.log('\nIndividual Package Trees:');
  for (const [pkgKey, analysis] of result.individual) {
    console.log(`\nDependency Tree for ${pkgKey}:`);
    NpmDependencyAnalyzer.printDependencyTree(analysis.dependencyTree);
  }
}

main().catch(console.error);
