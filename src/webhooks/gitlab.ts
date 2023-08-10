import { z } from 'zod';
import type { FastifyPluginCallback } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';

const GitLabIssueName = 'Alfred Dependency Manager';
const GitLabIssueLabel = 'Alfred';

const GitLabIssueEvent = z
  .object({
    object_kind: z.string(),
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
      // only care about issues that are opened with the specific title
      if (
        body.object_kind !== 'issue' ||
        body.object_attributes.title !== GitLabIssueName ||
        body.object_attributes.state === 'closed'
      ) {
        reply.send(200);
        return;
      }

      // TODO: check if the issue description is already filled
      // TODO: check if the issue has the label already

      reply.send(200);
    });

  done();
};

export default plugin;
