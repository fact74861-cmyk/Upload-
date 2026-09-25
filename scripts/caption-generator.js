#!/usr/bin/env node
/**
 * Generic CLI Caption Generator
 * Reads project files, generates caption.txt and hashtags.txt
 */

import fs from 'node:fs';
import path from 'node:path';
import { discoverProjectMetadata, generateGenericCaption, saveCaptionsToOutput } from '../captions/generator.ts';

const args = process.argv.slice(2);
let projectDir = process.cwd();
let outputDir = path.resolve(process.cwd(), 'output/current');

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--project-dir' && args[i + 1]) projectDir = args[++i];
  else if (args[i] === '--output' && args[i + 1]) outputDir = args[++i];
}

const meta = discoverProjectMetadata(projectDir);
const result = generateGenericCaption(meta);
saveCaptionsToOutput(outputDir, result);

console.log(JSON.stringify({
  project_id: meta.id,
  project_name: meta.name,
  description: meta.description,
  caption: result.captionText,
  hashtags: result.hashtags
}, null, 2));
