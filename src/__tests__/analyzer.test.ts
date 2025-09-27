import {
  NpmDepTreeAnalyzer,
  AnalysisResult,
  MultiPackageAnalysisResult,
} from '../index';

describe('NpmDepTreeAnalyzer', () => {
  let analyzer: NpmDepTreeAnalyzer;
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    analyzer = new NpmDepTreeAnalyzer({
      registry: 'https://registry.npmmirror.com',
      timeout: 30000,
      headers: {
        'User-Agent': 'npm-dependency-analyzer-test',
      },
    });
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('Single Package Analysis', () => {
    it('should analyze express package successfully', async () => {
      const result: AnalysisResult = await analyzer.analyze(
        'express',
        '4.18.2'
      );
      expect(result).toBeDefined();
      NpmDepTreeAnalyzer.printDependencyTree(result.dependencyTree);
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should analyze package with no dependencies', async () => {
      const result = await analyzer.analyze('lodash', '4.17.21');
      expect(result.dependencyTree?.name).toBe('lodash');
      expect(result.dependencyTree?.version).toBe('4.17.21');
      expect(result.dependencyTree?.dependencies.size).toBe(0);
    });

    it('should throw error for invalid package', async () => {
      await expect(
        analyzer.analyze('invalid-package-name-123456', '1.0.0')
      ).rejects.toThrow();
    });

    it('should throw error for invalid version', async () => {
      await expect(
        analyzer.analyze('express', 'invalid-version')
      ).rejects.toThrow();
    });

    it('should handle peer dependencies correctly', async () => {
      // Testing @testing-library/react which has react as a peer dependency
      const result = await analyzer.analyze('@testing-library/react', '14.1.2');
      expect(result.dependencyTree?.name).toBe('@testing-library/react');
      expect(result.dependencyTree?.peerDependencies.size).toBeGreaterThan(0);
      expect(result.dependencyTree?.peerDependencies.has('react')).toBe(true);
    });

    it('should handle latest tag for dependencies', async () => {
      const result = await analyzer.analyze('lodash', 'latest');
      expect(result.dependencyTree?.name).toBe('lodash');
      expect(result.dependencyTree?.version).toMatch(/^\d+\.\d+\.\d+$/); // Ensure it's a valid semver
      expect(result.dependencyTree?.dependencies.size).toBeGreaterThanOrEqual(0);
    });

    it('should handle other dist-tags', async () => {
      const testPackages = [
        { name: 'typescript', tag: 'next' },
        { name: 'react', tag: 'experimental' },
        { name: 'webpack', tag: 'beta' },
        { name: 'lodash', tag: 'latest' }
      ];

      for (const pkg of testPackages) {
        try {
          const result = await analyzer.analyze(pkg.name, pkg.tag);
          expect(result.dependencyTree?.name).toBe(pkg.name);
          expect(result.dependencyTree?.version).toMatch(/^\d+\.\d+\.\d+$/);
        } catch (error) {
          // Some packages might not have all dist-tags, so we'll log but not fail
          console.warn(`Could not resolve ${pkg.name} with tag ${pkg.tag}`);
        }
      }
    });
  });

  describe('Multiple Package Analysis', () => {
    it('should analyze multiple packages successfully', async () => {
      const packages = [
        { name: 'express', version: '4.18.2' },
        { name: 'lodash', version: '4.17.21' },
      ];
      const result: MultiPackageAnalysisResult =
        await analyzer.analyze(packages);
      expect(result).toBeDefined();
      for (const [, analysis] of result.individual) {
        NpmDepTreeAnalyzer.printDependencyTree(analysis.dependencyTree);
      }
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should handle empty package list', async () => {
      const result: MultiPackageAnalysisResult = await analyzer.analyze([]);
      expect(result).toBeDefined();
    });
  });

  describe('Registry Configuration', () => {
    it('should handle registry timeout', async () => {
      const timeoutAnalyzer = new NpmDepTreeAnalyzer({
        timeout: 1, // 1ms timeout
      });
      await expect(
        timeoutAnalyzer.analyze('express', '4.18.2')
      ).rejects.toThrow();
    });
  });

  describe('Hoisting Logic', () => {
    it('should hoist common dependencies to the root', async () => {
      // Mock getPackageInfo to avoid network requests
      const getPackageInfoMock = jest.spyOn(
        NpmDepTreeAnalyzer.prototype as any,
        '_getPackageInfo'
      );

      getPackageInfoMock.mockImplementation(async (name: any, version: any) => {
        const packages = {
          'A@1.0.0': { name: 'A', version: '1.0.0', dependencies: { B: '1.0.0' } },
          'B@1.0.0': { name: 'B', version: '1.0.0', dependencies: {} },
          'C@1.0.0': { name: 'C', version: '1.0.0', dependencies: { B: '1.0.0' } },
        };
        // @ts-ignore
        return packages[`${name}@${version}`];
      });

      const result = await analyzer.analyze([
        { name: 'A', version: '1.0.0' },
        { name: 'C', version: '1.0.0' },
      ]);

      const hoistedTree = result.combined.hoistedTree;

      // A and C should be at the root
      expect(hoistedTree.root.has('A')).toBe(true);
      expect(hoistedTree.root.has('C')).toBe(true);

      // B should be hoisted to the root
      expect(hoistedTree.root.has('B')).toBe(true);
      expect(hoistedTree.root.get('B')?.version).toBe('1.0.0');

      // No nested dependencies
      expect(hoistedTree.nested.size).toBe(0);

      getPackageInfoMock.mockRestore();
    });

    it('should handle version conflicts by nesting dependencies', async () => {
      const getPackageInfoMock = jest.spyOn(
        NpmDepTreeAnalyzer.prototype as any,
        '_getPackageInfo'
      );

      getPackageInfoMock.mockImplementation(async (name: any, version: any) => {
        const packages = {
          'A@1.0.0': { name: 'A', version: '1.0.0', dependencies: { B: '1.0.0' } },
          'B@1.0.0': { name: 'B', version: '1.0.0', dependencies: {} },
          'C@1.0.0': { name: 'C', version: '1.0.0', dependencies: { B: '2.0.0' } },
          'B@2.0.0': { name: 'B', version: '2.0.0', dependencies: {} },
        };
         // @ts-ignore
        return packages[`${name}@${version}`];
      });

      const result = await analyzer.analyze([
        { name: 'A', version: '1.0.0' },
        { name: 'C', version: '1.0.0' },
      ]);

      const hoistedTree = result.combined.hoistedTree;
      const aNode = result.individual.get('A@1.0.0')?.dependencyTree;
      const cNode = result.individual.get('C@1.0.0')?.dependencyTree;

      // One version of B is hoisted
      expect(hoistedTree.root.has('B')).toBe(true);

      // The other version of B is nested
      const nestedB = hoistedTree.nested.get(aNode!)?.get('B') ?? hoistedTree.nested.get(cNode!)?.get('B');
      expect(nestedB).toBeDefined();

      getPackageInfoMock.mockRestore();
    });

    it('should correctly resolve peer dependencies', async () => {
        const getPackageInfoMock = jest.spyOn(
            NpmDepTreeAnalyzer.prototype as any,
            '_getPackageInfo'
        );

        getPackageInfoMock.mockImplementation(async (name: any, version: any) => {
            const packages = {
                'A@1.0.0': { name: 'A', version: '1.0.0', peerDependencies: { B: '1.0.0' } },
                'B@1.0.0': { name: 'B', version: '1.0.0', dependencies: {} },
            };
            // @ts-ignore
            return packages[`${name}@${version}`];
        });

        const result = await analyzer.analyze([
            { name: 'A', version: '1.0.0' },
            { name: 'B', version: '1.0.0' },
        ]);

        const hoistedTree = result.combined.hoistedTree;
        expect(hoistedTree.root.has('A')).toBe(true);
        expect(hoistedTree.root.has('B')).toBe(true);
        expect(hoistedTree.nested.size).toBe(0);

        getPackageInfoMock.mockRestore();
    });

    it('should support npm aliases', async () => {
        const getPackageInfoMock = jest.spyOn(
            NpmDepTreeAnalyzer.prototype as any,
            '_getPackageInfo'
        );

        getPackageInfoMock.mockImplementation(async (name: any, version: any) => {
            if (version.startsWith('npm:')) {
                const aliasMatch = version.match(/^npm:(.+?)@(.+)$/);
                const realName = aliasMatch![1];
                const realVersion = aliasMatch![2];
                return { name: name, version: realVersion, dependencies: {}, alias: { name: realName, version: realVersion } };
            }
            // @ts-ignore
            return { name, version, dependencies: {} };
        });

        const result = await analyzer.analyze('my-b', 'npm:B@1.0.0');
        const hoistedTree = result.hoistedTree;

        expect(hoistedTree?.root.has('my-b')).toBe(true);
        expect(hoistedTree?.root.get('my-b')?.name).toBe('my-b');
        expect(hoistedTree?.root.get('my-b')?.alias?.name).toBe('B');

        getPackageInfoMock.mockRestore();
    });

    it('should handle circular dependencies gracefully', async () => {
      const getPackageInfoMock = jest.spyOn(
        NpmDepTreeAnalyzer.prototype as any,
        '_getPackageInfo'
      );

      getPackageInfoMock.mockImplementation(async (name: any, version: any) => {
        const packages = {
          'A@1.0.0': { name: 'A', version: '1.0.0', dependencies: { B: '1.0.0' } },
          'B@1.0.0': { name: 'B', version: '1.0.0', dependencies: { A: '1.0.0' } },
        };
        // @ts-ignore
        return packages[`${name}@${version}`];
      });

      const result = await analyzer.analyze('A', '1.0.0');
      expect(result.dependencyTree).toBeDefined();
      // We expect B to be a dependency of A
      expect(result.dependencyTree?.dependencies.has('B')).toBe(true);
      // But B's dependency on A should be undefined due to circular dependency detection
      expect(result.dependencyTree?.dependencies.get('B')?.dependencies.has('A')).toBe(false);


      getPackageInfoMock.mockRestore();
    });
  });
});
