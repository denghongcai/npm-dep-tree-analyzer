import * as semver from 'semver';

interface PackageInfo {
  name: string;
  version: string;
  dependencies?: { [key: string]: string };
  devDependencies?: { [key: string]: string };
  peerDependencies?: { [key: string]: string };
}

export interface DependencyNode {
  name: string;
  version: string;
  dependencies: Map<string, DependencyNode>;
  peerDependencies: Map<string, string>; // key: package name, value: version range
}

export interface FlatDependency {
  name: string;
  version: string;
  requiredBy: Set<string>;
}

interface HoistedDependency {
  name: string;
  version: string;
  dependencies: Map<string, string>; // key: package name, value: version
  peerDependencies: Map<string, string>; // key: package name, value: version range
  parent?: string; // undefined means it's hoisted to root
}

export interface HoistedTree {
  root: Map<string, HoistedDependency>; // hoisted dependencies
  nested: Map<string, Map<string, HoistedDependency>>; // nested dependencies that couldn't be hoisted
}

interface NpmRegistryConfig {
  registry?: string; // npm registry URL
  timeout?: number; // request timeout in milliseconds
  headers?: Record<string, string>; // custom headers for registry requests
}

interface PackageRequest {
  name: string;
  version: string;
}

export interface AnalysisResult {
  dependencyTree: DependencyNode;
  hoistedTree: HoistedTree;
  flatDependencies: Map<string, FlatDependency>;
}

export interface MultiPackageAnalysisResult {
  individual: Map<string, AnalysisResult>;
  combined: {
    hoistedTree: HoistedTree;
    flatDependencies: Map<string, FlatDependency>;
  };
}

export class NpmDepTreeAnalyzer {
  private readonly defaultRegistry = 'https://registry.npmjs.org';
  private readonly defaultTimeout = 30000; // 30 seconds
  private readonly config: Required<NpmRegistryConfig>;
  private readonly packageCache = new Map<string, PackageInfo>();

  constructor(config: NpmRegistryConfig = {}) {
    this.config = {
      registry: config.registry || this.defaultRegistry,
      timeout: config.timeout || this.defaultTimeout,
      headers: {
        Accept: 'application/json',
        ...config.headers,
      },
    };
  }

  private async getPackageInfo(
    name: string,
    version: string
  ): Promise<PackageInfo> {
    const cacheKey = `${name}@${version}`;
    if (this.packageCache.has(cacheKey)) {
      return this.packageCache.get(cacheKey)!;
    }

    try {
      // First fetch the package metadata to get all versions
      const metadataResponse = await fetch(
        `${this.config.registry}/${name}`,
        {
          headers: this.config.headers,
          signal: AbortSignal.timeout(this.config.timeout),
        }
      );

      if (!metadataResponse.ok) {
        throw new PackageNotFoundError(name, version);
      }

      const metadata = await metadataResponse.json();
      const versions = metadata.versions || {};
      
      // Find the exact version or best matching version
      let matchedVersion: string | null = null;
      if (versions[version]) {
        // Exact version match
        matchedVersion = version;
      } else if (metadata['dist-tags'] && metadata['dist-tags'][version]) {
        // Check if the version is a known dist-tag
        matchedVersion = metadata['dist-tags'][version];
      } else if (semver.validRange(version)) {
        // Find highest version that satisfies the range
        matchedVersion = semver.maxSatisfying(Object.keys(versions), version);
      }

      if (!matchedVersion) {
        throw new PackageNotFoundError(
          name,
          version,
          new Error('No matching version found')
        );
      }

      const packageInfo: PackageInfo = {
        name: metadata.versions[matchedVersion].name,
        version: matchedVersion,
        dependencies: metadata.versions[matchedVersion].dependencies || {},
        devDependencies: metadata.versions[matchedVersion].devDependencies || {},
        peerDependencies: metadata.versions[matchedVersion].peerDependencies || {},
      };

      // Cache the result
      this.packageCache.set(cacheKey, packageInfo);
      return packageInfo;
    } catch (error) {
      throw new PackageNotFoundError(
        name,
        version,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  private async buildDependencyTree(
    name: string,
    version: string,
    flatDeps: Map<string, FlatDependency>,
    parentPath: string = ''
  ): Promise<DependencyNode> {
    const packageInfo = await this.getPackageInfo(name, version);
    const node: DependencyNode = {
      name,
      version: packageInfo.version,
      dependencies: new Map(),
      peerDependencies: new Map(
        Object.entries(packageInfo.peerDependencies ?? {})
      ),
    };

    const currentPath = parentPath
      ? `${parentPath} > ${name}@${packageInfo.version}`
      : `${name}@${packageInfo.version}`;

    // Add to flat dependencies
    const key = `${name}@${packageInfo.version}`;
    if (!flatDeps.has(key)) {
      flatDeps.set(key, {
        name,
        version: packageInfo.version,
        requiredBy: new Set([parentPath || 'root']),
      });
    } else {
      flatDeps.get(key)!.requiredBy.add(parentPath || 'root');
    }

    // Process regular dependencies
    const dependencyPromises = Object.entries(
      packageInfo.dependencies ?? {}
    ).map(async ([depName, depVersion]) => {
      const depNode = await this.buildDependencyTree(
        depName,
        depVersion,
        flatDeps,
        currentPath
      );
      return { depName, depNode };
    });

    // Wait for all dependencies to be processed in parallel
    const results = await Promise.all(dependencyPromises);

    // Add successful results to the dependencies map
    results.forEach((result) => {
      if (result) {
        node.dependencies.set(result.depName, result.depNode);
      }
    });

    return node;
  }

  public static printDependencyTree(node: DependencyNode, prefix: string = '') {
    console.log(`${prefix}${node.name}@${node.version}`);

    // Print peer dependencies if any
    if (node.peerDependencies.size > 0) {
      console.log(`${prefix}├── [peer dependencies]`);
      for (const [name, version] of node.peerDependencies) {
        console.log(`${prefix}│   └── ${name}@${version}`);
      }
    }

    // Print regular dependencies
    const entries = Array.from(node.dependencies.entries());
    entries.forEach(([name, dep], index) => {
      const isLast = index === entries.length - 1;
      const newPrefix = prefix + (isLast ? '└── ' : '├── ');
      const childPrefix = prefix + (isLast ? '    ' : '│   ');
      NpmDepTreeAnalyzer.printDependencyTree(dep, newPrefix);
    });
  }

  static printFlatDependencies(flatDeps: Map<string, FlatDependency>): void {
    console.log('\nFlat Dependencies:');
    flatDeps.forEach((dep, key) => {
      console.log(`\n${key}:`);
      if (dep.requiredBy.size > 0) {
        console.log('  Required by:');
        dep.requiredBy.forEach((parent) => {
          console.log(`    - ${parent}`);
        });
      }
    });
  }

  static printHoistedTree(hoistedTree: HoistedTree): void {
    console.log(
      '\nHoisted Dependency Tree (similar to node_modules structure):'
    );
    console.log('\nnode_modules/');

    // Print root level dependencies
    for (const [name, dep] of hoistedTree.root) {
      console.log(`├── ${name}@${dep.version}`);

      // Print dependencies
      if (dep.dependencies.size > 0) {
        console.log('│   ├── dependencies:');
        for (const [depName, depVersion] of dep.dependencies) {
          console.log(`│   │   ├── ${depName}@${depVersion}`);
        }
      }

      // Print peer dependencies and check if they are satisfied
      if (dep.peerDependencies.size > 0) {
        console.log('│   ├── peer dependencies:');
        for (const [peerName, peerVersion] of dep.peerDependencies) {
          const rootPeer = hoistedTree.root.get(peerName);
          const isSatisfied =
            rootPeer && semver.satisfies(rootPeer.version, peerVersion);
          const status = isSatisfied ? '✓' : '✗ (unsatisfied)';
          console.log(`│   │   ├── ${peerName}@${peerVersion} ${status}`);
        }
      }
    }

    // Print nested dependencies
    if (hoistedTree.nested.size > 0) {
      console.log(
        '\nNested dependencies (could not be hoisted due to version conflicts or peer dependency constraints):'
      );
      for (const [parent, deps] of hoistedTree.nested) {
        console.log(`\n${parent}/node_modules/`);
        for (const [name, dep] of deps) {
          console.log(`├── ${name}@${dep.version}`);

          // Print dependencies
          if (dep.dependencies.size > 0) {
            console.log('│   ├── dependencies:');
            for (const [depName, depVersion] of dep.dependencies) {
              console.log(`│   │   ├── ${depName}@${depVersion}`);
            }
          }

          // Print peer dependencies and check if they are satisfied at this level
          if (dep.peerDependencies.size > 0) {
            console.log('│   ├── peer dependencies:');
            for (const [peerName, peerVersion] of dep.peerDependencies) {
              // Check if peer dependency is satisfied at root or parent level
              const rootPeer = hoistedTree.root.get(peerName);
              const parentNestedDeps = hoistedTree.nested.get(parent);
              const parentPeer = parentNestedDeps?.get(peerName);

              let isSatisfied = false;
              if (rootPeer && semver.satisfies(rootPeer.version, peerVersion)) {
                isSatisfied = true;
              } else if (
                parentPeer &&
                semver.satisfies(parentPeer.version, peerVersion)
              ) {
                isSatisfied = true;
              }

              const status = isSatisfied ? '✓' : '✗ (unsatisfied)';
              console.log(`│   │   ├── ${peerName}@${peerVersion} ${status}`);
            }
          }
        }
      }
    }
  }

  private convertToHoistedTree(
    node: DependencyNode,
    parentPath: string = ''
  ): HoistedTree {
    const hoistedTree: HoistedTree = {
      root: new Map<string, HoistedDependency>(),
      nested: new Map<string, Map<string, HoistedDependency>>(),
    };

    // Helper function to convert DependencyNode to HoistedDependency
    const convertToHoistedDep = (
      node: DependencyNode,
      parent?: string
    ): HoistedDependency => ({
      name: node.name,
      version: node.version,
      dependencies: new Map(
        Array.from(node.dependencies.entries()).map(([name, dep]) => [
          name,
          dep.version,
        ])
      ),
      peerDependencies: new Map(node.peerDependencies),
      parent,
    });

    // Helper function to check version conflicts
    const hasVersionConflict = (
      dep1: HoistedDependency,
      dep2: DependencyNode
    ): boolean => {
      // If versions are exactly the same, there's no conflict
      if (dep1.version === dep2.version) {
        return false;
      }

      // Check if version ranges are compatible
      try {
        // Convert versions to semver ranges
        const range1 = semver.validRange(dep1.version) || dep1.version;
        const range2 = semver.validRange(dep2.version) || dep2.version;

        // Check if version ranges intersect
        const version1 = semver.valid(dep1.version);
        const version2 = semver.valid(dep2.version);

        if (version1 && version2) {
          // If both are specific versions, they must be exactly the same
          return version1 !== version2;
        }

        if (version1) {
          // If dep1 is a specific version, check if it satisfies dep2's range
          return !semver.satisfies(version1, range2);
        }

        if (version2) {
          // If dep2 is a specific version, check if it satisfies dep1's range
          return !semver.satisfies(version2, range1);
        }

        // If both are ranges, check for intersection
        // TODO: More complex logic might be needed for range intersection
        return true;
      } catch (error) {
        // If version parsing fails, conservatively assume there's a conflict
        return true;
      }
    };

    // Helper function to check if a package can be hoisted considering peer dependencies
    const canBeHoisted = (
      dep: DependencyNode,
      targetPath: string = ''
    ): boolean => {
      // Check if other packages depend on this package as a peer dependency
      for (const [name, hoistedDep] of hoistedTree.root) {
        if (hoistedDep.peerDependencies.has(dep.name)) {
          const requiredVersion = hoistedDep.peerDependencies.get(dep.name)!;
          if (!semver.satisfies(dep.version, requiredVersion)) {
            return false;
          }
        }
      }

      // Check if this package's peer dependencies can be satisfied
      for (const [peerName, peerVersion] of dep.peerDependencies) {
        const hoistedPeer = hoistedTree.root.get(peerName);
        if (
          hoistedPeer &&
          !semver.satisfies(hoistedPeer.version, peerVersion)
        ) {
          return false;
        }
      }

      return true;
    };

    // Process dependencies recursively
    const processNode = (
      node: DependencyNode,
      parentPath: string,
      isRoot: boolean = false
    ) => {
      const nodeKey = `${node.name}@${node.version}`;

      if (isRoot) {
        hoistedTree.root.set(node.name, convertToHoistedDep(node));
        for (const [depName, depNode] of node.dependencies) {
          processNode(depNode, nodeKey);
        }
        return;
      }

      // Try to hoist to root
      if (!hoistedTree.root.has(node.name)) {
        // No existing package with same name, check if it can be hoisted
        if (canBeHoisted(node)) {
          hoistedTree.root.set(node.name, convertToHoistedDep(node));
        } else {
          // Cannot be hoisted due to peer dependency constraints
          if (!hoistedTree.nested.has(parentPath)) {
            hoistedTree.nested.set(parentPath, new Map());
          }
          hoistedTree.nested
            .get(parentPath)!
            .set(node.name, convertToHoistedDep(node, parentPath));
        }
      } else {
        const existingDep = hoistedTree.root.get(node.name)!;
        if (hasVersionConflict(existingDep, node) || !canBeHoisted(node)) {
          // Version conflict or peer dependency constraints, needs to be nested
          if (!hoistedTree.nested.has(parentPath)) {
            hoistedTree.nested.set(parentPath, new Map());
          }
          hoistedTree.nested
            .get(parentPath)!
            .set(node.name, convertToHoistedDep(node, parentPath));
        }
      }

      // Process dependencies of current node
      for (const [depName, depNode] of node.dependencies) {
        processNode(depNode, nodeKey);
      }
    };

    processNode(node, '', true);
    return hoistedTree;
  }

  async analyzeSingle(
    packageName: string,
    version: string
  ): Promise<AnalysisResult> {
    const flatDeps = new Map<string, FlatDependency>();
    const dependencyTree = await this.buildDependencyTree(
      packageName,
      version,
      flatDeps
    );
    const hoistedTree = this.convertToHoistedTree(dependencyTree);

    return {
      dependencyTree,
      hoistedTree,
      flatDependencies: flatDeps,
    };
  }

  async analyzeMultiple(
    packages: PackageRequest[]
  ): Promise<MultiPackageAnalysisResult> {
    // Analyze each package individually
    const individual = new Map<string, AnalysisResult>();
    for (const pkg of packages) {
      const result = await this.analyzeSingle(pkg.name, pkg.version);
      individual.set(`${pkg.name}@${pkg.version}`, result);
    }

    // Combine all dependencies for a unified view
    const combinedFlatDeps = new Map<string, FlatDependency>();
    const virtualRoot: DependencyNode = {
      name: 'virtual-root',
      version: '0.0.0',
      dependencies: new Map(),
      peerDependencies: new Map(),
    };

    // Merge all individual trees into the virtual root
    for (const [pkgKey, result] of individual) {
      virtualRoot.dependencies.set(pkgKey, result.dependencyTree);

      // Merge flat dependencies
      for (const [key, dep] of result.flatDependencies) {
        if (!combinedFlatDeps.has(key)) {
          combinedFlatDeps.set(key, {
            name: dep.name,
            version: dep.version,
            requiredBy: new Set(dep.requiredBy),
          });
        } else {
          // Merge requiredBy sets
          dep.requiredBy.forEach((req) =>
            combinedFlatDeps.get(key)!.requiredBy.add(req)
          );
        }
      }
    }

    // Generate combined hoisted tree
    const combinedHoistedTree = this.convertToHoistedTree(virtualRoot);

    return {
      individual,
      combined: {
        hoistedTree: combinedHoistedTree,
        flatDependencies: combinedFlatDeps,
      },
    };
  }

  /**
   * Analyze a single package with its version
   * @param packageName Package name
   * @param version Package version
   */
  public async analyze(
    packageName: string,
    version: string
  ): Promise<AnalysisResult>;

  /**
   * Analyze multiple packages
   * @param packages Array of package requests containing name and version
   */
  public async analyze(
    packages: PackageRequest[]
  ): Promise<MultiPackageAnalysisResult>;

  /**
   * Implementation of the analyze method
   */
  public async analyze(
    packageName: string | PackageRequest[],
    version?: string
  ): Promise<AnalysisResult | MultiPackageAnalysisResult> {
    if (Array.isArray(packageName)) {
      return await this.analyzeMultiple(packageName);
    } else if (version) {
      return await this.analyzeSingle(packageName, version);
    } else {
      throw new Error(
        'Invalid arguments: When analyzing a single package, both name and version are required'
      );
    }
  }
}

class PackageNotFoundError extends Error {
  cause?: Error;

  constructor(packageName: string, version: string, cause?: Error) {
    super(`Package not found: ${packageName}@${version}, ${cause?.message}`);
    this.name = 'PackageNotFoundError';
    this.cause = cause;
  }
}
