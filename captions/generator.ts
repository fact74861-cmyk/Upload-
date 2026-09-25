/**
 * ==============================================================================
 * Generic Caption & Hashtags Engine for ANY GitHub Project
 * ==============================================================================
 * Automatically detects project name and description from:
 * 1. package.json
 * 2. README.md
 * 3. pyproject.toml / Cargo.toml
 *
 * Rules:
 * - Never invent features or make unsupported claims
 * - Formats:
 *   "Built something new 🚀
 *    [actual project-specific one-line description]
 *    #buildinpublic #indiedev #technology #startup"
 * ==============================================================================
 */

import fs from 'node:fs';
import path from 'node:path';

export interface ProjectMetadata {
  id: string;
  name: string;
  description: string;
  keywords: string[];
}

export interface GeneratedCaptionResult {
  captionText: string;
  hashtagsText: string;
  oneLiner: string;
  hashtags: string[];
}

/**
 * Discovers project name and description automatically from repository files
 */
export function discoverProjectMetadata(projectDir: string): ProjectMetadata {
  const baseName = path.basename(projectDir);
  let name = baseName;
  let description = 'Open-source software project';
  let keywords: string[] = ['opensource', 'developer', 'coding', 'software'];

  // Check package.json
  const pkgPath = path.join(projectDir, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      if (pkg.name) name = pkg.name;
      if (pkg.description) description = pkg.description;
      if (Array.isArray(pkg.keywords)) keywords = [...keywords, ...pkg.keywords];
    } catch {
      // Ignore parse failure and fallback to README
    }
  }

  // Check README.md if description is still generic
  const readmePath = path.join(projectDir, 'README.md');
  if (fs.existsSync(readmePath)) {
    try {
      const lines = fs.readFileSync(readmePath, 'utf-8').split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('# ')) {
          if (!name || name === baseName) {
            name = trimmed.replace(/^#\s+/, '').trim();
          }
        } else if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('!') && !trimmed.startsWith('[')) {
          if (description === 'Open-source software project' && trimmed.length > 10) {
            description = trimmed;
            break;
          }
        }
      }
    } catch {
      // Fallback
    }
  }

  return {
    id: name.toLowerCase().replace(/[^a-z0-9_-]/g, '-'),
    name,
    description,
    keywords: Array.from(new Set(keywords.map(k => k.toLowerCase().replace(/[^a-z0-9]/g, '')))).filter(Boolean)
  };
}

/**
 * Generates concise social media caption and hashtags from detected metadata
 */
export function generateGenericCaption(
  metadata: ProjectMetadata,
  options?: { language?: 'english' | 'hinglish'; tone?: string }
): GeneratedCaptionResult {
  const { name, description, keywords } = metadata;
  const isHinglish = options?.language === 'hinglish';

  const cleanTag = `#${name.replace(/[^a-zA-Z0-9]/g, '')}`;
  const coreTags = ['#buildinpublic', '#indiedev', '#technology', '#startup'];
  const projectSpecificTags = keywords.slice(0, 4).map(k => `#${k}`);

  const allTags = Array.from(new Set([cleanTag, ...coreTags, ...projectSpecificTags])).slice(0, 8);
  const hashtagsText = allTags.join(' ');

  let captionBody = '';
  if (isHinglish) {
    captionBody = `Built something new 🚀\n\n${description}\nCheck it out and star the repo!`;
  } else {
    captionBody = `Built something new 🚀\n\n${description}`;
  }

  const fullCaption = `${captionBody}\n\n${hashtagsText}`;

  return {
    captionText: fullCaption,
    hashtagsText,
    oneLiner: description,
    hashtags: allTags
  };
}

/**
 * Saves caption.txt and hashtags.txt into target directory
 */
export function saveCaptionsToOutput(outputDir: string, result: GeneratedCaptionResult): void {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  fs.writeFileSync(path.join(outputDir, 'caption.txt'), result.captionText, 'utf-8');
  fs.writeFileSync(path.join(outputDir, 'hashtags.txt'), result.hashtagsText, 'utf-8');
}
