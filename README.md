# npm-dependency-analyzer

A powerful TypeScript library for analyzing npm package dependencies, providing comprehensive dependency tree analysis and visualization.

[![CI](https://github.com/denghongcai/npm-dependency-analyzer/actions/workflows/ci.yml/badge.svg)](https://github.com/denghongcai/npm-dependency-analyzer/actions/workflows/ci.yml)

## Features

- 🔍 **Deep Dependency Analysis**: Analyze direct and transitive dependencies
- 🌳 **Dependency Tree Generation**: Generate detailed dependency trees with version information
- ⚡ **Parallel Processing**: Fast dependency resolution with concurrent package fetching
- 🎯 **Version Conflict Detection**: Identify and report version conflicts
- 🤝 **Peer Dependency Handling**: Comprehensive peer dependency analysis and validation
- 💾 **Smart Caching**: Built-in caching to reduce registry requests

## Installation

```bash
npm install npm-dependency-analyzer
```

## Usage

### Analyzing a Single Package

```typescript
import { NpmDependencyAnalyzer } from 'npm-dependency-analyzer';

const analyzer = new NpmDependencyAnalyzer();
const result = await analyzer.analyze('react', '18.2.0');

// Print dependency tree
console.log(analyzer.printDependencyTree(result.dependencyTree));
```

### Analyzing Multiple Packages

```typescript
import { NpmDependencyAnalyzer } from 'npm-dependency-analyzer';

const analyzer = new NpmDependencyAnalyzer();
const result = await analyzer.analyze([
  { name: 'react', version: '18.2.0' },
  { name: '@testing-library/react', version: '14.1.2' }
]);

// Print hoisted tree with peer dependency status
console.log(analyzer.printHoistedTree(result.hoistedTree));
```

## API Reference

### `NpmDependencyAnalyzer`

#### Constructor Options

```typescript
{
  registry?: string;         // Custom npm registry URL (default: https://registry.npmjs.org)
  timeout?: number;         // Request timeout in milliseconds (default: 30000)
  cache?: boolean;         // Enable package info caching (default: true)
}
```

#### Methods

- `analyze(packageName: string, version: string)`: Analyze a single package
- `printDependencyTree(node: DependencyNode)`: Print dependency tree in a readable format
- `printHoistedTree(node: DependencyNode)`: Print hoisted tree with peer dependency status

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

Apache-2.0 - see [LICENSE](LICENSE) for details.
