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

  // Example packages to analyze
  const packages = [
    { name: 'express', version: '4.18.2' },
    { name: 'react', version: '18.2.0' },
    { name: '@testing-library/react', version: '14.1.2' },
  ];

  console.log('\nExample 2: Analyzing multiple packages...');
  const result = await analyzer.analyze(packages);

  // Print combined hoisted tree
  console.log('\nCombined Hoisted Tree:');
  NpmDependencyAnalyzer.printHoistedTree(result.combined.hoistedTree);

  // // Print individual dependency trees
  // console.log('\nIndividual Package Trees:');
  // for (const [pkgKey, analysis] of result.individual) {
  //     console.log(`\nDependency Tree for ${pkgKey}:`);
  //     NpmDependencyAnalyzer.printDependencyTree(analysis.dependencyTree);
  // }
}

main().catch(console.error);
