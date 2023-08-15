import { z } from 'zod';
import type { FastifyPluginCallback } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import Issue from '../issue';

const GitLabIssueEvent = z
  .object({
    object_kind: z.literal('issue'),
    object_attributes: z.object({
      id: z.number(),
      title: z.string(),
      description: z.string(),
      state: z.enum(['opened', 'closed', 'reopened']),
      updated_at: z.string(),
      action: z.enum(['open', 'close', 'reopen', 'update']),
    }),
    project: z.object({
      id: z.number(),
      name: z.string(),
      description: z.string(),
      web_url: z.string(),
      default_branch: z.string(),
    }),
  })
  .passthrough();

const plugin: FastifyPluginCallback = (fastify, _options, done) => {
  fastify
    .withTypeProvider<ZodTypeProvider>()
    .get('/gitlab', { schema: { body: GitLabIssueEvent } }, async ({ body }, reply) => {
      const title = body.object_attributes.title;
      const description = body.object_attributes.description;
      const state = body.object_attributes.state === 'closed' ? 'closed' : 'opened';

      const issue = Issue.from(title, description, state);
      if (!issue) {
        reply.send(200);
        return;
      }

      // TODO: check if the issue description is already filled

      reply.send(200);
    });

  done();
};

export default plugin;
