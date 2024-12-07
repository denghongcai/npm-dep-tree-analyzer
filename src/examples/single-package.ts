import { NpmDependencyAnalyzer } from '../index';

async function main() {
    // Initialize analyzer with custom registry
    const analyzer = new NpmDependencyAnalyzer({
        registry: 'https://registry.npmmirror.com',
        timeout: 30000,
        headers: {
            'User-Agent': 'npm-dependency-analyzer-example'
        }
    });

    // Analyze express package
    console.log('\nExample 1: Analyzing express@4.18.2...');
    const result = await analyzer.analyze('express', '4.18.2');
    
    // Print dependency tree
    console.log('\nDependency Tree:');
    NpmDependencyAnalyzer.printDependencyTree(result.dependencyTree);
    
    // Print hoisted tree (node_modules structure)
    console.log('\nHoisted Tree:');
    NpmDependencyAnalyzer.printHoistedTree(result.hoistedTree);
}

main().catch(console.error);
