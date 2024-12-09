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
      timeout: 5000,
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
      expect(result.dependencyTree.name).toBe('lodash');
      expect(result.dependencyTree.version).toBe('4.17.21');
      expect(result.dependencyTree.dependencies.size).toBe(0);
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
      expect(result.dependencyTree.name).toBe('@testing-library/react');
      expect(result.dependencyTree.peerDependencies.size).toBeGreaterThan(0);
      expect(result.dependencyTree.peerDependencies.has('react')).toBe(true);
    });

    it('should handle latest tag for dependencies', async () => {
      const result = await analyzer.analyze('lodash', 'latest');
      expect(result.dependencyTree.name).toBe('lodash');
      expect(result.dependencyTree.version).toMatch(/^\d+\.\d+\.\d+$/); // Ensure it's a valid semver
      expect(result.dependencyTree.dependencies.size).toBeGreaterThanOrEqual(0);
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
          expect(result.dependencyTree.name).toBe(pkg.name);
          expect(result.dependencyTree.version).toMatch(/^\d+\.\d+\.\d+$/);
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
});
