import type { SaasArtifactManifestEntry, SaasArtifactStore, SaasStoredArtifact } from './types.js';

const pseudoSha256 = (bytes: Uint8Array): string => {
  let hash = 2166136261;
  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`;
};

export const textToArtifactBytes = (value: string): Uint8Array => new TextEncoder().encode(value);

export const createMemorySaasArtifactStore = (initialArtifacts: SaasStoredArtifact[] = []): SaasArtifactStore => {
  const artifacts = new Map(initialArtifacts.map((artifact) => [artifact.id, artifact]));

  return {
    saveArtifact: (input): SaasArtifactManifestEntry => {
      const bytes = input.content.byteLength;
      const artifact: SaasStoredArtifact = {
        ...input,
        bytes,
        sha256: input.sha256 || pseudoSha256(input.content),
      };
      artifacts.set(artifact.id, artifact);
      const { content: _content, createdAt: _createdAt, ...manifest } = artifact;
      return manifest;
    },
    readArtifact: (id) => artifacts.get(id),
    listArtifacts: () => Array.from(artifacts.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  };
};
