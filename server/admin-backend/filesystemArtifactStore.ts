import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import type { SaasArtifactManifestEntry, SaasArtifactStore, SaasStoredArtifact } from '../../utils/saas-core/types.js';

export interface CreateFilesystemSaasArtifactStoreInput {
  rootDir: string;
}

const safeName = (value: string): string => value.replace(/[^a-zA-Z0-9._-]/g, '-');

const pseudoSha256 = (bytes: Uint8Array): string => {
  let hash = 2166136261;
  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`;
};

export const createFilesystemSaasArtifactStore = (input: CreateFilesystemSaasArtifactStoreInput): SaasArtifactStore => {
  const manifestPath = path.join(input.rootDir, 'manifest.json');

  return {
    saveArtifact: (artifactInput): SaasArtifactManifestEntry => {
      const bytes = artifactInput.content.byteLength;
      const artifact: SaasStoredArtifact = {
        ...artifactInput,
        bytes,
        sha256: artifactInput.sha256 || pseudoSha256(artifactInput.content),
      };
      const filePath = path.join(input.rootDir, `${safeName(artifact.id)}-${safeName(artifact.fileName)}`);
      fsSync.mkdirSync(input.rootDir, { recursive: true });
      fsSync.writeFileSync(filePath, artifact.content);
      let artifacts: Array<Omit<SaasStoredArtifact, 'content'>> = [];
      if (fsSync.existsSync(manifestPath)) {
        artifacts = JSON.parse(fsSync.readFileSync(manifestPath, 'utf8'));
      }
      const { content: _artifactContent, ...artifactManifest } = artifact;
      const manifestArtifacts = [...artifacts.filter((item) => item.id !== artifact.id), artifactManifest];
      fsSync.writeFileSync(manifestPath, JSON.stringify(manifestArtifacts, null, 2), 'utf8');
      const { content: _content, createdAt: _createdAt, ...manifest } = artifact;
      return manifest;
    },
    readArtifact: (id: string): SaasStoredArtifact | undefined => {
      if (!fsSync.existsSync(manifestPath)) return undefined;
      const artifacts = JSON.parse(fsSync.readFileSync(manifestPath, 'utf8')) as Array<Omit<SaasStoredArtifact, 'content'>>;
      const metadata = artifacts.find((artifact) => artifact.id === id);
      if (!metadata) return undefined;
      const content = new Uint8Array(fsSync.readFileSync(path.join(input.rootDir, `${safeName(metadata.id)}-${safeName(metadata.fileName)}`)));
      return { ...metadata, content };
    },
    listArtifacts: (): SaasStoredArtifact[] => {
      if (!fsSync.existsSync(manifestPath)) return [];
      const artifacts = JSON.parse(fsSync.readFileSync(manifestPath, 'utf8')) as Array<Omit<SaasStoredArtifact, 'content'>>;
      return artifacts.map((artifact) => ({
        ...artifact,
        content: new Uint8Array(fsSync.readFileSync(path.join(input.rootDir, `${safeName(artifact.id)}-${safeName(artifact.fileName)}`))),
      }));
    },
  };
};

export const readFilesystemArtifactAsync = async (
  rootDir: string,
  id: string
): Promise<SaasStoredArtifact | undefined> => {
  const manifestPath = path.join(rootDir, 'manifest.json');
  const raw = await fs.readFile(manifestPath, 'utf8');
  const artifacts = JSON.parse(raw) as Array<Omit<SaasStoredArtifact, 'content'>>;
  const metadata = artifacts.find((artifact) => artifact.id === id);
  if (!metadata) return undefined;
  const filePath = path.join(rootDir, `${safeName(metadata.id)}-${safeName(metadata.fileName)}`);
  const content = new Uint8Array(await fs.readFile(filePath));
  return { ...metadata, content };
};

export const listFilesystemArtifactsAsync = async (rootDir: string): Promise<SaasStoredArtifact[]> => {
  try {
    const raw = await fs.readFile(path.join(rootDir, 'manifest.json'), 'utf8');
    const artifacts = JSON.parse(raw) as Array<Omit<SaasStoredArtifact, 'content'>>;
    return await Promise.all(artifacts.map(async (artifact) => ({
      ...artifact,
      content: new Uint8Array(await fs.readFile(path.join(rootDir, `${safeName(artifact.id)}-${safeName(artifact.fileName)}`))),
    })));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
};
