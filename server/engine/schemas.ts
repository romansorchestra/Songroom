// JSON schemas sent to the writer (structured output) and Zod parsers that
// validate what comes back before anything is stored.

import { z } from 'zod';

const nullable = (t: object) => ({ anyOf: [t, { type: 'null' }] });

const constraintsSchema = {
  type: 'object',
  description: 'Hard constraints you read in the request. Use null / [] when not stated. Do not invent constraints.',
  properties: {
    count: nullable({ type: 'integer', description: 'Exact number of ideas/options requested, if stated.' }),
    linesPerOption: nullable({ type: 'integer', description: 'Exact number of lines per option, if stated.' }),
    mustStartWith: nullable({ type: 'string', description: 'Exact words the first line must begin with, if stated.' }),
    mustEndWith: nullable({ type: 'string', description: 'Exact words the final line must end with, if stated.' }),
    forbidden: { type: 'array', items: { type: 'string' }, description: 'Words he said not to use.' },
  },
  required: ['count', 'linesPerOption', 'mustStartWith', 'mustEndWith', 'forbidden'],
  additionalProperties: false,
};

export const writeSchema = {
  type: 'object',
  properties: {
    kind: { type: 'string', enum: ['ideas', 'lines', 'draft', 'reply'] },
    reply: { type: 'string', description: 'Short conversational text. Empty string if the cards speak for themselves.' },
    ideas: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          concept: { type: 'string' },
          lines: { type: 'array', items: { type: 'string' } },
        },
        required: ['title', 'concept', 'lines'],
        additionalProperties: false,
      },
    },
    options: {
      type: 'array',
      description: 'Alternative lines/couplets/passages. Each option is a list of lyric lines.',
      items: {
        type: 'object',
        properties: { lines: { type: 'array', items: { type: 'string' } } },
        required: ['lines'],
        additionalProperties: false,
      },
    },
    draft: nullable({
      type: 'object',
      description: 'A full or partial song draft, only when explicitly asked for one.',
      properties: {
        sections: {
          type: 'array',
          items: {
            type: 'object',
            properties: { label: { type: 'string' }, lines: { type: 'array', items: { type: 'string' } } },
            required: ['label', 'lines'],
            additionalProperties: false,
          },
        },
      },
      required: ['sections'],
      additionalProperties: false,
    }),
    constraints: constraintsSchema,
  },
  required: ['kind', 'reply', 'ideas', 'options', 'draft', 'constraints'],
  additionalProperties: false,
};

const constraintsZ = z.object({
  count: z.number().int().nullable(),
  linesPerOption: z.number().int().nullable(),
  mustStartWith: z.string().nullable(),
  mustEndWith: z.string().nullable(),
  forbidden: z.array(z.string()),
});

export const writeZ = z.object({
  kind: z.enum(['ideas', 'lines', 'draft', 'reply']),
  reply: z.string(),
  ideas: z.array(z.object({ title: z.string().min(1), concept: z.string(), lines: z.array(z.string()) })),
  options: z.array(z.object({ lines: z.array(z.string()) })),
  draft: z.object({ sections: z.array(z.object({ label: z.string(), lines: z.array(z.string()) })) }).nullable(),
  constraints: constraintsZ,
});
export type WriteOut = z.infer<typeof writeZ>;

export const editSchema = {
  type: 'object',
  properties: {
    reply: { type: 'string', description: 'One short line, only if something needs saying (e.g. a constraint conflict). Otherwise empty.' },
    options: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          targets: {
            type: 'array',
            description: 'Exactly one entry per target, in target order (T1, T2, ...).',
            items: {
              type: 'object',
              properties: { target: { type: 'string' }, text: { type: 'string' } },
              required: ['target', 'text'],
              additionalProperties: false,
            },
          },
        },
        required: ['targets'],
        additionalProperties: false,
      },
    },
    constraints: constraintsSchema,
  },
  required: ['reply', 'options', 'constraints'],
  additionalProperties: false,
};

export const editZ = z.object({
  reply: z.string(),
  options: z.array(z.object({ targets: z.array(z.object({ target: z.string(), text: z.string() })) })),
  constraints: constraintsZ,
});
export type EditOut = z.infer<typeof editZ>;

export const sunoSchema = {
  type: 'object',
  properties: {
    style: { type: 'string', description: 'Comma-separated style descriptors, most important first. Under 600 characters. No artist or song names.' },
    exclude: { type: 'string', description: 'Comma-separated styles/elements to exclude. May be empty.' },
    intro: { type: 'array', items: { type: 'string' }, description: 'Bracketed tag lines before the first section, e.g. "[Intro: ...]". May be empty.' },
    sections: {
      type: 'array',
      description: 'One entry per lyric section, in order, using the section index given.',
      items: {
        type: 'object',
        properties: {
          index: { type: 'integer' },
          tags: { type: 'array', items: { type: 'string' }, description: 'Bracketed tag lines placed above this section.' },
        },
        required: ['index', 'tags'],
        additionalProperties: false,
      },
    },
    outro: { type: 'array', items: { type: 'string' }, description: 'Bracketed tag lines after the last section, ending with "[End]".' },
  },
  required: ['style', 'exclude', 'intro', 'sections', 'outro'],
  additionalProperties: false,
};

export const sunoZ = z.object({
  style: z.string(),
  exclude: z.string(),
  intro: z.array(z.string()),
  sections: z.array(z.object({ index: z.number().int(), tags: z.array(z.string()) })),
  outro: z.array(z.string()),
});
export type SunoOut = z.infer<typeof sunoZ>;
