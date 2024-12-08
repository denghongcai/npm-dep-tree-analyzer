# npm-dep-tree-analyzer

A powerful TypeScript library for analyzing npm package dependencies, providing comprehensive dependency tree analysis and visualization with hoisting support.

[![CI](https://github.com/denghongcai/npm-dep-tree-analyzer/actions/workflows/ci.yml/badge.svg)](https://github.com/denghongcai/npm-dep-tree-analyzer/actions/workflows/ci.yml)

## Features

- 🔍 **Deep Dependency Analysis**: Analyze direct and transitive dependencies
- 🌳 **Dependency Tree Generation**: Generate detailed dependency trees with version information
- 📦 **Hoisting Support**: Simulate npm's package hoisting behavior
- ⚡ **Parallel Processing**: Fast dependency resolution with concurrent package fetching
- 🎯 **Version Conflict Detection**: Identify and report version conflicts
- 🤝 **Peer Dependency Handling**: Comprehensive peer dependency analysis and validation
- 💾 **Smart Caching**: Built-in caching to reduce registry requests

## Installation

```bash
npm install npm-dep-tree-analyzer
```

## Usage

### Analyzing a Single Package

```typescript
import { NpmDepTreeAnalyzer } from 'npm-dep-tree-analyzer';

const analyzer = new NpmDepTreeAnalyzer();
const result = await analyzer.analyze('next', '14.0.3');

// Print dependency tree
NpmDepTreeAnalyzer.printDependencyTree(result.dependencyTree);

// Print hoisted tree (similar to node_modules structure)
NpmDepTreeAnalyzer.printHoistedTree(result.hoistedTree);
```

### Analyzing Multiple Packages

```typescript
import { NpmDepTreeAnalyzer } from 'npm-dep-tree-analyzer';

const analyzer = new NpmDepTreeAnalyzer({
  registry: 'https://registry.npmmirror.com',
  timeout: 30000,
  headers: {
    'User-Agent': 'npm-dep-tree-analyzer-example'
  }
});

const packages = [
  { name: 'express', version: '4.18.2' },
  { name: 'react', version: '18.2.0' },
  { name: '@testing-library/react', version: '14.1.2' }
];

const result = await analyzer.analyze(packages);

// Print combined hoisted tree
NpmDepTreeAnalyzer.printHoistedTree(result.combined.hoistedTree);

// Print individual dependency trees
for (const [pkgKey, analysis] of result.individual) {
  console.log(`\nDependency Tree for ${pkgKey}:`);
  NpmDepTreeAnalyzer.printDependencyTree(analysis.dependencyTree);
}
```

## API Reference

### `NpmDepTreeAnalyzer`

The main class for analyzing npm package dependencies.

#### Constructor Options

```typescript
interface NpmRegistryConfig {
  registry?: string;      // npm registry URL (default: 'https://registry.npmjs.org')
  timeout?: number;       // request timeout in milliseconds (default: 30000)
  headers?: Record<string, string>;  // custom headers for registry requests
}
```

#### Methods

- `analyze(packageName: string, version: string): Promise<AnalysisResult>`
  Analyzes a single package and returns its dependency information.

- `analyze(packages: Array<{ name: string, version: string }>): Promise<MultiPackageAnalysisResult>`
  Analyzes multiple packages and returns combined dependency information.

- `static printDependencyTree(node: DependencyNode): void`
  Prints a hierarchical view of the dependency tree.

- `static printHoistedTree(tree: HoistedTree): void`
  Prints a visualization of the hoisted dependency tree (similar to node_modules structure).

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Type checking
npm run type-check

# Build
npm run build
```

## License

Apache-2.0
